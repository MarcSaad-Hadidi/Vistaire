import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const pagePath = "app/menu/[slug]/page.tsx";
const dishPagePath = "app/menu/[slug]/dishes/[dishSlug]/page.tsx";
const typographyPath = "app/menu/[slug]/trouvableTypography.ts";
const componentPath = "components/menu/TrouvablePremiumMenuExperience.tsx";
const dishDetailPath = "components/menu/TrouvableDishDetailExperience.tsx";
const cssPath = "components/menu/TrouvablePremiumMenuExperience.module.css";
const googleReviewTrackingPath = "components/menu/googleReviewTracking.ts";
const helperPath = "lib/menu/trouvableMenuExperience.ts";
const controlsPath = "components/menu/trouvableMenuControls.ts";
const publicMenuPath = "lib/menu/publicMenu.ts";

test("public Trouvable menu is centralized in a targeted premium experience", async () => {
  const page = await readFile(pagePath, "utf8");
  const helper = await readFile(helperPath, "utf8");

  assert.match(page, /TrouvablePremiumMenuExperience/);
  assert.match(page, /isTrouvablePublicMenu\(menu\)/);
  assert.match(page, /resolvePublicMenuUiConfig\(menu, configRecord\.config\)/);
  assert.match(helper, /matchesMenuIdentity\(menu,\s*"trouvable"\)/);
  assert.match(helper, /theme:\s*"premium-gastronomic"/);
  assert.match(helper, /autoLoad:\s*false/);
});

test("public /menu/trouvable reads Supabase before the local Trouvable demo fallback", async () => {
  const source = await readFile(publicMenuPath, "utf8");
  const supabaseReadIndex = source.indexOf(
    'const restaurantsResult = await readSupabaseRows("restaurants", 200);'
  );
  const fallbackIndex = source.indexOf("return trouvableDemoMenu(slug, resolvedLocale);");

  assert.ok(supabaseReadIndex > 0, "Trouvable must reach the Supabase restaurant read");
  assert.ok(
    fallbackIndex > supabaseReadIndex,
    "Trouvable demo data must only be a fallback after Supabase is unavailable"
  );
  assert.match(source, /TROUVABLE_PUBLIC_MENU_SETTINGS/);
  assert.match(source, /!restaurantsResult\.ok \|\| restaurantsResult\.rows\.length === 0/);
  assert.match(source, /dejeuner-classique-maison/);
  assert.match(source, /publicMenuStyle:\s*"trouvable"/);
});

