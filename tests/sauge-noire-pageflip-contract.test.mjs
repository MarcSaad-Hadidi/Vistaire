import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const bookPath = new URL(
  "../components/menu/unique/sauge-noire/SaugeNoireBookMenu.tsx",
  import.meta.url
);
const experimentPath = new URL(
  "../components/menu/unique/sauge-noire/SaugeNoirePageFlipExperiment.tsx",
  import.meta.url
);
const flipPagePath = new URL(
  "../components/menu/unique/sauge-noire/SaugeNoireFlipPage.tsx",
  import.meta.url
);
const publicMenuPath = new URL("../app/menu/[slug]/page.tsx", import.meta.url);
const ownerPreviewPath = new URL(
  "../app/owner/restaurants/[restaurantId]/unique-ui/preview/page.tsx",
  import.meta.url
);
const stylesPath = new URL(
  "../components/menu/unique/sauge-noire/SaugeNoireBookMenu.module.css",
  import.meta.url
);

test("page flip is enabled on the public renderer and remains opt-in in the builder", async () => {
  const book = await readFile(bookPath, "utf8");
  const publicMenu = await readFile(publicMenuPath, "utf8");
  const ownerPreview = await readFile(ownerPreviewPath, "utf8");

  assert.match(book, /mode === "public"/);
  assert.match(book, /mode === "builder-preview" && searchParams\.get\("pageFlipLab"\) === "1"/);
  assert.match(book, /data-page-flip-mode/);
  assert.match(publicMenu, /mode="public"/);
  assert.match(ownerPreview, /mode="builder-preview"/);
});

test("the animated renderer reuses the existing page renderer", async () => {
  const book = await readFile(bookPath, "utf8");
  const experiment = await readFile(experimentPath, "utf8");

  assert.match(book, /function buildPages\(menu: PublicMenu\)/);
  assert.match(book, /const flipPages = useMemo/);
  assert.match(book, /renderPage\(currentPage, pageIndex\)/);
  assert.match(book, /pageFlipEnabled \? \(/);
  assert.match(book, /renderPage\(currentPage, pageIndex\)\s*\n\s*\)}/);
  assert.match(book, /setPageIndex\(\(current\) => \(current === nextIndex \? current : nextIndex\)\)/);
  assert.doesNotMatch(book, /\}, \[pageIndex, pages\.length\]\);/);
  assert.doesNotMatch(experiment, /CANONICAL_DISHES|Betterave sous la cendre|Crabe des neiges/);
  assert.doesNotMatch(experiment, /const COPY|function buildPages/);
});

test("lab uses real HTML pages, hard covers, soft internals, and the supported StPageFlip controls", async () => {
  const experiment = await readFile(experimentPath, "utf8");
  const flipPage = await readFile(flipPagePath, "utf8");

  assert.match(experiment, /import HTMLFlipBook from "react-pageflip"/);
  assert.match(experiment, /showCover/);
  assert.match(experiment, /mobileScrollSupport/);
  assert.match(experiment, /minWidth=\{Math\.max\(100, dimensions\.width\)\}/);
  assert.match(experiment, /swipeDistance=\{44\}/);
  assert.match(experiment, /clickEventForward/);
  assert.match(experiment, /disableFlipByClick=\{false\}/);
  assert.match(experiment, /useMouseEvents=\{false\}/);
  assert.match(experiment, /showPageCorners=\{false\}/);
  assert.match(experiment, /onPointerDown=\{handlePointerDown\}/);
  assert.match(experiment, /onPointerMove=\{handlePointerMove\}/);
  assert.match(experiment, /onPointerUp=\{handlePointerUp\}/);
  assert.match(experiment, /onTouchStart=\{handleTouchStart\}/);
  assert.match(experiment, /onTouchEnd=\{handleTouchEnd\}/);
  assert.match(experiment, /pageFlip\.flip\(pageIndex\)/);
  assert.match(experiment, /onPageFlip\(nextIndex\)/);
  assert.match(flipPage, /SaugeNoireFlipPageDensity = "hard" \| "soft"/);
  assert.match(flipPage, /data-density=\{density\}/);
  assert.match(flipPage, /data-sauge-flip-page-index=\{index\}/);
});

test("page swipes can start on dish links without hijacking real controls", async () => {
  const experiment = await readFile(experimentPath, "utf8");

  assert.match(
    experiment,
    /target\.closest\(\s*"input, select, textarea, \[contenteditable=true\], \[data-no-page-flip\]"/
  );
  assert.doesNotMatch(
    experiment,
    /target\.closest\(\s*"button, input, select, textarea/
  );
  assert.match(experiment, /const SWIPE_DISTANCE = 32/);
  assert.match(experiment, /Math\.abs\(deltaX\) <= Math\.abs\(deltaY\)/);
});

test("lab does not introduce document or raster substitutes", async () => {
  const experiment = await readFile(experimentPath, "utf8");
  const flipPage = await readFile(flipPagePath, "utf8");

  for (const source of [experiment, flipPage]) {
    assert.doesNotMatch(source, /\.pdf|PDF\.js|<iframe|<canvas|canvas\b/i);
  }
});

test("page flip cleanup and clone focus protection are explicit", async () => {
  const experiment = await readFile(experimentPath, "utf8");

  assert.match(experiment, /pageFlip\.destroy\(\)/);
  assert.match(experiment, /MutationObserver/);
  assert.match(experiment, /data-sauge-flip-clone/);
  assert.match(experiment, /aria-hidden/);
  assert.match(experiment, /setAttribute\("inert", ""\)/);
  assert.match(experiment, /button, a, input, select, textarea/);
});

test("the book keeps its frame fixed while contents and dish pages can scroll when needed", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(styles, /\.book\s*\{[\s\S]*position:\s*fixed;[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /\.paper\s*\{[\s\S]*display:\s*block;[\s\S]*overflow:\s*hidden;/);
  assert.match(
    styles,
    /\.bookHeader\s*\{[\s\S]*position:\s*absolute;[\s\S]*top:\s*0;[\s\S]*left:\s*var\(--sn-rail\);[\s\S]*width:\s*calc\(100% - var\(--sn-rail\)\);/
  );
  assert.match(
    styles,
    /\.bookHeader > \.brandMark\s*\{[\s\S]*position:\s*absolute;[\s\S]*left:\s*50%;/
  );
  assert.match(styles, /\.bookHeader\s*\{[\s\S]*margin-bottom:\s*-92px;/);
  assert.match(styles, /\.pageFlipPage\s*\{[\s\S]*overflow:\s*auto;/);
  assert.match(styles, /\.pageFlipPage\s*\{[\s\S]*overscroll-behavior:\s*contain;/);
  assert.match(styles, /\.pageFlipPage:has\(\.coverPage\)\s*\{[\s\S]*overflow:\s*clip;/);
  assert.doesNotMatch(styles, /\.pageFlipPage:has\(\.coverPage\),[\s\S]*\.pageFlipPage:has\(\.contentsPage\)/);
  assert.match(styles, /\.pageFlipFallback:has\(\.coverPage\)\s*\{[\s\S]*overflow:\s*clip;/);
  assert.doesNotMatch(styles, /\.pageFlipFallback:has\(\.coverPage\),[\s\S]*\.pageFlipFallback:has\(\.contentsPage\)/);
  assert.match(styles, /\.pageViewport\s*\{[\s\S]*height:\s*100%;[\s\S]*min-height:\s*0;[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /\.pageFlipBook\s*\{[\s\S]*height:\s*100%;[\s\S]*min-height:\s*0;[\s\S]*overflow:\s*hidden;/);
});
