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
const ownerCreateFormPath = "components/owner/RestaurantCreateForm.tsx";
const publicMenuPath = "lib/menu/publicMenu.ts";
const themePresetPath = "lib/menu/menuThemePresets.ts";
const menuExperiencePath = "lib/menu/trouvableMenuExperience.ts";
const renderContextPath = "lib/menu/publicMenuRenderContext.ts";
const themePath = "lib/menu/maisonElyseTheme.ts";

test("Maison Elyse public menu is the only dedicated QR table experience", async () => {
  const [source, renderContext] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(renderContextPath, "utf8")
  ]);

  assert.match(source, /MaisonElyseQrMenu/);
  assert.match(source, /resolvePublicMenuRenderContext/);
  assert.match(renderContext, /resolvePublicMenuExperience/);
  assert.match(source, /experience\.kind === "maison-elyse"/);
  assert.doesNotMatch(source, /startFullMenu/);
  assert.match(renderContext, /view: query\.view/);
  assert.match(source, /PublicMenuRenderer/);
  assert.match(renderContext, /getPublishedMenuUiConfigForRestaurant/);
});

test("Maison Elyse maps the resolved owner palette into its skin variables", async () => {
  const [source, css, theme] = await Promise.all([
    readFile(componentPath, "utf8"),
    readFile(cssPath, "utf8"),
    readFile(themePath, "utf8")
  ]);

  for (const variable of [
    "--elyse-black",
    "--elyse-bg",
    "--elyse-surface",
    "--elyse-surface-elevated",
    "--elyse-white",
    "--elyse-text",
    "--elyse-muted",
    "--elyse-gold",
    "--elyse-border",
    "--elyse-overlay",
    "--elyse-focus"
  ]) {
    assert.match(theme, new RegExp(`"${variable}"`));
    assert.match(css, new RegExp(`${variable}:\\s*var\\(--menu-`));
  }
  assert.match(source, /maisonElyseThemeStyle/);
  assert.doesNotMatch(source, /--elyse-(?:cream|champagne|bronze)/);
  assert.doesNotMatch(css, /--elyse-(?:cream|champagne|bronze)/);
});

