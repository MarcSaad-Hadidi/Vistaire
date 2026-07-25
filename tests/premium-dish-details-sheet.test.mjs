import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const menuPath = "components/menu/TrouvablePremiumMenuExperience.tsx";
const detailPath = "components/menu/TrouvableDishDetailExperience.tsx";
const sheetPath = "components/menu/PremiumDishDetailsSheet.tsx";
const allergenDisclosurePath = "components/menu/AllergenDisclosure.tsx";
const tagsPath = "components/menu/PremiumDishTags.tsx";
const menuCssPath = "components/menu/TrouvablePremiumMenuExperience.module.css";

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
  assert.match(sheetSource, /AllergenDisclosure/);
  assert.match(sheetSource, /locale=\{locale\}/);
  assert.match(sheetSource, /includeWarning\s*\/>/);
  assert.match(sheetSource, /copy\.detailCompositionLabel/);
  assert.match(sheetSource, /copy\.detailOptionsLabel/);
  assert.match(tagsSource, /assignPremiumTagAccents/);
  assert.match(tagsSource, /chipAccent/);
  assert.match(tagsSource, /kind === "allergen"/);
  assert.doesNotMatch(tagsSource, /Allerg[eè]ne\s*:/);
});

test("allergen disclosure hides the unconfirmed-information block", async () => {
  const source = await readFile(allergenDisclosurePath, "utf8");

  assert.doesNotMatch(source, /groups\.unknownCount > 0/);
  assert.doesNotMatch(source, /copy\.unknown/);
  assert.doesNotMatch(source, /copy\.unknownBody/);
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

test("review stars keep selected state visible in light and dark themes", async () => {
  const css = await readFile(menuCssPath, "utf8");

  assert.match(css, /\.reviewStars button\[aria-pressed="true"\]/);
  assert.match(css, /--review-star-active:\s*#c98f16/);
  assert.match(css, /--review-star-inactive:\s*rgba\(255,\s*255,\s*255,\s*0\.24\)/);
  assert.match(css, /--review-star-active-shadow:\s*rgba\(201,\s*143,\s*22,\s*0\.38\)/);
  assert.match(
    css,
    /\.page\[data-user-theme="light"\] \.reviewStars button\[aria-pressed="true"\]/
  );
  assert.match(css, /--review-star-active:\s*#9f6900/);
  assert.match(css, /--review-star-inactive:\s*rgba\(35,\s*26,\s*13,\s*0\.26\)/);
});
