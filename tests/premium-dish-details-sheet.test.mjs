import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const menuPath = "components/menu/TrouvablePremiumMenuExperience.tsx";
const detailPath = "components/menu/TrouvableDishDetailExperience.tsx";
const detailSurfacePath = "components/menu/TrouvableDishDetailSurface.tsx";
const sheetPath = "components/menu/PremiumDishDetailsSheet.tsx";
const allergenDisclosurePath = "components/menu/AllergenDisclosure.tsx";
const tagsPath = "components/menu/PremiumDishTags.tsx";
const menuCssPath = "components/menu/TrouvablePremiumMenuExperience.module.css";

test("menu cards show only the 3D badge and no option tags or details trigger", async () => {
  const [source, surfaceSource] = await Promise.all([
    readFile(menuPath, "utf8"),
    readFile(detailSurfacePath, "utf8")
  ]);

  assert.match(source, /DishCard3dBadge/);
  assert.match(source, /hasPublicMenu3d\(dish\)/);
  assert.doesNotMatch(source, /PremiumDishCardOptionTags[\s\S]{0,180}items=\{dish\.options\}/);
  assert.match(surfaceSource, /PremiumDishCardOptionTags[\s\S]{0,180}items=\{dish\.options\}/);
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
  const surfaceSource = await readFile(detailSurfacePath, "utf8");

  assert.match(menuSource, /setDishSubSheet\("details"\)/);
  assert.match(menuSource, /PremiumDishDetailsSheet/);
  assert.doesNotMatch(menuSource, /cardDetailsTrigger/);
  assert.doesNotMatch(menuSource, /openDishDetailsPopup\(dish\)/);
  assert.match(detailSource, /PremiumDishDetailsSheet/);
  assert.match(surfaceSource, /copy\.viewDetails/);
});

test("Google Review stays on the shared card instead of a local review popup", async () => {
  const menuSource = await readFile(menuPath, "utf8");

  assert.match(menuSource, /<GoogleReviewCard/);
  assert.doesNotMatch(menuSource, /renderReviewSheet/);
  assert.doesNotMatch(menuSource, /dishSubSheet === "review"/);
  assert.match(menuSource, /PremiumDishDetailsSheet/);
  assert.match(menuSource, /dishSubSheet === "details"/);
});

test("Trouvable menu sheet and direct route share one dish detail content surface", async () => {
  const [menuSource, detailSource, surfaceSource] = await Promise.all([
    readFile(menuPath, "utf8"),
    readFile(detailPath, "utf8"),
    readFile(detailSurfacePath, "utf8")
  ]);

  assert.match(menuSource, /<TrouvableDishDetailSurface/);
  assert.match(detailSource, /<TrouvableDishDetailSurface/);
  assert.equal(
    (menuSource.match(/<TrouvableDishDetailSurface/g) ?? []).length,
    1
  );
  assert.equal(
    (detailSource.match(/<TrouvableDishDetailSurface/g) ?? []).length,
    1
  );

  for (const contract of [
    /dish\.imageUrl/,
    /dish\.category/,
    /dish\.name/,
    /dish\.options/,
    /AllergenWarning/,
    /copy\.viewDetails/,
    /copy\.threeD/
  ]) {
    assert.match(surfaceSource, contract);
  }

  assert.doesNotMatch(menuSource, /className=\{styles\.detailVisual\}/);
  assert.doesNotMatch(detailSource, /className=\{styles\.detailVisual\}/);
  assert.match(menuSource, /<PremiumDishDetailsSheet[\s\S]*dish=\{detailsDish\}/);
  assert.match(detailSource, /<PremiumDishDetailsSheet[\s\S]*dish=\{activeDish\}/);
});

test("Trouvable wrappers share the immersive panel while Google Review uses the shared card", async () => {
  const [menuSource, detailSource, surfaceSource] = await Promise.all([
    readFile(menuPath, "utf8"),
    readFile(detailPath, "utf8"),
    readFile(detailSurfacePath, "utf8")
  ]);

  for (const source of [menuSource, detailSource]) {
    assert.match(source, /<TrouvableImmersivePanelBody/);
    assert.match(source, /<GoogleReviewCard/);
    assert.doesNotMatch(source, /<TrouvableDishReviewPanelBody/);
    assert.doesNotMatch(source, /className=\{styles\.reviewPanel\}/);
    assert.doesNotMatch(source, /className=\{styles\.inlineModelViewer\}/);
  }

  assert.match(
    surfaceSource,
    /export function TrouvableImmersivePanelBody/
  );
  assert.doesNotMatch(surfaceSource, /TrouvableDishReviewPanelBody/);
  assert.doesNotMatch(surfaceSource, /className=\{styles\.reviewPanel\}/);
  assert.match(surfaceSource, /className=\{styles\.inlineModelViewer\}/);
  assert.match(surfaceSource, /className=\{styles\.arBrowserFallback\}/);
  assert.doesNotMatch(surfaceSource, /data-google-review-action="true"/);

  assert.match(menuSource, /role="dialog"/);
  assert.match(await readFile(sheetPath, "utf8"), /role="dialog"/);
  assert.doesNotMatch(menuSource, /className=\{styles\.reviewSheet\}/);
  assert.doesNotMatch(detailSource, /className=\{styles\.reviewSheet\}/);
});

test("removed local review star styles stay gone", async () => {
  const css = await readFile(menuCssPath, "utf8");

  assert.doesNotMatch(css, /\.reviewStars button\[aria-pressed="true"\]/);
  assert.doesNotMatch(css, /--review-star-active:/);
  assert.doesNotMatch(css, /\.reviewTextarea/);
  assert.doesNotMatch(css, /\.reviewPostButton/);
});
