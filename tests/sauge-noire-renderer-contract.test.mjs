import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const registryPath = new URL(
  "../lib/menu/uniqueMenuRendererRegistry.ts",
  import.meta.url
);
const bookPath = new URL(
  "../components/menu/unique/sauge-noire/SaugeNoireBookMenu.tsx",
  import.meta.url
);
const detailPath = new URL(
  "../components/menu/unique/sauge-noire/SaugeNoireDishDetail.tsx",
  import.meta.url
);
const bookStylesPath = new URL(
  "../components/menu/unique/sauge-noire/SaugeNoireBookMenu.module.css",
  import.meta.url
);
const detailStylesPath = new URL(
  "../components/menu/unique/sauge-noire/SaugeNoireDishDetail.module.css",
  import.meta.url
);

test("Sauge Noire renderer is statically bound to the canonical design identity", async () => {
  const source = await readFile(registryPath, "utf8");
  assert.match(source, /sauge-noire-book-v1/);
  assert.match(source, /073bd2ca-56f9-46ee-bd7c-38ab22f01c9a/);
  assert.match(source, /version: 1/);
  assert.match(source, /SaugeNoireBookMenu/);
  assert.match(source, /SaugeNoireDishDetail/);
  assert.doesNotMatch(source, /import\s*\(\s*[`'"].*\$\{/);
});

test("book pages and dish rows derive from PublicMenu data", async () => {
  const source = await readFile(bookPath, "utf8");
  assert.match(source, /getVisiblePublicMenuCategories\(menu\.dishes\)/);
  assert.match(source, /getPublicMenuCategoryGroups\(menu\.dishes\)/);
  assert.match(source, /groups\.get\(category\.id\)/);
  assert.match(source, /dishes\.map\(\(dish\)/);
  assert.match(source, /dishes\.find\(isSignature\)/);
  assert.doesNotMatch(source, /Betterave sous la cendre|Canard à l’érable noir/);
  assert.doesNotMatch(source, /\.sort\(/);
});

test("Sauge Noire keeps empty media slots and defers real 3D to intent", async () => {
  const book = await readFile(bookPath, "utf8");
  const detail = await readFile(detailPath, "utf8");
  assert.match(book, /data-photo-slot/);
  assert.match(book, /dish\.imageUrl \?/);
  assert.match(detail, /hasReal3d/);
  assert.match(detail, /showModelViewer/);
  assert.match(detail, /dynamic<.*DishModelViewer/);
  assert.doesNotMatch(book, /\.glb|\.usdz|model-viewer/);
});

test("locale and currency remain part of menu and dish navigation state", async () => {
  const book = await readFile(bookPath, "utf8");
  const detail = await readFile(detailPath, "utf8");
  assert.match(book, /params\.set\("view", `sauge-\$\{pageIndex\}`\)/);
  assert.match(book, /params\.set\("currency", next\.currency\)/);
  assert.match(book, /params\.set\("lang", next\.locale\)/);
  assert.match(detail, /currency,/);
  assert.match(detail, /view: `sauge-/);
});

test("Sauge Noire preferences use compact popovers and page escape controls", async () => {
  const book = await readFile(bookPath, "utf8");
  const styles = await readFile(
    new URL("../components/menu/unique/sauge-noire/SaugeNoireBookMenu.module.css", import.meta.url),
    "utf8"
  );
  assert.match(book, /function PreferenceMenu/);
  assert.match(book, /aria-haspopup="menu"/);
  assert.match(book, /role="menuitemradio"/);
  assert.match(book, /backToTop/);
  assert.match(book, /contentsBack/);
  assert.match(styles, /\.preferencePopover/);
  assert.match(styles, /\.backToTop/);
});

test("detail page uses the existing allergen disclosure contract and has no AR CTA", async () => {
  const source = await readFile(detailPath, "utf8");
  assert.match(source, /getAllergenDisplayGroups/);
  assert.match(source, /AllergenWarning/);
  assert.doesNotMatch(source, /Réalité augmentée|Ouvrir l’aperçu AR|AR preview/i);
});

test("dish-to-dish navigation turns the detail page before routing", async () => {
  const source = await readFile(detailPath, "utf8");
  const styles = await readFile(
    new URL("../components/menu/unique/sauge-noire/SaugeNoireDishDetail.module.css", import.meta.url),
    "utf8"
  );
  assert.match(source, /type DishTurnDirection = "next" \| "previous"/);
  assert.match(source, /requestDishNavigation/);
  assert.match(source, /setPageTurn\(\{ dishId: dish\.id, direction \}\)/);
  assert.match(source, /onPointerCancel/);
  assert.match(source, /handleDishLinkClick\(event, targetNextHref, "next"\)/);
  assert.match(source, /handleDishLinkClick\(event, targetPreviousHref, "previous"\)/);
  assert.match(source, /transitionDish/);
  assert.match(source, /renderDishPaper\(transitionDish, true\)/);
  assert.match(source, /data-transition-preview/);
  assert.match(source, /function stopDishSwipePropagation/);
  assert.match(source, /className=\{styles\.modelStage\}[\s\S]*onPointerDown=\{stopDishSwipePropagation\}[\s\S]*onPointerUp=\{stopDishSwipePropagation\}/);
  assert.match(styles, /\.pageTurnNext/);
  assert.match(styles, /\.pageTurnPrevious/);
  assert.match(styles, /\.transitionPreview\s*\{[\s\S]*position:\s*absolute;[\s\S]*pointer-events:\s*none;/);
  assert.match(styles, /\.pageTurnNext,[\s\S]*\.pageTurnPrevious\s*\{[\s\S]*z-index:\s*2;/);
  assert.match(styles, /@keyframes detailPageTurnNext/);
  assert.match(styles, /@keyframes detailPageTurnPrevious/);
  assert.match(source, /SAUGE_PAGE_FLIP_DURATION_MS = 720/);
  assert.match(source, /\}, SAUGE_PAGE_FLIP_DURATION_MS\);/);
  assert.match(styles, /detailPageTurnNext 720ms linear/);
  assert.match(styles, /detailPageTurnPrevious 720ms linear/);
  assert.match(styles, /rotateY\(-180deg\)/);
  assert.match(styles, /rotateY\(180deg\)/);
  assert.match(styles, /@media \(max-width: 700px\)\s*\{[\s\S]*\.detailPage\s*\{[\s\S]*height:\s*auto;[\s\S]*overflow:\s*visible;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.rail\s*\{[\s\S]*position:\s*sticky;[\s\S]*align-self:\s*flex-start;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.paper\s*\{[\s\S]*height:\s*auto;[\s\S]*overflow:\s*visible;/);
  assert.match(styles, /\.detailHeader\s*\{[\s\S]*position:\s*relative;[\s\S]*width:\s*100%;[\s\S]*height:\s*170px;/);
  assert.doesNotMatch(styles, /\.detailHeader\s*\{[^}]*position:\s*(?:fixed|sticky);/);
  assert.match(styles, /\.detailHeader > \.brandMark\s*\{[\s\S]*top:\s*78px;[\s\S]*left:\s*calc\(50% - 5px\);/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.detailHeader\s*\{[\s\S]*height:\s*135px;[\s\S]*padding:\s*0;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.detailHeader > \.brandMark\s*\{[\s\S]*top:\s*65px;/);
});

test("Sauge Noire chrome is normal-flow content inside its scrollable sheet", async () => {
  const detail = await readFile(detailPath, "utf8");
  const bookStyles = await readFile(bookStylesPath, "utf8");
  const detailStyles = await readFile(detailStylesPath, "utf8");
  assert.match(bookStyles, /\.bookHeader\s*\{[\s\S]*position:\s*relative;/);
  assert.match(detail, /renderDishPaper[\s\S]*\{!isPreview \?[\s\S]*<DishDetailHeader/);
  assert.match(detail, /<div className=\{styles\.detailSurface\}>/);
  assert.match(detailStyles, /\.detailSurface\s*\{[\s\S]*perspective:\s*2000px;/);
  assert.match(detailStyles, /\.detailHeader\s*\{[\s\S]*position:\s*relative;/);
  assert.doesNotMatch(detailStyles, /\.detailHeader\s*\{[^}]*position:\s*(?:fixed|sticky);/);
  assert.match(detailStyles, /\.detailContent\s*\{[\s\S]*padding:\s*0 clamp\(16px, 5vw, 74px\) 54px;/);
  assert.match(detailStyles, /@media \(max-width: 700px\)[\s\S]*\.detailContent\s*\{[\s\S]*padding-inline:\s*14px;/);
  assert.match(detailStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.detailPage \.doubleArrow\s*\{[\s\S]*animation:\s*detailDoubleArrowNudge 1\.8s ease-in-out infinite !important;/);
});
