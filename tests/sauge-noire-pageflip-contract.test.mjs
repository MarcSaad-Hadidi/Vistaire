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

test("section headers keep their contents control stable during page flips", async () => {
  const book = await readFile(bookPath, "utf8");

  assert.match(book, /showContentsLink=\{index > 1\}/);
  assert.doesNotMatch(book, /showContentsLink=\{pageIndex > 1\}/);
});

test("completed page flips clear stale animation targets", async () => {
  const experiment = await readFile(experimentPath, "utf8");

  assert.match(
    experiment,
    /requestedPageIndexRef\.current = null;\s*animationTargetPageRef\.current = null;\s*onPageFlip\(nextIndex\)/,
  );
});

test("multi-page contents jumps keep animating until the requested page", async () => {
  const experiment = await readFile(experimentPath, "utf8");

  assert.match(
    experiment,
    /const animationTarget = animationTargetPageRef\.current;\s*if \(animationTarget !== null && nextIndex !== animationTarget\)/,
  );
});

test("short non-split sections lift their navigation into the first viewport", async () => {
  const book = await readFile(bookPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.match(book, /const isShortSection = !isSplit && dishes\.length <= 4/);
  assert.match(book, /isShortSection \? styles\.shortSectionPage : ""/);
  assert.match(styles, /\.shortSectionPage \.pageFooter\s*\{\s*transform: translateY\(-64px\)/);
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
  assert.match(experiment, /animationTargetPageRef/);
  assert.match(experiment, /targetPage > currentPage/);
  assert.match(experiment, /pageFlip\.flipNext\(\)/);
  assert.match(experiment, /pageFlip\.flipPrev\(\)/);
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
  assert.match(experiment, /function isPageFlipInteractiveTarget/);
  assert.match(experiment, /target\.closest\("a, button"\)/);
  assert.match(experiment, /if \(!isPageFlipInteractiveTarget\(event\.target\)\)/);
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

test("the book keeps its frame fixed while each sheet owns its complete scrolling chrome", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(styles, /\.book\s*\{[\s\S]*position:\s*fixed;[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /\.paper\s*\{[\s\S]*display:\s*block;[\s\S]*overflow:\s*hidden;/);
  assert.match(
    styles,
    /\.bookHeader\s*\{[\s\S]*position:\s*relative;[\s\S]*width:\s*100%;[\s\S]*height:\s*132px;[\s\S]*overflow:\s*visible;/
  );
  assert.doesNotMatch(styles, /\.bookHeader\s*\{[^}]*position:\s*(?:fixed|sticky);/);
  assert.match(styles, /\.bookHeader > \.brandMark\s*\{[\s\S]*position:\s*absolute;[\s\S]*left:\s*calc\(50% - 5px\);/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.bookHeader > \.brandMark\s*\{[\s\S]*top:\s*65px;/);
  assert.doesNotMatch(styles, /margin-bottom:\s*-92px;/);
  assert.match(styles, /\.pageFlipPage\s*\{[\s\S]*overflow:\s*auto;/);
  assert.match(styles, /\.pageFlipPage\s*\{[\s\S]*overscroll-behavior:\s*contain;/);
  assert.match(styles, /\.pageFlipPage:has\(\.coverPage\)\s*\{[\s\S]*overflow:\s*clip;/);
  assert.doesNotMatch(styles, /\.pageFlipPage:has\(\.coverPage\),[\s\S]*\.pageFlipPage:has\(\.contentsPage\)/);
  assert.match(styles, /\.pageFlipFallback:has\(\.coverPage\)\s*\{[\s\S]*overflow:\s*clip;/);
  assert.doesNotMatch(styles, /\.pageFlipFallback:has\(\.coverPage\),[\s\S]*\.pageFlipFallback:has\(\.contentsPage\)/);
  assert.match(styles, /\.pageViewport\s*\{[\s\S]*height:\s*100%;[\s\S]*min-height:\s*0;[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /\.pageFlipBook\s*\{[\s\S]*height:\s*100%;[\s\S]*min-height:\s*0;[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.coverOpen\s*\{[\s\S]*margin-top:\s*20px;[\s\S]*padding-top:\s*0;/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.book \.arrow\s*\{[\s\S]*animation:\s*saugeArrowNudge 1\.8s ease-in-out infinite !important;/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.book \.doubleArrow\s*\{[\s\S]*animation:\s*saugeDoubleArrowNudge 1\.8s ease-in-out infinite !important;/);
});

test("the table of contents is compact enough to stay inside the sheet", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(styles, /\.contentsPage\s*\{[\s\S]*min-height:\s*calc\(100% - 132px\);[\s\S]*padding-top:\s*16px;[\s\S]*padding-bottom:\s*16px;/);
  assert.match(styles, /\.contentsBotanical\s*\{[\s\S]*height:\s*clamp\(100px, 14vh, 130px\);/);
  assert.match(styles, /\.contentsList button\s*\{[\s\S]*min-height:\s*44px;/);
  assert.match(styles, /\.contentsPage \.pageFooter\s*\{[\s\S]*padding:\s*12px 0 14px;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.contentsPage\s*\{[\s\S]*min-height:\s*calc\(100% - 132px\);[\s\S]*padding-top:\s*12px;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.contentsBotanical\s*\{[\s\S]*height:\s*104px;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.contentsList button\s*\{[\s\S]*min-height:\s*42px;/);
});

test("the ending page is compact and includes a Google review CTA without the old domain", async () => {
  const book = await readFile(bookPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.doesNotMatch(book, /saugenoire\.com/);
  assert.match(book, /data-testid="google-review-cta"/);
  assert.match(book, /Laisser un avis Google/);
  assert.match(styles, /\.endingPage\s*\{[\s\S]*min-height:\s*calc\(100% - 132px\);[\s\S]*padding-top:\s*34px;[\s\S]*padding-bottom:\s*22px;/);
  assert.match(styles, /\.endingBotanical\s*\{[\s\S]*height:\s*clamp\(150px, 28vh, 260px\);/);
  assert.match(styles, /\.googleReviewCta\s*\{[\s\S]*width:\s*min\(100%, 360px\);[\s\S]*min-height:\s*52px;/);
  assert.match(styles, /\.googleReviewBrand\s*\{[\s\S]*font-family:\s*"BT Suave", Georgia, serif;[\s\S]*font-weight:\s*400;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.endingPage\s*\{[\s\S]*min-height:\s*calc\(100% - 132px\);[\s\S]*padding-top:\s*16px;[\s\S]*padding-bottom:\s*20px;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.endingBotanical\s*\{[\s\S]*height:\s*140px;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.googleReviewCta\s*\{[\s\S]*width:\s*min\(100%, 320px\);[\s\S]*min-height:\s*48px;/);
});
