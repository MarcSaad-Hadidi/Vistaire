import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const pagePath = "app/menu/[slug]/page.tsx";
const dishPagePath = "app/menu/[slug]/dishes/[dishSlug]/page.tsx";
const demoPagePath = "app/demo/page.tsx";
const englishDemoPagePath = "app/en/vistaire-menu/page.tsx";
const componentPath = "components/menu/MaisonElyseQrMenu.tsx";
const cssPath = "components/menu/MaisonElyseQrMenu.module.css";
const dishDetailPath = "components/menu/MaisonElyseDishDetail.tsx";
const dishDetailCssPath = "components/menu/MaisonElyseDishDetail.module.css";
const demoShowcasePath = "components/vistaire-preview/DemoPhoneShowcase.tsx";
const demoShowcaseCssPath =
  "components/vistaire-preview/DemoPhoneShowcase.module.css";

test("Maison Elyse public menu is the only dedicated QR table experience", async () => {
  const source = await readFile(pagePath, "utf8");

  assert.match(source, /MaisonElyseQrMenu/);
  assert.match(source, /menu\.slug === "maison-elyse"/);
  assert.match(source, /startFullMenu=\{query\.view === "carte"\}/);
  assert.match(source, /PublicMenuRenderer/);
  assert.match(source, /getPublishedMenuUiConfigForRestaurant/);
});

