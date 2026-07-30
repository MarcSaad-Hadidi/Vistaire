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
const renderContextPath = "lib/menu/publicMenuRenderContext.ts";

test("public Trouvable menu is centralized in a targeted premium experience", async () => {
  const [page, helper, renderContext] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(helperPath, "utf8"),
    readFile(renderContextPath, "utf8")
  ]);

  assert.match(page, /TrouvablePremiumMenuExperience/);
  assert.match(page, /resolvePublicMenuRenderContext/);
  assert.match(renderContext, /resolvePublicMenuExperience/);
  assert.match(page, /experience\.kind === "trouvable"/);
  assert.match(
    renderContext,
    /resolvePublicMenuUiConfig\(initialMenu, configRecord\.config\)/
  );
  assert.match(helper, /matchesMenuIdentity\(menu,\s*"trouvable"\)/);
  assert.match(helper, /theme:\s*"premium-gastronomic"/);
  assert.match(helper, /autoLoad:\s*false/);
});

test("public /menu/trouvable reads Supabase before the local Trouvable demo fallback", async () => {
  const source = await readFile(publicMenuPath, "utf8");
  const supabaseReadIndex = source.indexOf(
    'const restaurantsResult = await dependencies.readRows<PublicMenuRow>'
  );
  const fallbackIndex = source.indexOf("return localDemo();", supabaseReadIndex);

  assert.ok(supabaseReadIndex > 0, "Trouvable must reach the Supabase restaurant read");
  assert.ok(
    fallbackIndex > supabaseReadIndex,
    "Trouvable demo data must only be a fallback after Supabase is unavailable"
  );
  assert.match(source, /TROUVABLE_PUBLIC_MENU_SETTINGS/);
  assert.match(source, /supportedLocales:\s*\["fr-CA",\s*"en-CA",\s*"es-ES",\s*"it-IT",\s*"el-GR",\s*"ar"\]/);
  assert.match(source, /name:\s*dish\.nameFr/);
  assert.doesNotMatch(source, /name:\s*isEnglish\s*\?\s*dish\.nameEn/);
  assert.match(source, /!restaurantsResult\.ok \|\| restaurantsResult\.rows\.length === 0/);
  assert.match(source, /dependencies\.nodeEnv === "production"/);
  assert.match(source, /filters: \{ slug \}/);
  assert.match(source, /filters: \{ restaurant_id: restaurantId \}/);
  assert.doesNotMatch(source, /readSupabaseRows\(/);
  assert.match(source, /dejeuner-classique-maison/);
  assert.match(source, /publicMenuStyle:\s*"trouvable"/);
});

test("Trouvable premium menu keeps 3D assets behind explicit viewer intent", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.doesNotMatch(source, /<model-viewer/);
  assert.doesNotMatch(source, /["'`][^"'`\n]*\.glb/);
  assert.doesNotMatch(source, /["'`][^"'`\n]*\.usdz/);
  assert.match(source, /showDetailModelViewer/);
  assert.match(source, /import\("@\/components\/dish\/DishModelViewer"\)/);
  assert.match(source, /setShowDetailModelViewer\(\(isVisible\) => \{[\s\S]*?return !isVisible;/);
  assert.match(source, /hasPublicMenu3d\(selectedDish\)/);
  assert.match(source, /loadingTitle:\s*copy\.modelPreparing/);
  assert.match(source, /\.\.\.copy\.modelViewer/);
  assert.match(source, /modelAlt:\s*copy\.modelAlt/);
  assert.match(source, /useTrouvableDocumentLanguage\(\s*selectedLocale,\s*textDirection/);
  assert.match(source, /buildPublicDishPath/);
  assert.match(source, /copyTextToClipboard/);
  assert.match(source, /new URL\(/);
  assert.match(source, /browserDishHref/);
  assert.match(source, /window\.location\.origin/);
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

test("Trouvable cutout PNG dishes render without added visual backgrounds", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /dishPhotoHalo/);
  assert.match(css, /\.dishVisual:has\(img\)/);
  assert.match(css, /\.dishVisual\.hasDishImage/);
  assert.match(css, /\.detailSheet \.detailVisual:has\(img\)/);
  assert.match(css, /background:\s*transparent/);
  assert.match(css, /border-color:\s*transparent/);
  assert.match(css, /object-fit:\s*contain/);
  assert.doesNotMatch(css, /object-fit:\s*cover/);
  assert.match(css, /\.page\[data-user-theme="light"\][\s\S]*detailVisual[\s\S]*drop-shadow/);
  assert.doesNotMatch(
    css,
    /\.page\[data-user-theme="light"\][\s\S]{0,220}\.dishVisual[\s\S]{0,120}background:\s*#000/
  );
});

test("Trouvable runtime themes derive neutrals from the selected palette", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.page\[data-user-theme="light"\][\s\S]*--trouvable-light-bg/);
  assert.match(
    css,
    /\.page\[data-user-theme="light"\][\s\S]*background:\s*var\(--trouvable-light-bg\)\s*!important/
  );
  assert.match(css, /\.page\[data-user-theme="dark"\][\s\S]*--trouvable-dark-bg/);
  assert.match(
    css,
    /\.page\[data-user-theme="dark"\][\s\S]*--menu-bg:\s*var\(--trouvable-dark-bg\)\s*!important/
  );
  assert.match(
    css,
    /\.page\[data-user-theme="dark"\][\s\S]*--menu-text:\s*var\(--trouvable-dark-text\)\s*!important/
  );
  assert.match(css, /--trouvable-gold:\s*var\(--menu-accent/);
  assert.match(css, /--trouvable-light-bg:[\s\S]*var\(--menu-accent-2/);
  assert.match(css, /--trouvable-light-surface:[\s\S]*var\(--menu-accent-2/);
});

test("Trouvable dish cards do not render inferred spicy markers", async () => {
  const [source, css] = await Promise.all([
    readFile(componentPath, "utf8"),
    readFile(cssPath, "utf8")
  ]);

  assert.doesNotMatch(source, /styles\.spicyMark/);
  assert.doesNotMatch(source, /isSpicyDish/);
  assert.doesNotMatch(css, /\.spicyMark/);
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
  assert.match(source, /useRouter/);
  assert.match(source, /router\.replace\(nextPath,\s*\{\s*scroll:\s*false\s*\}\)/);
  assert.doesNotMatch(source, /window\.location\.replace/);
  assert.doesNotMatch(source, /function updateBrowserLocale[\s\S]*window\.history\.replaceState/);
  assert.match(source, /lang=\{selectedLocale\}/);
  assert.match(source, /dir=\{textDirection\}/);
  assert.match(source, /activeFilters/);
  assert.match(source, /setActiveFilters/);
  assert.match(source, /className=\{styles\.filterTrigger\}/);
  assert.match(source, /styles\.filterSheet/);
  assert.match(source, /className=\{styles\.filterGrid\}/);
  assert.match(source, /className=\{styles\.sheetReset\}/);
  assert.match(source, /className=\{styles\.sheetApply\}/);
  assert.match(source, /toggleQuickFilter/);
  assert.match(controls, /filterTitle:\s*"Filtres"/);
  assert.match(controls, /es:\s*\{/);
  assert.match(controls, /it:\s*\{/);
  assert.match(controls, /ar:\s*\{/);
  assert.match(controls, /getTrouvableTextDirection/);
  assert.match(controls, /sans gluten/i);
  assert.match(controls, /fruits à coque/i);
  assert.match(source, /openRestaurantReviewSheet/);
  assert.match(source, /openSheet\("experienceReview"\)/);
  assert.match(source, /copy\.reviewExperienceTitle/);
  assert.match(source, /copy\.reviewExperiencePlaceholder/);
  assert.match(source, /onReviewRequest=\{openRestaurantReviewSheet\}/);
  assert.match(source, /hasPublicMenu3d\(selectedDish\)/);
  assert.doesNotMatch(source, /badges\.add\("4D"\)/);
  assert.match(controls, /TROUVABLE_STATIC_CAD_RATES/);
  assert.match(controls, /CAD/);
  assert.match(controls, /USD/);
  assert.match(controls, /EUR/);
  assert.match(controls, /tags:\s*"Tags"/);
});

test("Trouvable standalone dish detail keeps locale URL navigation and layout direction in sync", async () => {
  const detailSource = await readFile(dishDetailPath, "utf8");
  const pageSource = await readFile(dishPagePath, "utf8");

  assert.match(detailSource, /useRouter/);
  assert.match(detailSource, /router\.replace\(nextPath,\s*\{\s*scroll:\s*false\s*\}\)/);
  assert.doesNotMatch(detailSource, /window\.location\.replace/);
  assert.match(detailSource, /useTrouvableDocumentLanguage\(selectedLocale,\s*textDirection\)/);
  assert.match(detailSource, /lang=\{selectedLocale\}/);
  assert.match(detailSource, /dir=\{textDirection\}/);
  assert.match(
    pageSource,
    /<TrouvableDishDetailExperience[\s\S]*query=\{\{\s*\.\.\.menuQuery,\s*lang:\s*hasLangParam \? activePublicLocale : undefined\s*\}\}/
  );
});

test("Trouvable dish details and reviews are stacked sub-sheets above the dish", async () => {
  const source = await readFile(componentPath, "utf8");
  const detailSource = await readFile(dishDetailPath, "utf8");

  assert.match(source, /type DishSubSheet = "details" \| "review" \| null/);
  assert.match(source, /renderDishDetailsSubSheet/);
  assert.match(source, /setDishSubSheet\("details"\)/);
  assert.match(source, /activeSheet === "dish" && dishSubSheet === "review"/);
  assert.match(source, /closeDishSubSheet/);
  assert.match(source, /const subSheetRef = useRef<HTMLElement \| null>\(null\)/);
  assert.match(source, /if \(activeSheet === "dish" && dishSubSheet\) \{\s*closeDishSubSheet\(\);/);
  assert.match(source, /ref=\{isDishStackReview \? subSheetRef : sheetRef\}/);
  assert.match(source, /panelRef=\{subSheetRef\}/);
  assert.match(source, /trouvable-dish-more-details-/);
  assert.match(source, /PremiumDishDetailsSheet/);
  assert.doesNotMatch(source, /dishDetailsExpanded/);

  assert.match(detailSource, /type DishDetailSubSheet = "details" \| "review" \| null/);
  assert.match(detailSource, /activeSubSheet === "details"/);
  assert.match(detailSource, /activeSubSheet === "review"/);
  assert.match(detailSource, /setActiveSubSheet\(null\)/);
  assert.match(detailSource, /styles\.stackedOverlay/);
  assert.doesNotMatch(detailSource, /showMoreDetails/);
  assert.doesNotMatch(detailSource, /showReviewSheet/);
});

test("Trouvable dish swipe guards interactive controls and 3D surfaces", async () => {
  const source = await readFile(componentPath, "utf8");
  const detailSource = await readFile(dishDetailPath, "utf8");
  const guardedSelectors = [
    "model-viewer",
    "canvas",
    "button",
    "a",
    "input",
    "select",
    "textarea",
    "dialog",
    "[role='dialog']",
    "[data-no-dish-swipe]"
  ];

  for (const selector of guardedSelectors) {
    assert.ok(source.includes(`"${selector}"`), `premium menu missing guard ${selector}`);
    assert.ok(detailSource.includes(`"${selector}"`), `dish detail missing guard ${selector}`);
  }

  assert.match(source, /isDishSwipeGuardedTarget\(event\.target,\s*event\.currentTarget\)/);
  assert.match(
    detailSource,
    /isDishSwipeGuardedTarget\(event\.target,\s*event\.currentTarget\)/
  );
  assert.match(source, /data-no-dish-swipe="true"/);
  assert.match(detailSource, /data-no-dish-swipe="true"/);
  assert.doesNotMatch(
    source,
    /className=\{styles\.menuPanel\}[\s\S]{0,180}onPointerDown=\{handleMenuCategoryPointerDown\}/
  );
  assert.doesNotMatch(
    source,
    /className=\{styles\.categoryRail\}[\s\S]{0,220}onPointerDown=\{handleMenuCategoryPointerDown\}/
  );
  assert.match(
    source,
    /className=\{styles\.categorySwipeSurface\}[\s\S]{0,220}onPointerDownCapture=\{handleMenuCategoryPointerDown\}/
  );
  assert.match(source, /isCategorySwipeGuardedTarget/);
  assert.match(source, /data-no-category-swipe="true"/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.doesNotMatch(source, /CategoryIcon kind="all"/);
  assert.doesNotMatch(source, /copy\.all[\s\S]{0,120}categoryRail/);
});

test("Trouvable details keep ingredients, allergens, options, and notes in the premium sheet", async () => {
  const source = await readFile(componentPath, "utf8");
  const detailSource = await readFile(dishDetailPath, "utf8");
  const sheetSource = await readFile(
    "components/menu/PremiumDishDetailsSheet.tsx",
    "utf8"
  );

  for (const field of ["ingredients", "allergens", "options", "houseNote"]) {
    assert.match(sheetSource, new RegExp(`dish\\.${field}`));
    assert.match(source, new RegExp(`selectedDish\\.${field}|dish\\.${field}`));
    assert.match(
      detailSource,
      new RegExp(`activeDish\\.${field}|dish=\\{activeDish\\}|dish\\.${field}`)
    );
  }

  assert.match(source, /PremiumDishDetailsSheet/);
  assert.match(detailSource, /PremiumDishDetailsSheet/);
  assert.match(sheetSource, /copy\.detailCompositionLabel/);
  assert.match(sheetSource, /AllergenDisclosure/);
  assert.match(sheetSource, /allergenDeclarations/);
  assert.match(sheetSource, /copy\.detailOptionsLabel/);
  assert.doesNotMatch(source, /copy\.ingredientsCount\(/);
  assert.match(source, /DishCard3dBadge/);
  assert.match(source, /hasPublicMenu3d\(dish\)/);
});

test("Trouvable list keeps the allergen warning inside dish details", async () => {
  const menuSource = await readFile(
    new URL("../components/menu/TrouvablePremiumMenuExperience.tsx", import.meta.url),
    "utf8"
  );
  const detailSource = await readFile(
    new URL("../components/menu/TrouvableDishDetailExperience.tsx", import.meta.url),
    "utf8"
  );
  const sheetSource = await readFile(
    new URL("../components/menu/PremiumDishDetailsSheet.tsx", import.meta.url),
    "utf8"
  );

  const listSource = menuSource.slice(
    0,
    menuSource.indexOf("function renderDishDetailSheet")
  );

  assert.doesNotMatch(listSource, /<AllergenWarning/);
  assert.doesNotMatch(menuSource, /<AllergenWarning/);
  assert.match(detailSource, /<AllergenWarning locale=\{selectedLocale\} \/>/);
  assert.match(sheetSource, /includeWarning\s*\/>/);
});

test("Trouvable reference and custom palette sources are explicit", async () => {
  const source = await readFile(componentPath, "utf8");
  const detailSource = await readFile(dishDetailPath, "utf8");
  const css = await readFile(cssPath, "utf8");

  assert.match(source, /data-palette-source=\{paletteSource\}/);
  assert.match(source, /paletteSource === "restaurant"/);
  assert.match(detailSource, /data-palette-source=\{paletteSource\}/);
  assert.match(detailSource, /paletteSource === "restaurant"/);
  assert.match(css, /@scope \(\.page\[data-palette-source="restaurant"\]\)/);
  assert.match(css, /linear-gradient\(180deg, rgba\(54, 31, 16, 0\.78\)/);
  assert.match(
    css,
    /data-palette-source="reference"\]\[data-user-theme="dark"\] \.topBar[\s\S]*background: #000;/
  );
  assert.match(css, /data-palette-source="reference"\]\[data-user-theme="dark"\] \.topBar[\s\S]*border: 0;/);
  assert.match(
    css,
    /\.page\[data-user-theme="light"\]\s*\{\s*--trouvable-black: #f5efe4/
  );
  assert.match(
    css,
    /\.page\[data-palette-source="reference"\]\[data-user-theme="dark"\]/
  );
});

test("Trouvable all category stays global while filters and searches resolve dishes", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /categories\.map\(\(category\) => category\.id\)/);
  assert.match(source, /filteredCategories\.some\(\(category\) => category\.id === activeCategory\)/);
  assert.match(source, /activeCategory === ALL_CATEGORY_ID\s*\?\s*ALL_CATEGORY_ID/);
  assert.match(
    source,
    /setActiveCategory\([\s\S]*?resolvedActiveCategory === category\.id[\s\S]*?\?\s*ALL_CATEGORY_ID\s*:\s*category\.id/
  );
  assert.match(source, /setActiveCategory\(ALL_CATEGORY_ID\)/);
  assert.match(
    source,
    /resolvedActiveCategory === ALL_CATEGORY_ID\s*\?\s*filteredDishes/
  );
  assert.match(source, /filteredGroups\.get\(resolvedActiveCategory\)/);
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

test("Trouvable review sheets dismiss from backdrop and hide visible close control", async () => {
  const [source, detailSource, css] = await Promise.all([
    readFile(componentPath, "utf8"),
    readFile(dishDetailPath, "utf8"),
    readFile(cssPath, "utf8")
  ]);

  assert.match(source, /reviewOverlay\} \$\{styles\.stackedOverlay\}/);
  assert.match(source, /if \(event\.target === event\.currentTarget\) closeReview\(\)/);
  assert.doesNotMatch(source, /className=\{styles\.reviewClose\}/);
  assert.match(source, /resolveDishSwipeGesture/);
  assert.match(source, /gesture === "reviewOpen"/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(detailSource, /resolveDishSwipeGesture/);
  assert.match(detailSource, /if \(event\.target === event\.currentTarget\) setActiveSubSheet\(null\)/);
  assert.doesNotMatch(detailSource, /className=\{styles\.reviewClose\}/);
  assert.match(detailSource, /if \(event\.key !== "Escape"\) return/);
  assert.match(css, /\.reviewTrigger span[\s\S]*var\(--trouvable-gold\)/);
  assert.doesNotMatch(css, /\.reviewClose/);
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
  assert.doesNotMatch(css, /botanicalDraw[\s\S]{0,180}!important/);
  assert.doesNotMatch(css, /botanicalBloom[\s\S]{0,180}!important/);
});

test("Trouvable category swipe hint keeps a looping edge-bounce animation", async () => {
  const source = await readFile(componentPath, "utf8");
  const css = await readFile(cssPath, "utf8");

  assert.match(source, /className=\{styles\.swipeHint\}/);
  assert.match(source, /copy\.swipeLabel/);
  assert.match(source, /copy\.swipeAria/);
  assert.match(source, /aria-hidden="true"[\s\S]{0,80}\u2194/);
  assert.doesNotMatch(source, /\{copy\.swipeList\}/);
  assert.match(css, /@keyframes swipeHintBounce/);
  assert.match(css, /animation:\s*swipeHintBounce 1650ms/);
  assert.doesNotMatch(css, /swipeHintBounce[\s\S]{0,180}infinite !important/);
});

test("Trouvable public UI labels use extensible localized copy", async () => {
  const source = await readFile(componentPath, "utf8");
  const detailSource = await readFile(dishDetailPath, "utf8");

  assert.match(source, /resolveTrouvableCopy\(\s*selectedLocale,\s*menu\.localizedUiCopy\s*\)/);
  assert.match(source, /getTrouvableReadyLanguageOptions\(\s*menu\.settings,\s*selectedLocale,\s*menu\.localizedUiCopy\s*\)/);
  assert.match(source, /normalizeTrouvableReadyLocaleForSettings\(\s*query\?\.lang,\s*menu\.settings,\s*menu\.localizedUiCopy\s*\)/);
  assert.match(
    source,
    /getTrouvableGreetingForDate\(\s*selectedLocale,\s*menu\.settings\.timezone,\s*new Date\(\),\s*menu\.localizedUiCopy\s*\)/
  );
  assert.match(source, /data-copy-dynamic-source=\{copyResolution\.dynamicSource\}/);
  assert.match(source, /data-copy-neutral-fallback=\{copyResolution\.usedNeutralFallback/);
  assert.match(source, /data-copy-complete=\{copyResolution\.uiCopyComplete/);
  assert.match(source, /data-locale-public-ready=\{\s*copyResolution\.uiCopyComplete/);
  assert.match(source, /data-menu-translation-status=\{menu\.translationStatus\?\.status/);
  assert.match(source, /data-menu-ready-locales=\{menu\.settings\.supportedLocales\.join\(","\)\}/);
  assert.match(source, /data-menu-blocked-locales=\{\s*menu\.translationLocales\s*\?/);
  assert.match(source, /data-menu-blocked-locale-reasons=\{\s*menu\.translationLocales\s*\?/);
  assert.match(source, /data-copy-missing-keys=\{copyResolution\.missingKeys\.length\}/);
  assert.match(source, /data-copy-ignored-keys=\{copyResolution\.ignoredKeys\.length\}/);
  assert.match(source, /label:\s*copy\.immersiveFilterLabel/);
  assert.match(source, /\$\{copy\.tableLabel\} \$\{tableNumber\.trim\(\)\}/);
  assert.match(source, /placeholder=\{copy\.tablePlaceholder\}/);
  assert.match(source, /localizedUiCopy=\{menu\.localizedUiCopy\}/);
  assert.match(source, /aria-labelledby="trouvable-hero-title"/);
  assert.match(source, /<h1 id="trouvable-hero-title">\{menu\.name\}<\/h1>/);
  assert.doesNotMatch(source, /label:\s*"3D \/ AR"/);
  assert.doesNotMatch(source, /placeholder="Ex\. 12"/);
  assert.doesNotMatch(source, /Table \$\{tableNumber\.trim\(\)\}/);
  assert.doesNotMatch(source, /aria-label=\{`Menu \$\{menu\.name\}`\}/);
  assert.doesNotMatch(source, /translateTrouvableCategoryLabel/);
  assert.doesNotMatch(source, /Photo de \$\{/);
  assert.doesNotMatch(detailSource, /Photo de \$\{/);
  assert.match(detailSource, /resolveTrouvableCopy\(\s*selectedLocale,\s*menu\.localizedUiCopy\s*\)/);
  assert.match(detailSource, /normalizeTrouvableReadyLocaleForSettings\(\s*query\?\.lang,\s*menu\.settings,\s*menu\.localizedUiCopy\s*\)/);
  assert.match(detailSource, /data-copy-dynamic-source=\{copyResolution\.dynamicSource\}/);
  assert.match(detailSource, /data-copy-neutral-fallback=\{copyResolution\.usedNeutralFallback/);
  assert.match(detailSource, /data-copy-complete=\{copyResolution\.uiCopyComplete/);
  assert.match(detailSource, /data-locale-public-ready=\{\s*copyResolution\.uiCopyComplete/);
  assert.match(detailSource, /data-menu-translation-status=\{menu\.translationStatus\?\.status/);
  assert.match(detailSource, /data-menu-ready-locales=\{menu\.settings\.supportedLocales\.join\(","\)\}/);
  assert.match(detailSource, /data-menu-blocked-locales=\{\s*menu\.translationLocales\s*\?/);
  assert.match(detailSource, /data-menu-blocked-locale-reasons=\{\s*menu\.translationLocales\s*\?/);
  assert.match(detailSource, /data-copy-missing-keys=\{copyResolution\.missingKeys\.length\}/);
  assert.match(detailSource, /data-copy-ignored-keys=\{copyResolution\.ignoredKeys\.length\}/);
});

test("Trouvable category swipe uses full navigable sections and keeps the rail synced", async () => {
  const [source, css] = await Promise.all([
    readFile(componentPath, "utf8"),
    readFile(cssPath, "utf8")
  ]);

  assert.match(source, /buildNavigableMenuSections\(/);
  assert.match(source, /getAdjacentMenuSection\(/);
  assert.match(source, /const categoryRailRef = useRef<HTMLElement \| null>\(null\)/);
  assert.match(source, /scrollIntoView\(\{[\s\S]*inline:\s*"center"/);
  assert.match(source, /prefersReducedMotion \? "auto" : "smooth"/);
  assert.match(source, /className=\{`\$\{styles\.sectionBody\} \$\{styles\.sectionBodyEnter\}`\}/);
  assert.match(source, /className=\{styles\.categorySwipeSurface\}/);
  assert.match(source, /handleMenuCategoryPointerDown/);
  assert.doesNotMatch(
    source,
    /categoryOptions\.findIndex\(\(category\) => category\.label === resolvedActiveCategory\)/
  );
  assert.doesNotMatch(source, /<CategoryIcon kind="all" \/>/);
  assert.doesNotMatch(
    css,
    /\.categoryRail\s*>\s*button:first-child\s*\{[\s\S]*?display:\s*none/
  );
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none !important/);
  assert.match(css, /@keyframes sectionBodyEnter/);
  assert.match(css, /--vistaire-motion-ease:\s*cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
  assert.match(css, /--vistaire-motion-duration:\s*220ms/);
  assert.match(css, /@keyframes menuOverlayEnter/);
  assert.match(css, /@keyframes menuSheetEnter/);
  assert.match(css, /\.overlay[\s\S]*animation:\s*menuOverlayEnter/);
  assert.match(css, /\.sheet:not\(\.detailSheet\)[\s\S]*animation:\s*menuSheetEnter/);
});

test("Trouvable filter sheet uses premium filterSheet styling on the filters dialog", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(
    source,
    /function renderFiltersSheet\(\)[\s\S]*className=\{`\$\{styles\.sheet\} \$\{styles\.filterSheet\}`\}/
  );
  assert.match(
    source,
    /function renderSelectionSheet\(\)[\s\S]*className=\{styles\.sheet\}[\s\S]*?selectionTitle/
  );
  assert.doesNotMatch(
    source,
    /function renderSelectionSheet\(\)[\s\S]*?selectionTitle[\s\S]{0,400}filterSheet/
  );
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
  const categoryRailBlock = css.match(/\.categoryRail\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.doesNotMatch(categoryRailBlock, /touch-action:\s*pan-y/);
  assert.match(
    css,
    /\.page\[data-user-theme="light"\]\s+\.detailList h3,\s*\n\.page\[data-user-theme="light"\]\s+\.houseNote h3\s*\{[\s\S]*color:\s*#6f530e/
  );
  assert.match(
    css,
    /\.page\[data-user-theme="light"\]\s+\.detailsSubSheet\s+\.moreDetailsText,\s*\n\.page\[data-user-theme="light"\]\s+\.houseNote p\s*\{[\s\S]*color:\s*rgba\(35,\s*26,\s*13,\s*0\.72\)/
  );
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.doesNotMatch(css, /word-break:\s*break-all/);
  assert.doesNotMatch(css, /overflow-wrap:\s*anywhere/);
});

test("Trouvable menu tools stay sticky under the top bar with a single control surface", async () => {
  const [source, css] = await Promise.all([
    readFile(componentPath, "utf8"),
    readFile(cssPath, "utf8")
  ]);

  assert.match(source, /toolsSentinelRef/);
  assert.match(source, /topBarRef/);
  assert.match(source, /setToolsPinned/);
  assert.match(source, /data-pinned=\{toolsPinned \? "true" : "false"\}/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /typeof ResizeObserver === "undefined"/);
  assert.match(source, /id="trouvable-menu-search"/);
  assert.doesNotMatch(source, /id="trouvable-menu-search-sticky"/);
  assert.match(css, /\.tools[\s\S]*position:\s*sticky/);
  assert.match(css, /top:\s*var\(--trouvable-sticky-tools-top/);
  assert.match(css, /\.tools\[data-pinned="true"\]/);
  assert.match(css, /@keyframes toolsPinEnter/);
  assert.match(css, /\.toolsSentinel/);
});

test("Trouvable welcome copy places the restaurant connector before the name", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /getTrouvableGreetingPeriodForDate\([\s\S]*menu\.settings\.timezone/);
  assert.match(source, /formatTrouvableGreetingLead\([\s\S]*greetingText[\s\S]*greetingPeriod/);
  assert.match(source, /<p>\{greetingLead\}<\/p>/);
  assert.match(source, /<h1 id="trouvable-hero-title">\{menu\.name\}<\/h1>/);
});

test("Trouvable back-to-top control matches the compact reference and adapts to light theme", async () => {
  const [source, css] = await Promise.all([
    readFile(componentPath, "utf8"),
    readFile(cssPath, "utf8")
  ]);

  assert.match(source, /<BackToTopIcon \/>[\s\S]*<span>\{copy\.backToTop\}<\/span>/);
  assert.match(css, /\.backToTop[\s\S]*left:\s*50%[\s\S]*min-width:\s*188px[\s\S]*height:\s*46px/);
  assert.match(css, /\.backToTop[\s\S]*border:\s*1px solid #f0d800[\s\S]*border-radius:\s*999px/);
  assert.match(
    css,
    /\.page\[data-user-theme="light"\] \.backToTop[\s\S]*background:\s*#fff9ef[\s\S]*color:\s*#8f6d14/
  );
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