test("Trouvable premium menu keeps 3D assets behind explicit viewer intent", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.doesNotMatch(source, /model-viewer/);
  assert.doesNotMatch(source, /["'`][^"'`\n]*\.glb/);
  assert.doesNotMatch(source, /["'`][^"'`\n]*\.usdz/);
  assert.match(source, /showDetailModelViewer/);
  assert.match(source, /import\("@\/components\/dish\/DishModelViewer"\)/);
  assert.match(source, /setShowDetailModelViewer\(\(isVisible\) => !isVisible\)/);
  assert.match(source, /hasPublic3d\(selectedDish\)/);
  assert.match(source, /buildPublicDishPath/);
  assert.match(source, /prefetch=\{false\}/);
});

test("Trouvable AR browser help is hidden until a real fallback condition appears", async () => {
  const source = await readFile(componentPath, "utf8");
  const viewer = await readFile("components/dish/DishModelViewer.tsx", "utf8");

  assert.match(source, /showArBrowserHelp/);
  assert.match(source, /onArFallbackNeeded/);
  assert.match(source, /setShowArBrowserHelp\(false\)/);
  assert.doesNotMatch(
    source,
    /showDetailModelViewer \? \([\s\S]{0,500}<p className=\{styles\.arBrowserHelp\}>/
  );
  assert.match(viewer, /onArFallbackNeeded/);
  assert.match(viewer, /runtimeArFailed/);
});

test("Trouvable light theme integrates cutout PNG dishes without black visual blocks", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /dishPhotoHalo/);
  assert.match(css, /\.page\[data-user-theme="light"\][\s\S]*dishVisual[\s\S]*radial-gradient/);
  assert.match(css, /\.page\[data-user-theme="light"\][\s\S]*detailVisual[\s\S]*drop-shadow/);
  assert.doesNotMatch(
    css,
    /\.page\[data-user-theme="light"\][\s\S]{0,220}\.dishVisual[\s\S]{0,120}background:\s*#000/
  );
});

test("Trouvable premium menu includes local selection and waiter-only flows", async () => {
  const source = await readFile(componentPath, "utf8");
  const controls = await readFile(controlsPath, "utf8");

  assert.match(source, /useState<Map<string, SelectionItem>>/);
  assert.match(source, /copy\.selectionKicker/);
  assert.match(source, /quantityControls/);
  assert.match(source, /copy\.estimatedTotal/);
  assert.match(source, /copy\.askWaiter/);
  assert.match(controls, /Aucune commande n'est envoyée automatiquement/);
  assert.match(controls, /Question allergène/);
  assert.match(controls, /Demander une recommandation/);
  assert.match(controls, /Demander ma sélection/);
});

test("Trouvable premium menu wires functional currency, language, theme, and greeting controls", async () => {
  const source = await readFile(componentPath, "utf8");
  const controls = await readFile(controlsPath, "utf8");

  assert.match(source, /TROUVABLE_CURRENCY_STORAGE_KEY/);
  assert.match(source, /TROUVABLE_LOCALE_STORAGE_KEY/);
  assert.match(source, /TROUVABLE_THEME_STORAGE_KEY/);
  assert.match(source, /formatTrouvableDishPrice/);
  assert.match(source, /formatTrouvablePriceCents/);
  assert.match(source, /getTrouvableGreeting/);
  assert.match(source, /data-user-theme=\{selectedTheme\}/);
  assert.match(source, /activeSheet === "currency"/);
  assert.match(source, /activeSheet === "filters"/);
  assert.match(source, /activeSheet === "language"/);
  assert.match(source, /activeFilters/);
  assert.match(source, /setActiveFilters/);
  assert.match(source, /className=\{styles\.filterTrigger\}/);
  assert.match(source, /styles\.filterSheet/);
  assert.match(source, /className=\{styles\.filterGrid\}/);
  assert.match(source, /className=\{styles\.sheetReset\}/);
  assert.match(source, /className=\{styles\.sheetApply\}/);
  assert.match(source, /toggleQuickFilter/);
  assert.match(controls, /filterTitle:\s*"Filtres"/);
  assert.match(controls, /Sans gluten/);
  assert.match(controls, /\\u00e0 coque/);
  assert.match(source, /openRestaurantReviewSheet/);
  assert.match(source, /openSheet\("experienceReview"\)/);
  assert.match(source, /copy\.reviewExperienceTitle/);
  assert.match(source, /copy\.reviewExperiencePlaceholder/);
  assert.match(source, /onReviewRequest=\{openRestaurantReviewSheet\}/);
  assert.match(source, /badges\.add\("3D"\)/);
  assert.doesNotMatch(source, /badges\.add\("4D"\)/);
  assert.match(controls, /TROUVABLE_STATIC_CAD_RATES/);
  assert.match(controls, /CAD/);
  assert.match(controls, /USD/);
  assert.match(controls, /EUR/);
});

test("Trouvable dish details are revealed only after tapping more details", async () => {
  const source = await readFile(componentPath, "utf8");
  const detailSource = await readFile(dishDetailPath, "utf8");

  assert.match(source, /dishDetailsExpanded/);
  assert.match(source, /aria-expanded=\{dishDetailsExpanded\}/);
  assert.match(source, /selectedDish\.description && dishDetailsExpanded/);
  assert.match(detailSource, /showMoreDetails/);
  assert.match(detailSource, /aria-expanded=\{showMoreDetails\}/);
  assert.match(detailSource, /activeDish\.description && showMoreDetails/);
});

test("Trouvable all category stays global while filters and searches resolve dishes", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /activeCategory === ALL_CATEGORY_ID\s*\?\s*ALL_CATEGORY_ID/);
  assert.match(source, /current === category\.label \? ALL_CATEGORY_ID : category\.label/);
  assert.match(source, /setActiveCategory\(ALL_CATEGORY_ID\)/);
  assert.match(
    source,
    /resolvedActiveCategory === ALL_CATEGORY_ID\s*\?\s*filteredDishes/
  );
  assert.doesNotMatch(
    source,
    /activeCategory === ALL_CATEGORY_ID && [\s\S]{0,80}\? [a-zA-Z]+Category/
  );
});

test("Trouvable review sheets track Google review outbound clicks", async () => {
  const [source, detailSource, tracking] = await Promise.all([
    readFile(componentPath, "utf8"),
    readFile(dishDetailPath, "utf8"),
    readFile(googleReviewTrackingPath, "utf8")
  ]);

  assert.match(source, /trackGoogleReviewClick/);
  assert.match(source, /dishSlug:\s*reviewDish\?\.slug/);
  assert.match(detailSource, /trackGoogleReviewClick/);
  assert.match(detailSource, /dishSlug:\s*activeDish\.slug/);
  assert.match(tracking, /trackMenuEvent/);
  assert.match(tracking, /ctaName:\s*"google_review"/);
  assert.match(tracking, /destination:\s*"google_review"/);
});

test("Trouvable hero includes animated botanical ornamentation", async () => {
  const source = await readFile(componentPath, "utf8");
  const css = await readFile(cssPath, "utf8");

  assert.match(source, /HeroBotanicalOrnament/);
  assert.match(source, /VistaireWord/);
  assert.match(source, /heroBotanical/);
  assert.match(css, /vistaireLeafI/);
  assert.match(css, /vistaireLeafBloom/);
  assert.match(css, /botanicalDraw/);
  assert.match(css, /botanicalBloom/);
  assert.match(css, /botanicalDraw 1700ms/);
  assert.match(css, /botanicalDraw[\s\S]*!important/);
  assert.match(css, /botanicalBloom[\s\S]*!important/);
});

test("Trouvable category swipe hint keeps a looping edge-bounce animation", async () => {
  const source = await readFile(componentPath, "utf8");
  const css = await readFile(cssPath, "utf8");

  assert.match(source, /className=\{styles\.swipeHint\}/);
  assert.match(css, /@keyframes swipeHintBounce/);
  assert.match(css, /animation:\s*swipeHintBounce 1650ms/);
  assert.match(css, /infinite !important/);
});

test("Trouvable premium menu styles are mobile-first and overflow-safe", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /--trouvable-font-ui:\s*Inter,\s*sans-serif/);
  assert.match(css, /--trouvable-font-display:\s*"Noto Serif Display"/);
  assert.match(css, /font-family:\s*var\(--trouvable-font-ui\)/);
  assert.match(css, /font-family:\s*var\(--trouvable-font-display\)/);
  assert.match(css, /\.filterTrigger/);
  assert.match(css, /\.filterSheet/);
  assert.match(css, /\.filterGrid/);
  assert.match(css, /\.sheetReset/);
  assert.match(css, /\.sheetApply/);
  assert.match(css, /content:\s*"\\263e"/);
  assert.match(css, /content:\s*"\\2600"/);
  assert.match(css, /\.hero h1[\s\S]*font-style:\s*italic/);
  assert.match(css, /\.brandBlock strong[\s\S]*font-size:\s*clamp\(14px,\s*3\.8vw,\s*20px\)/);
  assert.doesNotMatch(css, /BT Suave/);
  assert.doesNotMatch(css, /Neue Montreal/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /\.categoryRail[\s\S]*overflow-x:\s*auto/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.doesNotMatch(css, /word-break:\s*break-all/);
  assert.doesNotMatch(css, /overflow-wrap:\s*anywhere/);
});

test("Trouvable typography uses optimized next/font variables for display and UI", async () => {
  const page = await readFile(pagePath, "utf8");
  const dishPage = await readFile(dishPagePath, "utf8");
  const source = await readFile(componentPath, "utf8");
  const detailSource = await readFile(dishDetailPath, "utf8");
  const typography = await readFile(typographyPath, "utf8");

  assert.match(typography, /from "next\/font\/google"/);
  assert.match(typography, /Inter\(/);
  assert.match(typography, /Noto_Serif_Display\(/);
  assert.match(typography, /variable:\s*"--trouvable-font-ui"/);
  assert.match(typography, /variable:\s*"--trouvable-font-display"/);
  assert.match(typography, /style:\s*\["normal", "italic"\]/);
  assert.match(page, /typographyClassName=\{trouvableTypographyClassName\}/);
  assert.match(dishPage, /typographyClassName=\{trouvableTypographyClassName\}/);
  assert.match(source, /typographyClassName/);
  assert.match(detailSource, /typographyClassName/);
});
