import test from "node:test";
import assert from "node:assert/strict";
import {
  BADGE_ALLOWLIST,
  CANONICAL_DISHES,
  CANONICAL_SECTIONS,
  ALLERGEN_IDS,
  canonicalDishDisplayOrder,
  canonicalDishSlug,
  dishPayload,
  normalizeKey,
  validateCanonicalDataset
} from "../scripts/owner/sync-sauge-noire-menu.mjs";

test("Sauge Noire canonical dataset has the required shape", () => {
  assert.equal(CANONICAL_SECTIONS.length, 7);
  assert.equal(CANONICAL_DISHES.length, 36);
  assert.equal(new Set(CANONICAL_DISHES.map((item) => normalizeKey(item.name))).size, 36);
  assert.deepEqual(
    new Set(CANONICAL_DISHES.flatMap((item) => item.badges)),
    new Set(BADGE_ALLOWLIST)
  );
});

test("canonical validation accepts custom allergens outside the fixed registry", () => {
  assert.deepEqual(validateCanonicalDataset(), []);
  assert.deepEqual(
    CANONICAL_DISHES.find((item) => item.name === "Crabe des neiges").customAllergens,
    ["Céleri"]
  );
});

test("allergen, media, availability and price payloads are fail-closed", () => {
  const source = CANONICAL_DISHES.find((item) => item.name === "Betterave sous la cendre");
  const payload = dishPayload(source, "category-id", {
    imageUrl: "https://example.invalid/wrong-photo.jpg",
    model3dUrl: "https://example.invalid/wrong-model.glb",
    keepThisMetadata: true
  });

  assert.equal(payload.image_url, null);
  assert.equal(payload.has_immersive_view, false);
  assert.equal(payload.is_available, true);
  assert.equal(payload.metadata.photoStatus, "planned");
  assert.equal(payload.metadata.displayPriceMode, "auto");
  assert.equal(payload.metadata.keepThisMetadata, true);
  assert.equal("imageUrl" in payload.metadata, false);
  assert.equal("model3dUrl" in payload.metadata, false);
  assert.equal(payload.allergen_declarations.length, ALLERGEN_IDS.length);
  assert.equal(payload.allergen_declarations.find((item) => item.allergenId === "gluten")?.status, "confirmed_free");
  assert.equal(payload.allergen_declarations.find((item) => item.allergenId === "dairy")?.status, "contains");
  assert.equal(payload.allergen_declarations.find((item) => item.allergenId === "eggs")?.status, "unknown");

  const crab = CANONICAL_DISHES.find((item) => item.name === "Crabe des neiges");
  assert.deepEqual(dishPayload(crab, "category-id").metadata.customAllergens, ["Céleri"]);
  assert.deepEqual(dishPayload(crab, "category-id").allergens, ["crustaceans", "tree nuts", "Céleri"]);
});

test("canonical anomaly fixes preserve the bœuf ID path and dish order", () => {
  const beef = CANONICAL_DISHES.find((item) => item.price === 23);
  const night = CANONICAL_DISHES.find((item) => item.name.startsWith("Nuit"));

  assert.equal(canonicalDishSlug(beef), "boeuf-cru-au-couteau");
  assert.equal(canonicalDishDisplayOrder(beef), 3);
  assert.equal(
    dishPayload(beef, "category-id").display_order,
    3
  );
  assert.equal(
    night.description,
    "Le cocktail Nuit d’ambre marie du rhum brun, du café, du cacao et de l’orange brûlée."
  );
});

test("normalization treats accent, apostrophe and dash variants as the same logical key", () => {
  assert.equal(normalizeKey("À côté & desserts"), normalizeKey("A COTE desserts"));
  assert.equal(normalizeKey("Nuit d’ambre"), normalizeKey("Nuit d-ambre"));
});

test("Sans gluten is only represented with gluten confirmed_free", () => {
  const invalid = CANONICAL_DISHES.map((item) => ({
    ...item,
    allergensContains: [...item.allergensContains],
    allergensConfirmedFree: [...item.allergensConfirmedFree]
  }));
  const target = invalid.find((item) => item.name === "Betterave sous la cendre");
  target.allergensConfirmedFree = [];
  assert.match(validateCanonicalDataset(invalid).join("\n"), /Sans gluten requires gluten confirmed_free/);
});