test("Maison Elyse keeps one canonical neutral black and gold palette", async () => {
  const [preset, experience, menuCss, detailCss] = await Promise.all([
    readFile(themePresetPath, "utf8"),
    readFile(menuExperiencePath, "utf8"),
    readFile(cssPath, "utf8"),
    readFile(dishDetailCssPath, "utf8")
  ]);

  assert.match(preset, /MAISON_ELYSE_PALETTE/);
  assert.match(preset, /background:\s*"#000000"/);
  assert.match(preset, /surface:\s*"#0A0A0A"/);
  assert.match(preset, /accent:\s*"#C9A45C"/);
  assert.match(experience, /isMaisonElysePublicMenu\(menu\)/);
  assert.match(experience, /MAISON_ELYSE_PALETTE/);
  for (const css of [menuCss, detailCss]) {
    assert.match(css, /--elyse-bg/);
    assert.match(css, /--elyse-surface-elevated/);
    assert.match(css, /--elyse-gold/);
    assert.doesNotMatch(css, /#(?:050403|0b0705|120c08|191109|fff7ea|f4ebdd|bfaf98|e8cf9b|d2a45e|8a6338)/i);
    assert.doesNotMatch(css, /rgba\((?:35,\s*19,\s*10|25,\s*17,\s*9|18,\s*11,\s*7|10,\s*7,\s*5)/);
  }
});

test("Maison Elyse demo public menu can be built with localized sample data", async () => {
  const source = await readFile(publicMenuPath, "utf8");

  assert.match(source, /function demoMenu\(slug: string, locale: Locale = "fr"\)/);
  assert.match(source, /getRestaurant\(locale\)/);
  assert.match(source, /getAllDishes\(locale\)/);
  assert.match(source, /getCategoryBySlug\(dish\.categorySlug \?\? "", locale\)/);
  assert.match(source, /recommendedTag/);
  assert.match(source, /unavailableTag/);
  assert.match(source, /getPublicMenuBySlug\([\s\S]*locale: Locale \| string = DEFAULT_LOCALE/);
  assert.match(source, /const resolvedLocale = normalizeLocale\(locale\)/);
  assert.match(source, /return demoMenu\(slug, resolvedLocale\)/);
  assert.match(source, /dependencies\.readRows<PublicMenuRow>\(\{ table: "restaurants"[\s\S]*filters: \{ slug \}[\s\S]*limit: 1/);
  for (const table of ["menus", "menu_categories", "menu_dishes", "menu_ui_configs"]) {
    assert.match(source, new RegExp(`table: "${table}"[\\s\\S]*?filters: \\{ restaurant_id: restaurantId \\}`));
  }
  assert.match(source, /dependencies\.nodeEnv === "production"/);
  assert.doesNotMatch(source, /readSupabaseRows\(/);
  assert.doesNotMatch(source, /if \(slug === "maison-elyse"\) \{\s*return demoMenu\(slug, resolvedLocale\);\s*\}\s*\n\s*const restaurantsResult/);
  assert.doesNotMatch(source, /if \(restaurantId === getDemoRestaurantId\(\)\) \{\s*return demoMenu/);
  assert.match(source, /isDemoRestaurant && !primaryMenu && !hasScopedDishRows[\s\S]*return localDemo\(\)/);
  assert.equal((source.match(/includeUnavailableDishes: true/g) ?? []).length, 2);
});

test("Maison Elyse dish detail is dedicated while generic public details remain intact", async () => {
  const [route, component, css] = await Promise.all([
    readFile(dishPagePath, "utf8"),
    readFile(dishDetailPath, "utf8"),
    readFile(dishDetailCssPath, "utf8")
  ]);

  assert.match(route, /MaisonElyseDishDetail/);
  assert.match(route, /resolvePublicMenuExperience/);
  assert.match(route, /experience\.kind === "maison-elyse"/);
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

test("Maison Elyse QR menu starts directly with the complete menu", async () => {
  const [component, css] = await Promise.all([
    readFile(componentPath, "utf8"),
    readFile(cssPath, "utf8")
  ]);

  assert.match(component, /useState<string>\(ALL_CATEGORY_ID\)/);
  assert.match(component, /LA COLLECTION/);
  assert.match(component, /LA CARTE/);
  assert.match(component, /DishSection/);
  assert.match(component, /visibleDishSections/);
  assert.match(component, /GoogleReviewCard/);
  assert.match(component, /MENU_LOCALE_STORAGE_KEY/);
  assert.match(component, /FILTER_OPTIONS/);
  assert.match(component, /backToTop/);
  assert.match(component, /scrollToTop/);
  assert.match(component, /closest<HTMLElement>\("\[data-phone-mockup-scroll\]"\)/);
  assert.match(component, /getPhonePreviewScrollTarget/);
  assert.match(component, /menuCover/);
  assert.match(component, /bottomBar/);
  assert.match(component, /bottomSheet/);
  assert.doesNotMatch(component, /startFullMenu/);
  assert.doesNotMatch(component, /activeCategory[^\n]*null/);
  assert.doesNotMatch(component, /!activeCategory/);
  assert.doesNotMatch(component, /Bienvenue chez Maison/);
  assert.doesNotMatch(component, /tonightTitle|viewFullMenu|chefSuggestion/);
  assert.doesNotMatch(component, /ENTRY_PREVIEW_EXCLUDED_DISH_SLUGS|canAppearInEntryPreview/);
  assert.doesNotMatch(component, /styles\.(guestToolbar|categoryGrid|categoryCard|featured)/);
  assert.doesNotMatch(css, /\.(guestToolbar|categoryGrid|categoryCard|featured)\b/);
  assert.match(css, /\.sectionedDishList/);
  assert.match(css, /\.dishSectionHeader/);
  assert.match(css, /\.menuCover/);
  assert.match(css, /\.bottomSheet/);
  assert.doesNotMatch(css, /\.(hero|categoryGrid|categoryCard|featured)\b/);
  assert.match(css, /@media \(max-width: 390px\)/);
});

test("Maison Elyse QR menu keeps compact filters and Google Reviews without 3D autoload", async () => {
  const component = await readFile(componentPath, "utf8");

  for (const text of [
    "Recommandés",
    "Signature",
    "3D / AR",
    "Disponibles",
    "Réinitialiser",
    "Appliquer",
    "Aucun plat dans cette sélection"
  ]) {
    assert.match(component, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(component, /Filtrer la carte/);
  assert.match(component, /La carte/);
  assert.match(component, /Filtre actif/);
  assert.match(component, /Recommended/);
  assert.match(component, /Available/);
  assert.match(component, /ALLERGEN_FILTERS/);
  assert.match(component, /matchesConfirmedFree/);
  assert.doesNotMatch(component, /AllergenWarning/);
  assert.match(component, /Filter the menu/);
  assert.match(component, /Active filter/);
  assert.doesNotMatch(component, /Tous les plats/);
  assert.doesNotMatch(component, /Les créations Maison Élyse/);
  assert.doesNotMatch(component, /plats disponibles/);
  assert.doesNotMatch(component, /plat disponible/);
  assert.doesNotMatch(component, /Sans lactose \/ laitiers/);
  assert.doesNotMatch(component, /Filtres précis/);
  assert.doesNotMatch(component, /Sans lactose/);
  assert.doesNotMatch(component, /ALLERGEN_FILTER_TERMS/);
  assert.match(component, /GoogleReviewCard/);
  assert.match(component, /FILTER_OPTIONS/);
  assert.match(component, /activeSheet/);
  assert.doesNotMatch(component, /QUICK_FILTERS/);
  assert.doesNotMatch(component, /PREFERENCE_FILTERS/);
  assert.doesNotMatch(component, /showDetailFilters/);
  assert.match(component, /googleReview=\{activeMenu\.googleReview\}/);
  assert.match(component, /localizedUiCopy=\{activeMenu\.localizedUiCopy\}/);
  assert.match(component, /restaurantId=\{activeMenu\.restaurantId\}/);
  assert.match(component, /restaurantName=\{activeMenu\.name\}/);
  assert.match(component, /source=\{activeMenu\.source\}/);
  assert.doesNotMatch(component, /DishModelViewer/);
  assert.doesNotMatch(component, /<model-viewer/);
  assert.doesNotMatch(component, /@google\/model-viewer/);
  assert.doesNotMatch(component, /["'`](?:https?:\/\/|\/)[^"'`]*\.glb/);
  assert.doesNotMatch(component, /["'`](?:https?:\/\/|\/)[^"'`]*\.usdz/);
});

test("/demo and /en/vistaire-menu use the Maison Elyse phone showcase instead of the legacy preview UI", async () => {
  const [
    demoPage,
    englishDemoPage,
    menuComponent,
    menuCss,
    showcase,
    showcaseCss,
    ownerCreateForm
  ] =
    await Promise.all([
      readFile(demoPagePath, "utf8"),
      readFile(englishDemoPagePath, "utf8"),
      readFile(componentPath, "utf8"),
      readFile(cssPath, "utf8"),
      readFile(demoShowcasePath, "utf8"),
      readFile(demoShowcaseCssPath, "utf8"),
      readFile(ownerCreateFormPath, "utf8")
    ]);

  assert.match(demoPage, /DemoPhoneShowcase/);
  assert.match(demoPage, /getPublicMenuBySlug\("maison-elyse",\s*"fr"\)/);
  assert.match(demoPage, /getPublicMenuBySlug\("maison-elyse",\s*"en"\)/);
  assert.match(demoPage, /menuLocale=\{menuLocale\}/);
  assert.doesNotMatch(demoPage, /VistaireMenuPreview/);
  assert.match(englishDemoPage, /DemoPhoneShowcase/);
  assert.match(englishDemoPage, /getPublicMenuBySlug\("maison-elyse",\s*"en"\)/);
  assert.match(englishDemoPage, /getPublicMenuBySlug\("maison-elyse",\s*"fr"\)/);
  assert.match(englishDemoPage, /menuLocale=\{menuLocale\}/);
  assert.doesNotMatch(englishDemoPage, /VistaireMenuPreview/);

  assert.match(menuComponent, /displayMode\?: "public" \| "phone-preview"/);
  assert.match(menuComponent, /showGoogleReview\?: boolean/);
  assert.match(menuComponent, /styles\.phonePreview/);
  assert.match(menuCss, /\.phonePreview/);

  assert.match(showcase, /MaisonElyseQrMenu/);
  assert.match(showcase, /displayMode="phone-preview"/);
  assert.match(showcase, /locale=\{resolvedMenuLocale\}/);
  assert.match(showcase, /localizedMenus=\{localizedMenus\}/);
  assert.doesNotMatch(showcase, /showGoogleReview=\{false\}/);
  assert.doesNotMatch(showcase, /startFullMenu/);
  assert.match(showcase, /data-testid="demo-phone-mockup"/);
  assert.match(showcase, /data-phone-mockup-scroll/);
  assert.match(ownerCreateForm, /className=\{styles\.menuPhoneScreen\}[\s\S]*data-phone-mockup-scroll/);
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

test("Maison Elyse phone detail can render localized English copy", async () => {
  const component = await readFile(dishDetailPath, "utf8");

  assert.match(component, /locale\?: Locale/);
  assert.match(component, /Back to menu/);
  assert.match(component, /Dish details/);
  assert.match(component, /View in 3D/);
  assert.match(component, /Augmented reality/);
  assert.match(component, /Allergens/);
  assert.match(component, /Chef's note/);
  assert.match(component, /Recommended/);
  assert.match(component, /Unavailable/);
});
