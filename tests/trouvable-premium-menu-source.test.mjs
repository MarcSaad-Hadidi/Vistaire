import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const pagePath = "app/menu/[slug]/page.tsx";
const componentPath = "components/menu/TrouvablePremiumMenuExperience.tsx";
const dishDetailPath = "components/menu/TrouvableDishDetailExperience.tsx";
const cssPath = "components/menu/TrouvablePremiumMenuExperience.module.css";
const helperPath = "lib/menu/trouvableMenuExperience.ts";
const controlsPath = "components/menu/trouvableMenuControls.ts";

test("public Trouvable menu is centralized in a targeted premium experience", async () => {
  const page = await readFile(pagePath, "utf8");
  const helper = await readFile(helperPath, "utf8");

  assert.match(page, /TrouvablePremiumMenuExperience/);
  assert.match(page, /isTrouvablePublicMenu\(menu\)/);
  assert.match(page, /resolvePublicMenuUiConfig\(menu, configRecord\.config\)/);
  assert.match(helper, /slug === "trouvable"/);
  assert.match(helper, /theme:\s*"premium-gastronomic"/);
  assert.match(helper, /autoLoad:\s*false/);
});

test("Trouvable premium menu keeps 3D assets behind dish detail intent", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.doesNotMatch(source, /DishModelViewer/);
  assert.doesNotMatch(source, /model-viewer/);
  assert.doesNotMatch(source, /@google\/model-viewer/);
  assert.doesNotMatch(source, /\.glb/);
  assert.doesNotMatch(source, /\.usdz/);
  assert.match(source, /buildPublicDishPath/);
  assert.match(source, /prefetch=\{false\}/);
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
  assert.match(source, /formatTrouvablePriceLabel/);
  assert.match(source, /getTrouvableGreeting/);
  assert.match(source, /data-user-theme=\{selectedTheme\}/);
  assert.match(source, /activeSheet === "currency"/);
  assert.match(source, /activeSheet === "language"/);
  assert.match(source, /openRestaurantReviewSheet/);
  assert.match(source, /openSheet\("experienceReview"\)/);
  assert.match(source, /copy\.reviewExperienceTitle/);
  assert.match(source, /copy\.reviewExperiencePlaceholder/);
  assert.match(source, /onReviewRequest=\{openRestaurantReviewSheet\}/);
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

  assert.match(css, /font-family:\s*Inter,\s*sans-serif/);
  assert.doesNotMatch(css, /BT Suave/);
  assert.doesNotMatch(css, /Neue Montreal/);
  assert.doesNotMatch(css, /Georgia/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /\.categoryRail[\s\S]*overflow-x:\s*auto/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.doesNotMatch(css, /word-break:\s*break-all/);
  assert.doesNotMatch(css, /overflow-wrap:\s*anywhere/);
});
