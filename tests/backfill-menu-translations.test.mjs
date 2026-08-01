import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  buildPlan,
  buildAtomicApplyPayload,
  buildMenuSettingsPlan,
  MAISON_CANONICAL_DISH_SLUGS,
  MAISON_ENGLISH_DISH_CONTENT,
  PUBLIC_MENU_NAME,
  TROUVABLE_CANONICAL_NAMES,
  run,
  parseArgs,
  projectRefFromUrl,
  redactError,
  sourceDishFields,
  validateArgs,
  validateSnapshot,
  readSnapshot,
  assertExplicitBinding
} from "../scripts/backfill-menu-translations.mjs";
import { getCategories, getDishBySlug } from "../lib/demoMenuData.ts";
import {
  fieldHashesFor,
  hashTranslationValue,
  sourceHashFor
} from "../lib/translation/menuTranslationModel.ts";

function snapshot({ targetSlug = "trouvable", rows = [], locale = "en-CA" } = {}) {
  const result = {
    targetSlug,
    sourceLocale: "fr-CA",
    defaultLocale: "fr-CA",
    locale,
    restaurant: {
      id: `${targetSlug}-restaurant-id`,
      name: targetSlug === "sauge-noire" ? "Sauge Noire" : targetSlug,
      slug: targetSlug
    },
    menu: {
      id: `${targetSlug}-menu-id`,
      restaurant_id: `${targetSlug}-restaurant-id`,
      name: "Menu principal",
      slug: "principal",
      updated_at: "2026-07-31T00:00:00.000Z"
    },
    categories: [
      {
        id: `${targetSlug}-category-id`,
        restaurant_id: `${targetSlug}-restaurant-id`,
        menu_id: `${targetSlug}-menu-id`,
        name: targetSlug === "sauge-noire" ? "Premiers gestes" : "Entrées",
        slug: targetSlug === "sauge-noire" ? "premiers-gestes" : "classiques-reinventes",
        description: "Petites assiettes."
      }
    ],
    dishes: [
      {
        id: `${targetSlug}-dish-id`,
        restaurant_id: `${targetSlug}-restaurant-id`,
        menu_id: `${targetSlug}-menu-id`,
        category_id: `${targetSlug}-category-id`,
        slug: targetSlug === "sauge-noire" ? "pain-de-seigle-chaud" : "smoked-meat-saint-laurent",
        name: targetSlug === "sauge-noire" ? "Pain de seigle chaud" : "Smoked Meat Saint-Laurent",
        short_description: "Une description réelle.",
        description: "Une description réelle.",
        allergens: [],
        metadata: { ingredients: ["Ingredient réel"], options: ["Option réelle"] }
      }
    ],
    rows
  };
  if (targetSlug === "trouvable") {
    result.categories[0].name = TROUVABLE_CANONICAL_NAMES.categories["classiques-reinventes"].fr;
    result.dishes[0].name = TROUVABLE_CANONICAL_NAMES.dishes["smoked-meat-saint-laurent"].fr;
  }
  return result;
}

function canonicalMaisonSnapshot() {
  const current = snapshot({ targetSlug: "maison-elyse" });
  const category = getCategories("fr")[0];
  const dish = getDishBySlug("ravioles-romarin", "fr");
  current.menu.name = "Menu principal";
  current.categories = [{
    id: "maison-category",
    restaurant_id: current.restaurant.id,
    menu_id: current.menu.id,
    slug: category.slug,
    name: category.name,
    description: category.description
  }];
  current.dishes = [{
    id: "maison-dish",
    restaurant_id: current.restaurant.id,
    menu_id: current.menu.id,
    category_id: "maison-category",
    slug: "ravioles-de-chevre-frais-miel-de-monteregie",
    name: dish.name,
    short_description: dish.shortDescription,
    description: dish.description,
    allergens: dish.allergens,
    metadata: { ingredients: dish.ingredients, options: dish.options, chefNote: dish.chefRecommendation, tags: ["Signature"] }
  }];
  current.rows = completeStoredRows(current);
  return current;
}

function freshDishRow(current, {
  manualOverrides = {},
  translatedAt = "2026-07-31T01:00:00.000Z",
  provider = "human"
} = {}) {
  const fields = sourceDishFields(current.dishes[0]);
  return {
    id: `translation-${current.dishes[0].id}`,
    entityType: "dish",
    entityId: current.dishes[0].id,
    translation_status: "up_to_date",
    provider,
    source_hash: sourceHashFor(fields),
    field_hashes: fieldHashesFor(fields),
    content: {
      name: "Smoked Meat Saint-Laurent",
      description: "Established English description",
      ingredients: ["Established English ingredient"],
      options: ["Established English option"]
    },
    manual_overrides: manualOverrides,
    error_message: null,
    translated_at: translatedAt,
    updated_at: translatedAt
  };
}

function dishOperation(plan) {
  return plan.operations.find((operation) => operation.entityType === "dish");
}