test("Maison Elyse dish detail is dedicated while generic public details remain intact", async () => {
  const [route, component, css] = await Promise.all([
    readFile(dishPagePath, "utf8"),
    readFile(dishDetailPath, "utf8"),
    readFile(dishDetailCssPath, "utf8")
  ]);

  assert.match(route, /MaisonElyseDishDetail/);
  assert.match(route, /menu\.slug === "maison-elyse"/);
  assert.match(route, /PublicDishDetailExperience/);
  assert.match(route, /getPublishedMenuUiConfigForRestaurant/);

  for (const text of [
    "Retour",
    "Voir en 3D",
    "Ingr",
    "Allerg",
    "Options",
    "Note du chef",
    "Plats signatures"
  ]) {
    assert.match(component, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(component, /dynamic<DishModelViewerProps>/);
  assert.match(component, /ssr: false/);
  assert.match(component, /showModelViewer/);
  assert.match(component, /MODEL_VIEWER_ID/);
  assert.match(component, /aria-controls=\{MODEL_VIEWER_ID\}/);
  assert.match(component, /aria-expanded=\{showModelViewer\}/);
  assert.match(component, /hasReal3d/);
  assert.match(component, /hasRealAr/);
  assert.match(component, /buildPublicMenuPath/);
  assert.match(component, /view", "carte"/);
  assert.match(component, /modelViewerDishFromPublicDish/);
  assert.match(component, /LazyDishModelViewer/);
  assert.doesNotMatch(component, /Actions du plat/);
  assert.doesNotMatch(component, /stickyActions/);
  assert.doesNotMatch(component, /<model-viewer/);
  assert.doesNotMatch(component, /prepareDishAssetIntent/);
  assert.doesNotMatch(component, /warmDishAssets/);
  assert.doesNotMatch(component, /prefetchUsdzForQuickLook/);
  assert.doesNotMatch(component, /["'`](?:https?:\/\/|\/)[^"'`]*\.glb/);
  assert.doesNotMatch(component, /["'`](?:https?:\/\/|\/)[^"'`]*\.usdz/);

  assert.match(css, /\.hero/);
  assert.doesNotMatch(css, /\.stickyActions/);
  assert.match(css, /\.modelPanel/);
  assert.match(css, /\.detailSections/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /@media \(max-width: 430px\)/);
});

test("Maison Elyse QR menu starts with welcome and visual category navigation", async () => {
  const [component, css] = await Promise.all([
    readFile(componentPath, "utf8"),
    readFile(cssPath, "utf8")
  ]);

  for (const text of [
    "Bienvenue chez Maison Élyse",
    "Carte à table",
    "Plats signatures",
    "Voir toute la carte",
    "Maison Élyse",
    "LA COLLECTION",
    "LA CARTE",
    "Une sélection de créations servies par section",
    "POUR COMMENCER",
    "LA SIGNATURE",
    "LA DOUCEUR",
    "LE BAR"
  ]) {
    assert.match(component, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(component, /getVisiblePublicMenuCategories/);
  assert.match(component, /getPublicMenuCategoryGroups/);
  assert.doesNotMatch(component, /heroDish/);
  assert.doesNotMatch(component, /heroVisual/);
  assert.doesNotMatch(component, /Découvrir la carte/);
  assert.doesNotMatch(component, /Voir les sections/);
  assert.doesNotMatch(component, /Retour aux sections/);
  assert.doesNotMatch(component, /Choisir une section/);
  assert.doesNotMatch(component, /La carte Maison Élyse/);
  assert.doesNotMatch(component, /styles\.context/);
  assert.match(component, /ENTRY_PREVIEW_EXCLUDED_DISH_SLUGS/);
  assert.match(component, /homard-bisque/);
  assert.match(component, /canAppearInEntryPreview/);
  assert.match(component, /DishSection/);
  assert.match(component, /visibleDishSections/);
  assert.match(component, /categoryAnchorId/);
  assert.match(component, /sectionDomId/);
  assert.match(component, /data-testid=\{`maison-section-\$\{categoryAnchorId\(category\.label\)\}`\}/);
  assert.match(component, /id=\{sectionId\}/);
  assert.match(component, /headingId/);
  assert.match(component, /menuCover/);
  assert.match(component, /menuCoverCopy/);
  assert.match(component, /menuRestaurantName/);
  assert.match(component, /bottomBar/);
  assert.match(component, /bottomSheet/);
  assert.match(component, /sheetList/);
  assert.match(component, /filterGrid/);
  assert.match(component, /activeFilterNotice/);
  assert.doesNotMatch(component, /categoryPills/);
  assert.doesNotMatch(component, /quickFilterBar/);
  assert.doesNotMatch(component, /preferencePanel/);
  assert.match(css, /\.sectionedDishList/);
  assert.match(css, /\.dishSectionHeader/);
  assert.match(css, /scroll-margin-top/);
  assert.match(css, /\.menuCover/);
  assert.match(css, /\.menuCoverCopy/);
  assert.match(css, /\.menuRestaurantName/);
  assert.match(css, /\.bottomBar/);
  assert.match(css, /\.bottomSheet/);
  assert.match(css, /\.sheetList/);
  assert.match(css, /\.filterGrid/);
  assert.match(css, /\.activeFilterNotice/);
  assert.doesNotMatch(css, /\.categoryPills/);
  assert.doesNotMatch(css, /\.quickFilterBar/);
  assert.doesNotMatch(css, /\.preferencePanel/);
  assert.doesNotMatch(css, /\.context/);
  assert.match(css, /\.categoryGrid/);
  assert.match(css, /\.categoryCard/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /@media \(max-width: 430px\)/);
});

test("Maison Elyse QR menu keeps compact filters and Google Reviews without 3D autoload", async () => {
  const component = await readFile(componentPath, "utf8");

  for (const text of [
    "Recommandés",
    "Signature",
    "3D / AR",
    "Disponibles",
    "Sans gluten",
    "Sans lactose",
    "Sans fruits à coque",
    "Sans crustacés",
    "Réinitialiser",
    "Appliquer",
    "Aucun plat dans cette sélection"
  ]) {
    assert.match(component, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(component, /Filtrer la carte/);
  assert.match(component, /La carte/);
  assert.match(component, /Filtre actif/);
  assert.doesNotMatch(component, /Tous les plats/);
  assert.doesNotMatch(component, /Les créations Maison Élyse/);
  assert.doesNotMatch(component, /plats disponibles/);
  assert.doesNotMatch(component, /plat disponible/);
  assert.doesNotMatch(component, /Sans lactose \/ laitiers/);
  assert.doesNotMatch(component, /Filtres précis/);
  assert.match(component, /Sans œufs/);
  assert.match(component, /Sans sésame/);
  assert.match(component, /Sans soja/);
  assert.match(component, /Sans poisson/);
  assert.match(component, /GoogleReviewCard/);
  assert.match(component, /FILTER_OPTIONS/);
  assert.match(component, /activeSheet/);
  assert.doesNotMatch(component, /QUICK_FILTERS/);
  assert.doesNotMatch(component, /PREFERENCE_FILTERS/);
  assert.doesNotMatch(component, /showDetailFilters/);
  assert.match(component, /googleReview=\{menu\.googleReview\}/);
  assert.match(component, /restaurantId=\{menu\.restaurantId\}/);
  assert.match(component, /restaurantName=\{menu\.name\}/);
  assert.match(component, /source=\{menu\.source\}/);
  assert.doesNotMatch(component, /DishModelViewer/);
  assert.doesNotMatch(component, /<model-viewer/);
  assert.doesNotMatch(component, /@google\/model-viewer/);
  assert.doesNotMatch(component, /["'`](?:https?:\/\/|\/)[^"'`]*\.glb/);
  assert.doesNotMatch(component, /["'`](?:https?:\/\/|\/)[^"'`]*\.usdz/);
});

test("/demo and /en/vistaire-menu use the Maison Elyse phone showcase instead of the legacy preview UI", async () => {
  const [demoPage, englishDemoPage, menuComponent, menuCss, showcase, showcaseCss] =
    await Promise.all([
      readFile(demoPagePath, "utf8"),
      readFile(englishDemoPagePath, "utf8"),
      readFile(componentPath, "utf8"),
      readFile(cssPath, "utf8"),
      readFile(demoShowcasePath, "utf8"),
      readFile(demoShowcaseCssPath, "utf8")
    ]);

  assert.match(demoPage, /DemoPhoneShowcase/);
  assert.match(demoPage, /getPublicMenuBySlug\("maison-elyse"\)/);
  assert.doesNotMatch(demoPage, /VistaireMenuPreview/);
  assert.match(englishDemoPage, /DemoPhoneShowcase/);
  assert.match(englishDemoPage, /getPublicMenuBySlug\("maison-elyse"\)/);
  assert.doesNotMatch(englishDemoPage, /VistaireMenuPreview/);

  assert.match(menuComponent, /displayMode\?: "public" \| "phone-preview"/);
  assert.match(menuComponent, /showGoogleReview\?: boolean/);
  assert.match(menuComponent, /styles\.phonePreview/);
  assert.match(menuCss, /\.phonePreview/);

  assert.match(showcase, /MaisonElyseQrMenu/);
  assert.match(showcase, /displayMode="phone-preview"/);
  assert.match(showcase, /showGoogleReview=\{false\}/);
  assert.doesNotMatch(showcase, /startFullMenu/);
  assert.match(showcase, /data-testid="demo-phone-mockup"/);
  assert.match(showcase, /data-phone-mockup-scroll/);
  assert.doesNotMatch(showcase, /VistaireMenuPreview/);
  assert.doesNotMatch(showcase, /DishModelViewer/);
  assert.doesNotMatch(showcase, /D.mo interactive Vistaire/);
  assert.doesNotMatch(showcase, /Aper.u t.l.phone/);
  assert.doesNotMatch(showcase, /["'`](?:https?:\/\/|\/)[^"'`]*\.glb/);
  assert.doesNotMatch(showcase, /["'`](?:https?:\/\/|\/)[^"'`]*\.usdz/);

  assert.match(showcaseCss, /\.showcaseFrame[\s\S]*grid-template-columns/);
  assert.match(showcaseCss, /\.phoneShell/);
  assert.match(showcaseCss, /\.phoneViewport[\s\S]*overflow-y:\s*auto/);
  assert.match(showcaseCss, /\.phoneViewport[\s\S]*transform:\s*translateZ\(0\)/);
  assert.match(showcaseCss, /@media \(max-width: 560px\)/);
});
