import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const menuPath = "components/menu/TrouvablePremiumMenuExperience.tsx";
const detailPath = "components/menu/TrouvableDishDetailExperience.tsx";
const sheetPath = "components/menu/PremiumDishDetailsSheet.tsx";
const tagsPath = "components/menu/PremiumDishTags.tsx";

test("menu cards show only the 3D badge and no option tags or details trigger", async () => {
  const source = await readFile(menuPath, "utf8");

  assert.match(source, /DishCard3dBadge/);
  assert.match(source, /hasPublicMenu3d\(dish\)/);
  assert.doesNotMatch(source, /PremiumDishCardOptionTags[\s\S]{0,180}items=\{dish\.options\}/);
  assert.match(source, /PremiumDishCardOptionTags[\s\S]{0,180}items=\{selectedDish\.options\}/);
  assert.doesNotMatch(source, /cardDetailsTrigger/);
  assert.doesNotMatch(source, /openDishDetailsPopup\(dish\)/);
  assert.doesNotMatch(source, /copy\.ingredientsCount\(/);
});

test("premium details sheet renders grouped dish metadata", async () => {
  const sheetSource = await readFile(sheetPath, "utf8");
  const tagsSource = await readFile(tagsPath, "utf8");

  assert.match(sheetSource, /role="dialog"/);
  assert.match(sheetSource, /aria-modal="true"/);
  assert.match(sheetSource, /dish\.description/);
  assert.match(sheetSource, /dish\.houseNote/);
  assert.match(sheetSource, /PremiumDishTagGroup/);
  assert.match(sheetSource, /copy\.detailCompositionLabel/);
  assert.match(sheetSource, /copy\.detailAllergensLabel/);
  assert.match(sheetSource, /copy\.detailOptionsLabel/);
  assert.match(sheetSource, /itemTitlePrefix=\{copy\.allergenTitlePrefix\}/);
  assert.match(tagsSource, /assignPremiumTagAccents/);
  assert.match(tagsSource, /chipAccent/);
  assert.match(tagsSource, /kind === "allergen"/);
  assert.doesNotMatch(tagsSource, /Allerg[eè]ne\s*:/);
});

test("details popup opens from the dish sheet without a card-level trigger", async () => {
  const menuSource = await readFile(menuPath, "utf8");
  const detailSource = await readFile(detailPath, "utf8");

  assert.match(menuSource, /setDishSubSheet\("details"\)/);
  assert.match(menuSource, /PremiumDishDetailsSheet/);
  assert.doesNotMatch(menuSource, /cardDetailsTrigger/);
  assert.doesNotMatch(menuSource, /openDishDetailsPopup\(dish\)/);
  assert.match(detailSource, /PremiumDishDetailsSheet/);
  assert.match(detailSource, /copy\.viewDetails/);
});

test("review popup remains separate from premium details sheet", async () => {
  const menuSource = await readFile(menuPath, "utf8");

  assert.match(menuSource, /renderReviewSheet/);
  assert.match(menuSource, /dishSubSheet === "review"/);
  assert.match(menuSource, /PremiumDishDetailsSheet/);
  assert.match(menuSource, /dishSubSheet === "details"/);
});