function completeStoredRows(current) {
  const menuFields = { menuName: current.menu.name };
  const rows = [{
    id: "menu-translation",
    entityType: "menu",
    entityId: current.menu.id,
    translation_status: "up_to_date",
    provider: "human",
    source_hash: sourceHashFor(menuFields),
    field_hashes: fieldHashesFor(menuFields),
    content: { menuName: "Main Menu" },
    manual_overrides: {},
    error_message: null,
    translated_at: "2026-07-31T01:00:00.000Z",
    updated_at: "2026-07-31T01:00:00.000Z"
  }];
  rows.push(...current.categories.map((category) => {
    const fields = { name: category.name, description: category.description };
    return {
      id: `translation-${category.id}`,
      entityType: "category",
      entityId: category.id,
      translation_status: "up_to_date",
      provider: "human",
      source_hash: sourceHashFor(fields),
      field_hashes: fieldHashesFor(fields),
      content: { name: category.name, description: "English category description" },
      manual_overrides: {},
      error_message: null,
      translated_at: "2026-07-31T01:00:00.000Z",
      updated_at: "2026-07-31T01:00:00.000Z"
    };
  }));
  rows.push(...current.dishes.map((dish) => {
    const fields = sourceDishFields(dish);
    return {
      id: `translation-${dish.id}`,
      entityType: "dish",
      entityId: dish.id,
      translation_status: "up_to_date",
      provider: "human",
      source_hash: sourceHashFor(fields),
      field_hashes: fieldHashesFor(fields),
      content: { ...fields },
      manual_overrides: {},
      error_message: null,
      translated_at: "2026-07-31T01:00:00.000Z",
      updated_at: "2026-07-31T01:00:00.000Z"
    };
  }));
  return rows;
}

test("production hash helpers are used for stable source and field hashes", () => {
  const fields = { name: "Plat officiel", ingredients: ["Un", "Deux"] };
  assert.equal(sourceHashFor(fields).length, 64);
  assert.deepEqual(Object.keys(fieldHashesFor(fields)).sort(), ["ingredients", "name"]);
  assert.equal(sourceHashFor(fields), sourceHashFor({ ingredients: ["Un", "Deux"], name: "Plat officiel" }));
});

test("source dish fields follow the production contract and only include non-empty fields", () => {
  assert.deepEqual(
    sourceDishFields({
      name: "Plat officiel",
      short_description: "Description courte",
      description: "Description longue",
      allergens: ["gluten"],
      metadata: {
        ingredients: ["Ingredient réel"],
        options: ["Option réelle"],
        chefNote: "Note maison",
        tags: ["Signature"]
      }
    }),
    {
      description: "Description courte",
      ingredients: ["Ingredient réel"],
      allergens: ["gluten"],
      options: ["Option réelle"],
      houseNote: "Note maison",
      tags: ["Signature"]
    }
  );
});

