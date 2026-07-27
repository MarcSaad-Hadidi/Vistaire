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
const forbiddenDetailFloatingClass = ["detail", "Floating", "Brand", "Mark"].join("");

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
  assert.match(source, /remainingDishes\.map\(\(dish\)/);
  assert.match(source, /dishes\.find\(isSignature\)/);
  assert.doesNotMatch(source, /Betterave sous la cendre|Canard à l’érable noir/);
  assert.doesNotMatch(source, /\.sort\(/);
});

test("featured dishes use stable ids and never render a second row", async () => {
  const source = await readFile(bookPath, "utf8");
  const singleDishId = "single-dish";
  const singleDishRemaining = [{ id: singleDishId }].filter(
    (dish) => dish.id !== singleDishId
  );

  assert.match(
    source,
    /const remainingDishes = featured\s*\?\s*dishes\.filter\(\(dish\) => dish\.id !== featured\.id\)\s*:\s*dishes;/
  );
  assert.match(source, /\{remainingDishes\.map\(\(dish\) => \(/);
  assert.match(source, /data-sauge-featured-dish/);
  assert.match(source, /data-sauge-dish-row/);
  assert.match(source, /data-dish-id=\{dish\.id\}/);
  assert.deepEqual(singleDishRemaining, []);
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

test("dish-to-dish navigation prepares adjacent dishes without duplicating their chrome", async () => {
  const source = await readFile(detailPath, "utf8");
  const styles = await readFile(
    new URL("../components/menu/unique/sauge-noire/SaugeNoireDishDetail.module.css", import.meta.url),
    "utf8"
  );
  assert.match(source, /type DishTurnDirection = "next" \| "previous"/);
  assert.match(source, /requestDishNavigation/);
  assert.match(source, /querySelector<HTMLElement>\("\[data-page-flip-state\]"\)/);
  assert.match(source, /if \(pageFlipState !== "ready"\) return;/);
  assert.match(source, /targetPageIndex: direction === "next" \? 2 : 0/);
  assert.match(source, /handleDishLinkClick\(event, targetNextHref, "next"\)/);
  assert.match(source, /handleDishLinkClick\(event, targetPreviousHref, "previous"\)/);
  assert.match(source, /const previousPageDish =/);
  assert.match(source, /const nextPageDish =/);
  assert.match(source, /key="previous-page"/);
  assert.match(source, /key="current-page"/);
  assert.match(source, /key="next-page"/);
  assert.doesNotMatch(source, /key=\{activePageTurn \?/);
  assert.match(source, /isPreview=\{isPreview\}/);
  assert.match(source, /<div className=\{styles\.brandMark\} aria-label="Sauge Noire">/);
  assert.doesNotMatch(source, new RegExp(forbiddenDetailFloatingClass));
  assert.match(source, /draggable=\{false\}/);
  assert.match(source, /data-transition-preview/);
  assert.match(source, /function stopDishSwipePropagation/);
  assert.match(source, /className=\{styles\.modelStage\}[\s\S]*onPointerDown=\{stopDishSwipePropagation\}[\s\S]*onPointerUp=\{stopDishSwipePropagation\}/);
  assert.match(styles, /\.transitionPreview\s*\{[\s\S]*pointer-events:\s*none;/);
  assert.doesNotMatch(styles, /\.transitionPreview \.detailHeader[\s\S]*visibility:\s*hidden/);
  assert.doesNotMatch(styles, /data-sauge-flip-clone="true"[\s\S]*visibility:\s*hidden/);
  assert.doesNotMatch(styles, /detailPageTurnNext|detailPageTurnPrevious|rotateY\(180deg\)/);
  assert.match(styles, /\.detailPage\s*\{[\s\S]*background-color:\s*var\(--sn-paper\);[\s\S]*background-image:\s*var\(--sn-paper-texture\);[\s\S]*background-size:\s*var\(--sn-paper-texture-size\);/);
  assert.match(styles, /\.detailPage\s*\{[\s\S]*position:\s*fixed;[\s\S]*inset:\s*0;[\s\S]*width:\s*100%;[\s\S]*height:\s*100svh;[\s\S]*overflow:\s*hidden;[\s\S]*overscroll-behavior:\s*none;[\s\S]*isolation:\s*isolate;/);
  assert.match(styles, /@supports \(height: 100dvh\)[\s\S]*\.detailPage,\s*\.detailSurface,\s*\.rail\s*\{[\s\S]*height:\s*100dvh;[\s\S]*min-height:\s*100dvh;/);
  assert.match(styles, /@media \(max-width: 700px\)\s*\{[\s\S]*\.detailPage\s*\{[\s\S]*height:\s*100svh;[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.rail\s*\{[\s\S]*position:\s*relative;[\s\S]*align-self:\s*flex-start;/);
  assert.match(styles, /\.paper\s*\{[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /\.detailSurface\s*\{[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.paper\s*\{[\s\S]*height:\s*auto;[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /\.detailHeader\s*\{[\s\S]*position:\s*relative;[\s\S]*width:\s*100%;[\s\S]*height:\s*170px;/);
  assert.doesNotMatch(styles, /\.detailHeader\s*\{[^}]*position:\s*(?:fixed|sticky);/);
  assert.match(styles, /\.detailHeader > \.brandMark\s*\{[\s\S]*top:\s*78px;[\s\S]*left:\s*calc\(50% - 5px\);/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.detailHeader\s*\{[\s\S]*height:\s*135px;[\s\S]*padding:\s*0;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.detailHeader > \.brandMark\s*\{[\s\S]*top:\s*65px;/);
});

test("dish-to-dish navigation uses one stable three-sheet PageFlip and waits for onFlip", async () => {
  const detail = await readFile(detailPath, "utf8");
  const experiment = await readFile(
    new URL("../components/menu/unique/sauge-noire/SaugeNoirePageFlipExperiment.tsx", import.meta.url),
    "utf8"
  );
  const flipPage = await readFile(
    new URL("../components/menu/unique/sauge-noire/SaugeNoireFlipPage.tsx", import.meta.url),
    "utf8"
  );
  const styles = await readFile(detailStylesPath, "utf8");

  assert.match(detail, /SaugeNoirePageFlipExperiment/);
  assert.match(detail, /SaugeNoireFlipPage/);
  assert.match(detail, /showCover=\{false\}/);
  assert.match(detail, /onPageFlip=\{handleDetailPageFlip\}/);
  assert.match(detail, /key="previous-page"/);
  assert.match(detail, /key="current-page"/);
  assert.match(detail, /key="next-page"/);
  assert.match(detail, /pageIndex=\{activePageTurn\?\.targetPageIndex \?\? 1\}/);
  assert.match(detail, /startPage=\{1\}/);
  assert.match(detail, /interceptSwipe/);
  assert.match(detail, /resetKey=\{dish\.id\}/);
  assert.doesNotMatch(detail, /<SaugeNoirePageFlipExperiment\s+key=/);
  assert.match(experiment, /startPage\?: number/);
  assert.match(experiment, /showCover\?: boolean/);
  assert.match(experiment, /showCover=\{showCover\}/);
  assert.match(experiment, /onSwipe\?: \(direction: "next" \| "previous"\)/);
  assert.match(experiment, /interceptSwipe\?: boolean/);
  assert.match(experiment, /resetKey\?: string \| number/);
  assert.match(experiment, /turnToPage: \(page: number\) => void/);
  assert.match(experiment, /pageFlip\.turnToPage\(startPage\)/);
  assert.match(flipPage, /density: SaugeNoireFlipPageDensity/);
  assert.doesNotMatch(detail, /SAUGE_PAGE_FLIP_DURATION_MS/);
  assert.doesNotMatch(detail, /setTimeout\([\s\S]*router\.push/);
  assert.doesNotMatch(styles, /detailPageTurnNext|detailPageTurnPrevious|rotateY\(180deg\)/);
});

test("dish PageFlip gestures lock horizontal direction and protect interactive surfaces", async () => {
  const detail = await readFile(detailPath, "utf8");
  const experiment = await readFile(
    new URL("../components/menu/unique/sauge-noire/SaugeNoirePageFlipExperiment.tsx", import.meta.url),
    "utf8"
  );

  assert.match(detail, /protectInteractiveTargets/);
  assert.match(detail, /data-no-page-flip="true"/);
  assert.match(experiment, /gestureStartRef/);
  assert.match(experiment, /axis: "undecided" \| "horizontal" \| "vertical"/);
  assert.match(experiment, /setPointerCapture/);
  assert.match(experiment, /onPointerMove=\{handlePointerMove\}/);
  assert.match(experiment, /onPointerCancel=\{handlePointerCancel\}/);
  assert.match(experiment, /isPageFlipInteractiveTarget\(target\)/);
  assert.match(experiment, /onSwipe\(deltaX < 0 \? "next" : "previous"\)/);
});

test("Sauge Noire detail chrome belongs to each PageFlip sheet", async () => {
  const detail = await readFile(detailPath, "utf8");
  const bookStyles = await readFile(bookStylesPath, "utf8");
  const detailStyles = await readFile(detailStylesPath, "utf8");
  assert.match(bookStyles, /\.bookHeader\s*\{[\s\S]*position:\s*relative;/);
  assert.match(detail, /renderDishPaper[\s\S]*<DishDetailHeader[\s\S]*isPreview=\{isPreview\}/);
  assert.match(detail, /function DishDetailHeader[\s\S]*<div className=\{styles\.brandMark\} aria-label="Sauge Noire">/);
  assert.doesNotMatch(detail, new RegExp(forbiddenDetailFloatingClass));
  assert.match(detail, /<div className=\{styles\.detailSurface\}[^>]*data-detail-page-flip="true"/);
  assert.match(detailStyles, /\.detailPage\s*\{[\s\S]*position:\s*fixed;[\s\S]*inset:\s*0;[\s\S]*overscroll-behavior:\s*none;[\s\S]*isolation:\s*isolate;/);
  assert.match(detailStyles, /\.detailSurface\s*\{[\s\S]*overflow:\s*hidden;/);
  assert.match(detailStyles, /\.paper\s*\{[\s\S]*overflow:\s*hidden;/);
  assert.match(bookStyles, /\.pageFlipPage\s*\{[\s\S]*overflow:\s*auto;/);
  assert.match(detailStyles, /\.detailHeader\s*\{[\s\S]*position:\s*relative;/);
  assert.doesNotMatch(detailStyles, /\.detailHeader\s*\{[^}]*position:\s*(?:fixed|sticky);/);
  assert.match(detailStyles, /\.detailContent\s*\{[\s\S]*padding:\s*0 clamp\(16px, 5vw, 74px\) 54px;/);
  assert.match(detailStyles, /@media \(max-width: 700px\)[\s\S]*\.detailContent\s*\{[\s\S]*padding-inline:\s*14px;/);
  assert.match(detailStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.detailPage \.doubleArrow\s*\{[\s\S]*animation:\s*detailDoubleArrowNudge 1\.8s ease-in-out infinite !important;/);
});
