import assert from "node:assert/strict";
import test from "node:test";

import {
  ALLERGEN_REGISTRY,
  getAllergenDisplayGroups,
  getAllergenPublicCopy,
  getRequestedModificationsAllergenDisclaimer,
  getAllergenStatus,
  matchesConfirmedFreeForFilter,
  matchesConfirmedFree,
  normalizeAllergenData,
  validateAllergenDeclarations
} from "../lib/menu/allergens.ts";

test("localized requested-modifications disclaimer uses menu copy", () => {
  const localizedUiCopy = {
    allergens: {
      requestedModificationsDisclaimer: {
        fr: "Avertissement FR",
        en: "Warning EN"
      }
    }
  };

  assert.equal(
    getRequestedModificationsAllergenDisclaimer("fr-CA", localizedUiCopy),
    "Avertissement FR"
  );
  assert.equal(
    getRequestedModificationsAllergenDisclaimer("en-CA", localizedUiCopy),
    "Warning EN"
  );
});

test("allergen copy omits the unconfirmed-information block", () => {
  const copy = getAllergenPublicCopy("fr");

  assert.equal("unknown" in copy, false);
  assert.equal("unknownBody" in copy, false);
});

test("allergen display groups preserve unknown registry declarations", () => {
  const empty = getAllergenDisplayGroups({ allergenDeclarations: [] }, "fr");
  assert.equal(empty.unknownCount, ALLERGEN_REGISTRY.length);

  const partial = getAllergenDisplayGroups(
    { allergenDeclarations: [{ allergenId: "gluten", status: "contains" }] },
    "fr"
  );
  assert.equal(partial.contains.length, 1);
  assert.equal(partial.unknownCount, ALLERGEN_REGISTRY.length - 1);
});

test("every supported allergen status is fail-closed for declared-free filtering", () => {
  const statuses = ["unknown", "contains", "may_contain", "confirmed_free"];

  for (const status of statuses) {
    const dish = {
      allergenDeclarations: [{ allergenId: "gluten", status }]
    };
    assert.equal(
      matchesConfirmedFree(dish, "gluten"),
      status === "confirmed_free",
      `unexpected declared-free result for ${status}`
    );
  }

  assert.equal(matchesConfirmedFree({ allergenDeclarations: [] }, "gluten"), false);
  assert.equal(matchesConfirmedFree({ allergens: [] }, "gluten"), false);
  assert.equal(matchesConfirmedFree({ allergens: ["Poisson"] }, "gluten"), false);
  assert.equal(matchesConfirmedFree({ allergens: ["Poisson"] }, "dairy"), false);
  assert.equal(matchesConfirmedFree({ allergens: ["Poisson"] }, "eggs"), false);
});

test("shellfish-free requires crustaceans and molluscs to be confirmed free", () => {
  const base = {
    allergenDeclarations: [
      { allergenId: "crustaceans", status: "confirmed_free" },
      { allergenId: "molluscs", status: "confirmed_free" }
    ]
  };

  assert.equal(matchesConfirmedFreeForFilter(base, "shellfish-free"), true);
  assert.equal(
    matchesConfirmedFreeForFilter(
      {
        allergenDeclarations: [
          ...base.allergenDeclarations.map((item) =>
            item.allergenId === "crustaceans"
              ? { ...item, status: "contains" }
              : item
          )
        ]
      },
      "shellfish-free"
    ),
    false
  );
  assert.equal(
    matchesConfirmedFreeForFilter(
      {
        allergenDeclarations: [
          { allergenId: "crustaceans", status: "confirmed_free" }
        ]
      },
      "shellfish-free"
    ),
    false
  );
  assert.equal(
    matchesConfirmedFreeForFilter(
      { allergenDeclarations: [{ allergenId: "shellfish", status: "confirmed_free" }] },
      "shellfish-free"
    ),
    false
  );
});

test("the canonical registry keeps distinct allergen families and stable ids", () => {
  const ids = ALLERGEN_REGISTRY.map((item) => item.id);

  assert.deepEqual(ids, [
    "gluten",
    "dairy",
    "eggs",
    "tree_nuts",
    "crustaceans",
    "shellfish",
    "molluscs",
    "peanuts",
    "sesame",
    "soy",
    "mustard",
    "fish",
    "sulfites"
  ]);
  assert.notEqual(ids.indexOf("fish"), ids.indexOf("crustaceans"));
  assert.notEqual(ids.indexOf("tree_nuts"), ids.indexOf("crustaceans"));
});

test("legacy explicit and trace declarations normalize conservatively", () => {
  const explicit = normalizeAllergenData(undefined, ["Poisson", "Lait"]);
  assert.equal(getAllergenStatus(explicit.declarations, "fish"), "contains");
  assert.equal(getAllergenStatus(explicit.declarations, "dairy"), "contains");
  assert.equal(getAllergenStatus(explicit.declarations, "gluten"), "unknown");

  const traces = normalizeAllergenData(undefined, ["Peut contenir des noix"]);
  assert.equal(getAllergenStatus(traces.declarations, "tree_nuts"), "may_contain");
  assert.equal(getAllergenStatus(traces.declarations, "gluten"), "unknown");

  const ambiguous = normalizeAllergenData(undefined, ["Sans gluten"]);
  assert.equal(getAllergenStatus(ambiguous.declarations, "gluten"), "unknown");
  assert.equal(matchesConfirmedFree(ambiguous, "gluten"), false);
  assert.deepEqual(ambiguous.legacyValues, ["Sans gluten"]);
});

test("structured declarations take precedence over legacy text", () => {
  const normalized = normalizeAllergenData(
    [{ allergenId: "gluten", status: "may_contain" }],
    ["Sans gluten"]
  );

  assert.equal(getAllergenStatus(normalized.declarations, "gluten"), "may_contain");
  assert.equal(matchesConfirmedFree(normalized, "gluten"), false);
  assert.equal(normalized.source, "structured");
});

test("backend validation rejects unknown ids, statuses, duplicates, and oversized payloads", () => {
  assert.doesNotThrow(() =>
    validateAllergenDeclarations([
      { allergenId: "gluten", status: "unknown" },
      { allergenId: "fish", status: "confirmed_free" }
    ])
  );

  for (const invalid of [
    [{}],
    [{ allergenId: null, status: "unknown" }],
    [{ allergenId: "gluten", status: null }],
    [{ allergenId: "not-real", status: "unknown" }],
    [{ allergenId: "gluten", status: "not-a-status" }],
    [
      { allergenId: "gluten", status: "unknown" },
      { allergenId: "gluten", status: "contains" }
    ],
    Array.from({ length: 25 }, (_, index) => ({
      allergenId: `unknown-${index}`,
      status: "unknown"
    }))
  ]) {
    assert.throws(() => validateAllergenDeclarations(invalid));
  }
});