test("backfill contract documents the PR175 then PR174 integration order", () => {
  const runbook = readFileSync(new URL("../docs/qa/menu-translation-backfill-runbook.md", import.meta.url), "utf8");
  assert.match(runbook, /PR #175.*PR #174/s);
  assert.match(runbook, /update #174 from the latest `main`/i);
  assert.match(runbook, /does not copy the runtime implementation/i);
});

for (const [field, updateSource] of [
  ["description", (current) => { current.dishes[0].short_description = "Une description modifiÃ©e."; }],
  ["ingredients", (current) => { current.dishes[0].metadata.ingredients = ["Nouvel ingrÃ©dient"]; }],
  ["options", (current) => { current.dishes[0].metadata.options = ["Nouvelle option"]; }]
]) {
  test(`a changed ${field} stays stale across a second planning pass`, () => {
    const current = snapshot();
    const existing = freshDishRow(current);
    current.rows = [existing];

    const initial = dishOperation(buildPlan(current, { now: "2026-07-31T02:00:00.000Z" }));
    assert.equal(initial.patch.translation_status, "up_to_date");

    updateSource(current);
    const first = dishOperation(buildPlan(current, { now: "2026-07-31T03:00:00.000Z" }));
    assert.equal(first.patch.translation_status, "stale");
    assert.equal(first.patch.source_hash, existing.source_hash);
    assert.deepEqual(first.patch.field_hashes, existing.field_hashes);
    assert.deepEqual(first.patch.content, existing.content);
    assert.equal(first.patch.provider, existing.provider);
    assert.equal(first.patch.translated_at, existing.translated_at);

    current.rows = [{ ...existing, ...first.patch }];
    const second = dishOperation(buildPlan(current, { now: "2026-07-31T04:00:00.000Z" }));
    assert.equal(second.patch.translation_status, "stale");
    assert.equal(second.action, "noop");
    assert.equal(second.patch.source_hash, existing.source_hash);
    assert.deepEqual(second.patch.field_hashes, existing.field_hashes);
    assert.deepEqual(second.patch.content, existing.content);
    assert.equal(second.patch.translated_at, existing.translated_at);
  });
}

test("a name-only source change leaves translation freshness unchanged", () => {
  const current = snapshot();
  const existing = freshDishRow(current);
  current.rows = [existing];
  assert.equal(dishOperation(buildPlan(current)).patch.translation_status, "up_to_date");

  current.dishes[0].name = "Smoked Meat Saint-Laurent revisÃ©";
  const operation = dishOperation(buildPlan(current, { now: "2026-07-31T03:00:00.000Z" }));
  assert.equal(operation.patch.translation_status, "up_to_date");
  assert.equal(Object.hasOwn(operation.patch.content, "name"), true);
  assert.equal(operation.missingFields.includes("description"), false);
  assert.equal(operation.missingFields.includes("ingredients"), false);
  assert.equal(operation.patch.source_hash, existing.source_hash);
  assert.deepEqual(operation.patch.field_hashes, existing.field_hashes);
  assert.deepEqual(operation.patch.content, existing.content);
  assert.equal(operation.patch.translated_at, existing.translated_at);
});

test("a category label rename invalidates its translation without throwing", () => {
  const current = snapshot();
  current.rows = completeStoredRows(current);
  const before = current.rows.find((row) => row.entityType === "category");
  current.categories[0].name = "Nouvelle catégorie";
  const operation = buildPlan(current).operations.find((item) => item.entityType === "category");
  assert.equal(operation.patch.translation_status, "stale");
  assert.equal(operation.patch.source_hash, before.source_hash);
  assert.equal(operation.patch.content.name, before.content.name);
});

test("a changed field with a valid manual override preserves the override without proving other fields", () => {
  const current = snapshot();
  const existing = freshDishRow(current, { manualOverrides: { description: true } });
  current.rows = [existing];
  current.dishes[0].short_description = "Description rÃ©visÃ©e.";
  current.dishes[0].metadata.ingredients = ["IngrÃ©dient rÃ©visÃ©"];

  const operation = dishOperation(buildPlan(current, { now: "2026-07-31T03:00:00.000Z" }));
  assert.equal(operation.patch.translation_status, "stale");
  assert.ok(operation.missingFields.includes("ingredients"));
  assert.equal(operation.missingFields.includes("description"), false);
  assert.equal(operation.patch.source_hash, existing.source_hash);
  assert.deepEqual(operation.patch.field_hashes, existing.field_hashes);
  assert.deepEqual(operation.patch.content, existing.content);
  assert.deepEqual(operation.patch.manual_overrides, { description: true });
  assert.equal(operation.patch.provider, "human");
  assert.equal(operation.patch.translated_at, existing.translated_at);
});

test("an override-only source change preserves its old hash while allowing non-overridden proof", () => {
  const current = snapshot();
  const existing = freshDishRow(current, { manualOverrides: { description: true } });
  current.rows = [existing];
  current.dishes[0].short_description = "Description rÃƒÂ©visÃƒÂ©e.";

  const operation = dishOperation(buildPlan(current, { now: "2026-07-31T03:00:00.000Z" }));
  assert.equal(operation.patch.translation_status, "up_to_date");
  assert.equal(operation.patch.source_hash, sourceHashFor(sourceDishFields(current.dishes[0])));
  assert.equal(operation.patch.field_hashes.description, existing.field_hashes.description);
  assert.equal(operation.patch.content.description, existing.content.description);
  assert.deepEqual(operation.patch.manual_overrides, { description: true });
  assert.equal(operation.patch.translated_at, existing.translated_at);
  assert.deepEqual(operation.missingFields, []);
});

test("partial retranslation updates only fields with explicit current hashes", () => {
  const current = snapshot();
  const existing = freshDishRow(current);
  const oldFields = sourceDishFields(current.dishes[0]);
  current.dishes[0].short_description = "Description rÃ©visÃ©e.";
  current.dishes[0].metadata.ingredients = ["IngrÃ©dient rÃ©visÃ©"];
  current.dishes[0].metadata.options = ["Option rÃ©visÃ©e"];
  const currentFields = sourceDishFields(current.dishes[0]);
  existing.content = {
    ...existing.content,
    description: "Fresh English description",
    options: ["Fresh English option"]
  };
  existing.field_hashes = {
    ...existing.field_hashes,
    description: fieldHashesFor(currentFields).description,
    options: fieldHashesFor(currentFields).options
  };
  current.rows = [existing];

  const operation = dishOperation(buildPlan(current, { now: "2026-07-31T03:00:00.000Z" }));
  assert.equal(operation.patch.translation_status, "stale");
  assert.equal(operation.patch.source_hash, sourceHashFor(oldFields));
  assert.equal(operation.patch.field_hashes.description, fieldHashesFor(currentFields).description);
  assert.equal(operation.patch.field_hashes.options, fieldHashesFor(currentFields).options);
  assert.equal(operation.patch.field_hashes.ingredients, fieldHashesFor(oldFields).ingredients);
  assert.equal(operation.patch.content.description, "Fresh English description");
  assert.deepEqual(operation.patch.content.ingredients, existing.content.ingredients);
  assert.equal(operation.patch.translated_at, existing.translated_at);
});

test("a complete retranslation proves the aggregate source hash and remains idempotent", () => {
  const current = snapshot();
  const existing = freshDishRow(current);
  current.dishes[0].short_description = "Description rÃ©visÃ©e.";
  current.dishes[0].metadata.ingredients = ["IngrÃ©dient rÃ©visÃ©"];
  current.dishes[0].metadata.options = ["Option rÃ©visÃ©e"];
  const fields = sourceDishFields(current.dishes[0]);
  existing.content = {
    ...existing.content,
    description: "Fresh English description",
    ingredients: ["Fresh English ingredient"],
    options: ["Fresh English option"]
  };
  existing.source_hash = sourceHashFor(fields);
  existing.field_hashes = fieldHashesFor(fields);
  existing.translated_at = "2026-07-31T03:00:00.000Z";
  current.rows = [existing];

  const first = dishOperation(buildPlan(current, { now: "2026-07-31T04:00:00.000Z" }));
  assert.equal(first.patch.translation_status, "up_to_date");
  assert.equal(first.patch.source_hash, sourceHashFor(fields));
  assert.deepEqual(first.patch.field_hashes, fieldHashesFor(fields));
  assert.equal(first.patch.translated_at, existing.translated_at);
  assert.equal(first.action, "noop");

  current.rows = [{ ...existing, ...first.patch }];
  const second = dishOperation(buildPlan(current, { now: "2026-07-31T05:00:00.000Z" }));
  assert.equal(second.patch.translation_status, "up_to_date");
  assert.equal(second.action, "noop");
  assert.equal(second.patch.translated_at, existing.translated_at);
});

test("Trouvable and Sauge plans keep dish names out of translated content", () => {
  for (const targetSlug of ["trouvable", "sauge-noire"]) {
    const current = snapshot({ targetSlug });
    current.rows = completeStoredRows(current);
    if (targetSlug === "sauge-noire") {
      current.rows.find((row) => row.entityType === "dish").content.name = "Warm rye bread";
    }
    const plan = buildPlan(current);
    assert.equal(plan.ok, true, JSON.stringify(plan.errors));
    const dish = plan.operations.find((operation) => operation.entityType === "dish");
    assert.equal(Object.hasOwn(dish.patch.content, "name"), targetSlug === "sauge-noire");
    assert.equal(Object.hasOwn(dish.patch.field_hashes, "name"), false);
    assert.equal(dish.patch.source_hash.length, 64);
    assert.equal(Object.hasOwn(dish.patch.field_hashes, "name"), false);
  }
});

test("Trouvable does not require a canonical English dish-name mapping", () => {
  const current = snapshot();
  current.rows = completeStoredRows(current);
  current.dishes[0].slug = "dish-not-in-canonical-map";
  current.dishes[0].name = "Nom français non vérifié";
  const plan = buildPlan(current);
  assert.equal(plan.ok, true, JSON.stringify(plan.errors));
  assert.equal(plan.canonicalCoverage.complete, true);
  assert.equal(Object.hasOwn(dishOperation(plan).patch.content, "name"), false);
});

test("complete stored canonical rows are public-ready immediately", () => {
  const current = snapshot();
  current.categories[0].description = "";
  current.dishes[0].short_description = "";
  current.dishes[0].description = "";
  current.dishes[0].metadata = {};
  current.rows = completeStoredRows(current);
  const plan = buildPlan(current);
  assert.equal(plan.ok, true, JSON.stringify(plan.errors));
  assert.ok(
    plan.operations.every((operation) => operation.patch.translation_status === "up_to_date"),
    JSON.stringify(plan.operations.map((operation) => ({ type: operation.entityType, fields: operation.requiredFields, missing: operation.missingFields, status: operation.patch.translation_status })))
  );
});

test("Maison Élyse real dish coverage has complete English content", () => {
  assert.equal(Object.keys(MAISON_CANONICAL_DISH_SLUGS).length, 12);
  assert.deepEqual(Object.keys(MAISON_CANONICAL_DISH_SLUGS), Object.keys(MAISON_ENGLISH_DISH_CONTENT));
  assert.deepEqual(PUBLIC_MENU_NAME, { fr: "Menu principal", en: "Main Menu" });
  for (const content of Object.values(MAISON_ENGLISH_DISH_CONTENT)) {
    for (const field of ["name", "description", "ingredients", "allergens", "options", "houseNote", "tags"]) {
      assert.ok(content[field], `missing Maison Élyse English ${field}`);
    }
  }
});

test("Maison Elyse canonical identity divergence fails closed even with stored rows", () => {
  for (const mutate of [
    (current) => { current.menu.name = "Menu historique"; },
    (current) => { current.categories[0].name = "Section renommée"; },
    (current) => { current.dishes[0].name = "Plat renommé"; }
  ]) {
    const current = canonicalMaisonSnapshot();
    mutate(current);
    const plan = buildPlan(current);
    assert.equal(plan.ok, false);
    assert.match(plan.errors.join(" "), /canonical|diverge|identity/i);
  }
});

test("Maison Elyse missing canonical content fails closed instead of preserving an old translation", () => {
  const current = canonicalMaisonSnapshot();
  const slug = current.dishes[0].slug;
  const canonical = MAISON_ENGLISH_DISH_CONTENT[slug];
  const previous = canonical.description;
  delete canonical.description;
  try {
    const plan = buildPlan(current);
    assert.equal(plan.ok, false);
    assert.match(plan.errors.join(" "), /canonical.*content|missing/i);
  } finally {
    canonical.description = previous;
  }
});

test("empty source_hash is rejected at the atomic payload boundary for every changed operation", () => {
  const plan = buildPlan(snapshot({ targetSlug: "trouvable" }));
  const invalid = {
    ...plan,
    operations: plan.operations.slice(0, 1).map((operation) => ({
      ...operation,
      action: "insert",
      patch: { ...operation.patch, source_hash: "" }
    }))
  };
  assert.throws(() => buildAtomicApplyPayload([invalid, invalid]), /empty source_hash/i);
});

test("Trouvable only plans readiness when all nine categories and 36 dishes are mapped", () => {
  const current = snapshot();
  current.menu.name = "Menu principal";
  current.categories = Object.keys(TROUVABLE_CANONICAL_NAMES.categories).map((slug, index) => ({
    id: `category-${index}`,
    restaurant_id: current.restaurant.id,
    menu_id: current.menu.id,
    slug,
    name: TROUVABLE_CANONICAL_NAMES.categories[slug].fr,
    description: "Description de section"
  }));
  current.dishes = Object.keys(TROUVABLE_CANONICAL_NAMES.dishes).map((slug, index) => ({
    id: `dish-${index}`,
    restaurant_id: current.restaurant.id,
    menu_id: current.menu.id,
    category_id: current.categories[index % current.categories.length].id,
    slug,
    name: TROUVABLE_CANONICAL_NAMES.dishes[slug].fr,
    short_description: "Description réelle",
    allergens: [],
    metadata: { ingredients: ["Ingredient réel"] }
  }));
  const menuFields = { menuName: current.menu.name };
  current.rows = [
    {
      id: "menu-translation",
      entityType: "menu",
      entityId: current.menu.id,
      translation_status: "up_to_date",
      provider: "canonical-backfill",
      source_hash: sourceHashFor(menuFields),
      field_hashes: fieldHashesFor(menuFields),
      content: { menuName: "Main Menu" },
      manual_overrides: {}
    },
    ...current.categories.map((category) => {
      const fields = { name: category.name, description: category.description };
      return {
        id: `translation-${category.id}`,
        entityType: "category",
        entityId: category.id,
        translation_status: "up_to_date",
        provider: "canonical-backfill",
        source_hash: sourceHashFor(fields),
        field_hashes: fieldHashesFor(fields),
        content: { name: TROUVABLE_CANONICAL_NAMES.categories[category.slug].en, description: "English section description" },
        manual_overrides: {}
      };
    }),
    ...current.dishes.map((dish) => {
      const fields = sourceDishFields(dish);
      return {
        id: `translation-${dish.id}`,
        entityType: "dish",
        entityId: dish.id,
        translation_status: "up_to_date",
        provider: "canonical-backfill",
        source_hash: sourceHashFor(fields),
        field_hashes: fieldHashesFor(fields),
        content: { ...fields, name: TROUVABLE_CANONICAL_NAMES.dishes[dish.slug].en },
        manual_overrides: {}
      };
    })
  ];
  const plan = buildPlan(current);
  assert.equal(plan.ok, true, JSON.stringify(plan.errors));
  assert.deepEqual(plan.canonicalCoverage, { mapped: 46, required: 46, complete: true, missing: [] });
  assert.deepEqual(plan.counts.translations, { menu: 1, categories: 9, dishes: 36 });
  assert.equal(plan.operations.filter((operation) => operation.entityType === "dish").length, 36);
  assert.ok(plan.operations.every((operation) => operation.patch.translation_status === "up_to_date"));
  const smokedMeat = plan.operations.find((operation) => operation.slug === "smoked-meat-saint-laurent");
  const smokedMeatFields = sourceDishFields(current.dishes.find((dish) => dish.slug === "smoked-meat-saint-laurent"));
  assert.equal(smokedMeat.patch.source_hash, sourceHashFor(smokedMeatFields));
  assert.deepEqual(smokedMeat.patch.field_hashes, fieldHashesFor(smokedMeatFields));
});

test("Maison settings patch is preserved and idempotent", () => {
  const current = snapshot({ targetSlug: "maison-elyse" });
  current.menu.settings_json = { allowThemeToggle: true, supportedLocales: ["fr-CA"] };
  const first = buildMenuSettingsPlan(current);
  assert.equal(first.changed, true);
  assert.deepEqual(first.desired, {
    allowThemeToggle: true,
    supportedLocales: ["fr-CA", "en-CA"],
    defaultLocale: "fr-CA"
  });
  assert.equal(first.currentHash, hashTranslationValue({ allowThemeToggle: true, supportedLocales: ["fr-CA"] }));
  assert.equal(first.desiredHash, hashTranslationValue(first.desired));
  current.menu.settings_json = first.desired;
  const second = buildMenuSettingsPlan(current);
  assert.equal(second.changed, false);
  assert.equal(second.currentHash, second.desiredHash);
});

test("manual overrides are preserved without rewriting their hash", () => {
  const existing = {
    id: "existing-row",
    entityType: "dish",
    entityId: "maison-elyse-dish-id",
    translation_status: "up_to_date",
    provider: "human",
    content: { name: "Nom éditorial validé" },
    manual_overrides: { name: true }
  };
  const source = getDishBySlug("ravioles-romarin", "fr");
  const frenchSnapshot = snapshot({
    targetSlug: "maison-elyse",
    rows: [],
    dish: source
  });
  frenchSnapshot.restaurant.name = "Maison Élyse";
  frenchSnapshot.menu.name = "Menu principal";
  frenchSnapshot.categories[0].name = "Entrées";
  frenchSnapshot.categories[0].slug = "entrees";
  frenchSnapshot.dishes = [{
    id: "maison-elyse-dish-id",
    restaurant_id: frenchSnapshot.restaurant.id,
    menu_id: frenchSnapshot.menu.id,
    category_id: frenchSnapshot.categories[0].id,
    slug: "ravioles-de-chevre-frais-miel-de-monteregie",
    name: source.name,
    short_description: source.shortDescription,
    description: source.description,
    allergens: source.allergens,
    metadata: {
      ingredients: source.ingredients,
      options: source.options,
      chefNote: source.chefRecommendation,
      tags: ["Signature"]
    }
  }];
  frenchSnapshot.rows = [existing];

  const plan = buildPlan(frenchSnapshot);
  const dish = plan.operations.find((operation) => operation.entityType === "dish");
  assert.equal(plan.ok, true, JSON.stringify(plan.errors));
  assert.equal(dish.patch.content.name, "Nom éditorial validé");
  assert.equal(dish.patch.manual_overrides.name, true);
  assert.equal(dish.patch.provider, "human");
  assert.equal(dish.patch.translation_status, "up_to_date");
  assert.equal(dish.patch.source_hash, sourceHashFor(sourceDishFields(frenchSnapshot.dishes[0])));
  assert.equal(dish.patch.field_hashes.name, undefined);
});

test("apply payload carries optimistic snapshots for the transactional RPC", () => {
  const current = snapshot({ targetSlug: "sauge-noire" });
  current.rows = completeStoredRows(current);
  current.dishes[0].metadata.ingredients = ["Ingredient modifié"];
  const plan = buildPlan(current);
  assert.equal(plan.ok, true, JSON.stringify(plan.errors));
  const payload = buildAtomicApplyPayload([plan]);
  assert.equal(payload.p_plans.length, 1);
  assert.equal(payload.p_plans[0].expected_menu_updated_at, "2026-07-31T00:00:00.000Z");
  assert.ok(payload.p_plans[0].operations.length > 0);
  const dishOperation = payload.p_plans[0].operations.find((operation) => operation.entity_type === "dish");
  assert.equal(Object.hasOwn(dishOperation.patch.content, "name"), false);
});

test("a new dish row without translated fields does not fabricate translated_at", () => {
  const plan = buildPlan(snapshot({ targetSlug: "trouvable" }), { now: "2026-07-31T03:00:00.000Z" });
  const dish = dishOperation(plan);
  assert.equal(plan.ok, false);
  assert.match(plan.errors.join(" "), /empty source_hash/i);
  assert.equal(dish.patch.translated_at, null);
  assert.equal(dish.patch.translation_status, "stale");
  assert.equal(Object.hasOwn(dish.patch.content, "name"), false);
});

test("update CAS payloads carry the full nullable expected translation snapshot", () => {
  const current = snapshot();
  current.categories = [];
  current.rows = completeStoredRows(current);
  const existing = current.rows.find((row) => row.entityType === "dish");
  assert.ok(existing);
  existing.provider = null;
  existing.translated_at = null;
  current.dishes[0].short_description = "Description rÃ©visÃ©e.";
  const plan = buildPlan(current, { now: "2026-07-31T03:00:00.000Z" });
  const payload = buildAtomicApplyPayload([plan]);
  const operation = payload.p_plans[0].operations.find((item) => item.entity_type === "dish");

  assert.deepEqual(operation.expected, {
    id: existing.id,
    updated_at: existing.updated_at,
    translation_status: existing.translation_status,
    provider: existing.provider,
    source_hash: existing.source_hash,
    field_hashes: existing.field_hashes,
    content: existing.content,
    manual_overrides: existing.manual_overrides,
    error_message: existing.error_message,
    translated_at: existing.translated_at
  });
});

test("live translation apply is transactional and compare-and-swap guarded", () => {
  const historicalMigration = readFileSync(
    new URL("../supabase/migrations/20260731100000_menu_translation_backfill_rpc.sql", import.meta.url),
    "utf8"
  );
  const migration = readFileSync(
    new URL("../supabase/migrations/20260801090000_harden_menu_translation_backfill_rpc.sql", import.meta.url),
    "utf8"
  );
  assert.match(historicalMigration, /owner_apply_menu_translation_backfill\(\s*p_plans jsonb/s);
  assert.doesNotMatch(historicalMigration, /hardened legacy|currently supports only en-CA/i);
  assert.match(migration, /owner_apply_menu_translation_backfill\(\s*p_plans jsonb/s);
  assert.match(migration, /owner_apply_menu_translation_backfill_legacy/s);
  assert.match(migration, /v_field\s+in\s*\('updated_at',\s*'translated_at'\)/s);
  assert.match(migration, /nullif\(v_current->>v_field,\s*''\)::timestamptz/s);
  assert.match(migration, /nullif\(v_expected->>v_field,\s*''\)::timestamptz/s);
  assert.match(
    migration,
    /select\s+legacy\.result_status\s*,\s*legacy\.applied_rows\s+from\s+public\.owner_apply_menu_translation_backfill_legacy\(p_plans\)\s+as\s+legacy/s
  );
  assert.doesNotMatch(
    migration,
    /select\s+result_status\s*,\s*applied_rows\s+from\s+public\.owner_apply_menu_translation_backfill_legacy/s
  );
  assert.match(migration, /expected: null/s);
  assert.match(historicalMigration, /for update/s);
  assert.match(migration, /revoke all on function/s);
  assert.match(migration, /en-CA/s);
  assert.doesNotMatch(migration, /upsert/i);
});

test("incomplete Maison Élyse translation blocks apply planning", () => {
  const source = getDishBySlug("ravioles-romarin", "fr");
  const current = snapshot({ targetSlug: "maison-elyse" });
  current.restaurant.name = "Maison Élyse";
  current.menu.name = "Menu principal";
  current.categories[0].name = "Entrées";
  current.categories[0].slug = "entrees";
  current.dishes[0] = {
    ...current.dishes[0],
    slug: "ravioles-de-chevre-frais-miel-de-monteregie",
    name: source.name,
    short_description: source.shortDescription,
    description: source.description,
    allergens: source.allergens,
    metadata: { ingredients: source.ingredients, options: source.options }
  };
  current.rows = [{
    entityType: "dish",
    entityId: current.dishes[0].id,
    content: {},
    manual_overrides: { options: true }
  }];
  assert.throws(
    () => buildPlan(current),
    /manual override.*options.*usable content/i
  );
});

test("the backfill parser rejects every locale except normalized en-CA", () => {
  for (const locale of ["en", "en-US", "fr-CA", "es-ES", "ar", "", " en-CA", "en-CA ", "en-ca"]) {
    assert.throws(
      () => parseArgs([
        "--environment", "test",
        "--project-ref", "testref123",
        "--allow-project-ref", "testref123",
        "--locale", locale
      ]),
      /only en-CA|Canadian English/i,
      locale || "empty locale"
    );
  }
});

test("locale validation is repeated at argument, snapshot, plan, and payload boundaries", async () => {
  const args = parseArgs([
    "--environment", "test",
    "--project-ref", "testref123",
    "--allow-project-ref", "testref123"
  ]);
  args.locale = "fr-CA";
  assert.match(validateArgs(args).join(" "), /only en-CA|Canadian English/i);
  assert.match(validateSnapshot(snapshot({ locale: "fr-CA" })).join(" "), /only en-CA|Canadian English/i);
  assert.throws(() => buildPlan(snapshot({ locale: "fr-CA" })), /only en-CA|Canadian English/i);

  let readCalls = 0;
  await assert.rejects(
    () => readSnapshot({ from() { readCalls += 1; throw new Error("remote read must not happen"); } }, "trouvable", "fr-CA"),
    /only en-CA|Canadian English/i
  );
  assert.equal(readCalls, 0);

  const validPlan = buildPlan(snapshot());
  validPlan.target.locale = "fr-CA";
  assert.throws(() => buildAtomicApplyPayload([validPlan]), /only en-CA|Canadian English/i);
});

test("preview and production apply are refused before a client or RPC can be reached", async () => {
  let factoryCalls = 0;
  for (const environment of ["preview", "production"]) {
    const argv = [
      "--apply",
      "--environment", environment,
      "--project-ref", `${environment}ref123`,
      "--allow-project-ref", `${environment}ref123`
    ];
    if (environment === "production") {
      argv.push("--authorize-production", "--production-binding", "productionref123");
    }
    const report = await run({
      args: parseArgs(argv),
      env: {
        NEXT_PUBLIC_SUPABASE_URL: `https://${environment}ref123.supabase.co`,
        SUPABASE_SERVICE_ROLE_KEY: "test-only-key",
        VERCEL_ENV: "production",
        VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF: "productionref123"
      },
      clientFactory: async () => {
        factoryCalls += 1;
        throw new Error("remote client must not be created");
      },
      log: () => {}
    });
    assert.equal(report.ok, false);
    assert.match(report.errors.join(" "), /local|test|never.*apply/i);
  }
  assert.equal(factoryCalls, 0);
});

test("an invalid locale refuses before writing a requested report", async () => {
  const reportPath = join(tmpdir(), `vistaire-invalid-locale-${process.pid}.json`);
  rmSync(reportPath, { force: true });
  const args = parseArgs([
    "--environment", "test",
    "--project-ref", "testref123",
    "--allow-project-ref", "testref123",
    "--report", reportPath
  ]);
  args.locale = "en-US";
  try {
    const report = await run({
      args,
      env: { NEXT_PUBLIC_SUPABASE_URL: "https://testref123.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-only-key" },
      clientFactory: async () => { throw new Error("client must not be created"); },
      log: () => {}
    });
    assert.equal(report.ok, false);
    assert.match(report.errors.join(" "), /only en-CA|Canadian English/i);
    assert.equal(existsSync(reportPath), false);
  } finally {
    rmSync(reportPath, { force: true });
  }
});

test("binding checks require an explicit allowlist and keep refs separate from secrets", () => {
  assert.equal(projectRefFromUrl("https://previewref123.supabase.co"), "previewref123");
  assert.equal(projectRefFromUrl("https://example.com"), "");
  const args = parseArgs([
    "--environment", "preview",
    "--project-ref", "previewref123",
    "--allow-project-ref", "previewref123"
  ]);
  assert.deepEqual(validateArgs(args), []);
  assert.match(redactError(new Error("Bearer super-secret-token")), /redacted/);
  assert.doesNotMatch(redactError(new Error("Bearer super-secret-token")), /super-secret-token/);
});

test("production apply requires a proven Vercel environment/ref binding", () => {
  const args = parseArgs([
    "--apply",
    "--environment", "production",
    "--project-ref", "productionref123",
    "--allow-project-ref", "productionref123",
    "--authorize-production",
    "--production-binding", "productionref123"
  ]);
  assert.throws(
    () => assertExplicitBinding({
      args,
      url: "https://productionref123.supabase.co",
      env: { VERCEL_ENV: "preview", VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF: "previewref123" }
    }),
    /local|test|never.*apply/i
  );
  assert.match(validateArgs(args).join(" "), /local|test|never.*apply/i);
});

test("run reports every requested target before refusing an incomplete plan", async () => {
  const tables = new Map();
  for (const targetSlug of ["maison-elyse", "trouvable", "sauge-noire"]) {
    const restaurantId = `${targetSlug}-restaurant`;
    const menuId = `${targetSlug}-menu`;
    tables.set(`${targetSlug}:restaurants`, [{ id: restaurantId, name: targetSlug, slug: targetSlug, status: "active" }]);
    tables.set(`${targetSlug}:menus`, [{
      id: menuId,
      restaurant_id: restaurantId,
      name: "Menu principal",
      slug: "principal",
      status: "published",
      is_primary: true,
      settings_json: { defaultLocale: "fr-CA" }
    }]);
    tables.set(`${targetSlug}:menu_categories`, [{
      id: `${targetSlug}-category`,
      restaurant_id: restaurantId,
      menu_id: menuId,
      name: "Nom réel",
      slug: "category-not-in-canonical-map",
      description: "Description"
    }]);
    tables.set(`${targetSlug}:menu_dishes`, [{
      id: `${targetSlug}-dish`,
      restaurant_id: restaurantId,
      menu_id: menuId,
      category_id: `${targetSlug}-category`,
      slug: "dish-not-in-canonical-map",
      name: "Nom réel",
      short_description: "Description",
      description: "Description",
      allergens: [],
      metadata: {}
    }]);
  }

  const client = {
    from(table) {
      const state = { filters: {} };
      const query = {
        select() { return query; },
        eq(key, value) { state.filters[key] = value; return query; },
        order() { return query; },
        then(resolve, reject) {
          try {
            const candidates = [...tables.entries()].filter(([key]) => key.endsWith(`:${table}`));
            const matching = candidates.find(([, candidateRows]) => candidateRows.some((row) =>
              Object.entries(state.filters).every(([key, value]) => row[key] === value)));
            const rows = matching?.[1] ?? [];
            return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
          } catch (error) {
            return Promise.reject(error).then(resolve, reject);
          }
        }
      };
      return query;
    }
  };
  const logs = [];
  let rpcCalls = 0;
  client.rpc = async () => {
    rpcCalls += 1;
    return { data: [{ result_status: "applied", applied_rows: 999 }], error: null };
  };
  const args = parseArgs([
    "--environment", "test",
    "--project-ref", "testref123",
    "--allow-project-ref", "testref123"
  ]);
  const report = await run({
    args,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://testref123.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-only-key"
    },
    clientFactory: async () => client,
    log: (value) => logs.push(value)
  });

  assert.equal(report.ok, false);
  assert.deepEqual(report.targets.map((target) => target.slug), ["maison-elyse", "trouvable", "sauge-noire"]);
  assert.match(report.errors.join(" "), /canonical|Maison/i);
  assert.equal(report.note, "dry-run refused; no rows were written");
  assert.equal(logs.length, 1);

  const applyReport = await run({
    args: { ...args, apply: true },
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://testref123.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-only-key"
    },
    clientFactory: async () => client,
    log: () => {}
  });
  assert.equal(applyReport.ok, false);
  assert.equal(applyReport.note, "apply refused; no rows were written");
  assert.equal(rpcCalls, 0);
});
