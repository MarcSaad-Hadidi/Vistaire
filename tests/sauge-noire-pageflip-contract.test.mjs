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
const routeTransitionPath = new URL(
  "../components/menu/unique/sauge-noire/SaugeNoireRoutePageFlip.tsx",
  import.meta.url
);
const transitionCoordinatorPath = new URL(
  "../components/menu/unique/sauge-noire/SaugeNoireTransitionCoordinator.tsx",
  import.meta.url
);
const readingSurfacePath = new URL(
  "../components/menu/unique/sauge-noire/SaugeNoireReadingSurface.tsx",
  import.meta.url
);
const readingSurfaceStylesPath = new URL(
  "../components/menu/unique/sauge-noire/SaugeNoireReadingSurface.module.css",
  import.meta.url
);
const menuLayoutPath = new URL("../app/menu/[slug]/layout.tsx", import.meta.url);
const playwrightConfigPath = new URL("../playwright.config.ts", import.meta.url);
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
  assert.match(book, /renderPage\(currentPage, pageIndex/);
  assert.match(book, /pageFlipEnabled \? \(/);
  assert.match(book, /renderPage\(currentPage, pageIndex[^\n]*\)\s*\n\s*\)}/);
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

test("route transitions live in the shared layout until the destination book is ready", async () => {
  const book = await readFile(bookPath, "utf8");
  const detail = await readFile(
    new URL("../components/menu/unique/sauge-noire/SaugeNoireDishDetail.tsx", import.meta.url),
    "utf8"
  );
  const routeTransition = await readFile(routeTransitionPath, "utf8");
  const coordinator = await readFile(transitionCoordinatorPath, "utf8").catch(() => "");
  const layout = await readFile(menuLayoutPath, "utf8");

  assert.match(routeTransition, /pages = useMemo/);
  assert.match(routeTransition, /density="soft"/g);
  assert.match(routeTransition, /index=\{startPage\}[\s\S]*index=\{targetPage\}/);
  assert.match(
    routeTransition,
    /direction === "next"\s*\? \[sourcePage, destinationPage\]\s*:\s*\[destinationPage, sourcePage\]/
  );
  assert.match(routeTransition, /showCover=\{false\}/);
  assert.match(routeTransition, /renderOnlyPageLengthChange/);
  assert.match(routeTransition, /onFlip\(\)/);
  assert.match(routeTransition, /onChangeState/);
  assert.match(routeTransition, /started/);
  assert.match(routeTransition, /reachedTarget/);
  assert.match(routeTransition, /returnedToRead/);
  assert.match(routeTransition, /onFallback/);
  assert.doesNotMatch(book, /<SaugeNoireRoutePageFlip/);
  assert.doesNotMatch(detail, /<SaugeNoireRoutePageFlip/);
  assert.match(layout, /<SaugeNoireTransitionCoordinator>/);
  assert.match(coordinator, /<SaugeNoireRoutePageFlip/);
  assert.match(
    coordinator,
    /phase:\s*"preparing"\s*\|\s*"animating"\s*\|\s*"awaiting-destination"/
  );
  assert.match(coordinator, /router\.push\(current\.href\)/);
  assert.match(coordinator, /notifyDestinationReady/);
  assert.match(coordinator, /destinationRendererIsReady/);
  assert.match(coordinator, /data-page-flip-engine-state/);
  assert.match(coordinator, /requestAnimationFrame/);
  assert.doesNotMatch(
    coordinator,
    /visibility:\s*routeIsHidden|aria-hidden=\{routeIsHidden|setAttribute\("inert", ""\)/
  );
  assert.match(routeTransition, /aria-hidden="true"\s+inert/);
  assert.match(
    coordinator,
    /const handleOverlayFallback[\s\S]*current\.phase === "awaiting-destination"[\s\S]*router\.push\(current\.href\)/
  );
  assert.match(coordinator, /overlayFallbackPendingRef = useRef\(false\)/);
  assert.match(
    coordinator,
    /current\.phase === "preparing"[\s\S]*routeGestureActiveRef\.current[\s\S]*overlayFallbackPendingRef\.current = true/
  );
  assert.match(
    coordinator,
    /if \(overlayFallbackPendingRef\.current\)[\s\S]*updatePhase\("awaiting-destination"\);[\s\S]*router\.push\(current\.href\)/
  );
  assert.match(coordinator, /onFallback=\{handleOverlayFallback\}/);
  assert.match(
    coordinator,
    /targetActivated=\{transition\.phase !== "preparing"\}/
  );
  assert.match(routeTransition, /targetActivated:\s*boolean/);
  assert.match(
    routeTransition,
    /pageIndex=\{targetActivated \? targetPage : startPage\}/
  );
  assert.match(routeTransition, /data-sauge-route-transition-phase=\{phase\}/);
  assert.match(
    routeTransition,
    /data-sauge-route-transition-current-page=\{targetActivated \? targetPage : startPage\}/
  );
  assert.match(coordinator, /destinationReadyTransitionIdRef/);
  assert.match(coordinator, /const tryCompleteHandoff/);
  assert.match(
    coordinator,
    /destinationReadyTransitionIdRef\.current = current\.id;[\s\S]*tryCompleteHandoff\(\)/
  );
  assert.match(
    coordinator,
    /useEffect\(\(\) => \{[\s\S]*pathnameRef\.current = pathname;[\s\S]*tryCompleteHandoff\(\);[\s\S]*\}, \[pathname, tryCompleteHandoff\]\)/
  );
  assert.doesNotMatch(book, /router\.push\(href\)/);
  assert.match(book, /onError=\{notifyCurrentRouteReady\}/);
  assert.match(detail, /onError=\{notifyCurrentRouteReady\}/);
  assert.doesNotMatch(book, /renderPage,\s*routeTransition\]/);
  assert.doesNotMatch(detail, /query,\s*routeTransition\]/);
  assert.match(
    routeTransition,
    /completedRef\.current \|\|[\s\S]*escapePhaseRef\.current !== escapePhase[\s\S]*completedRef\.current = true;\s*onFallback\(\);/
  );
  assert.match(routeTransition, /const ROUTE_PREPARATION_TIMEOUT_MS = 2_500/);
  assert.match(routeTransition, /const ROUTE_ANIMATION_TIMEOUT_MS = 2_500/);
  assert.match(
    routeTransition,
    /phase === "preparing"[\s\S]*ROUTE_PREPARATION_TIMEOUT_MS[\s\S]*phase === "animating"[\s\S]*ROUTE_ANIMATION_TIMEOUT_MS[\s\S]*window\.setTimeout[\s\S]*escapeTimeoutMs[\s\S]*\}, \[onFallback, phase\]\)/
  );
});

test("awaiting destination polls frame-only readiness and has a bounded watchdog", async () => {
  const coordinator = await readFile(transitionCoordinatorPath, "utf8");
  const routeTransition = await readFile(routeTransitionPath, "utf8");

  assert.match(coordinator, /const AWAITING_DESTINATION_TIMEOUT_MS = 6_000/);
  assert.match(coordinator, /settledPreviewScrollTopRef = useRef\(0\)/);
  assert.match(coordinator, /settledPreviewScrollTopRef\.current = 0/);
  assert.match(coordinator, /onSettledPreviewScrollTopChange/);
  assert.match(coordinator, /const transferDestinationScroll/);
  assert.match(
    coordinator,
    /Math\.min\(\s*maxScroll,\s*Math\.max\(0, settledPreviewScrollTopRef\.current\)\s*\)/
  );
  assert.match(
    coordinator,
    /Math\.abs\(activePage\.scrollTop - desiredScrollTop\) > 1[\s\S]*activePage\.scrollTop = desiredScrollTop/
  );
  assert.match(coordinator, /const pollDestinationReadiness/);
  assert.match(
    coordinator,
    /readinessFrameRef\.current = window\.requestAnimationFrame\(\s*pollDestinationReadiness\s*\)/
  );
  assert.match(
    coordinator,
    /awaitingDestinationWatchdogRef\.current = window\.setTimeout/
  );
  assert.match(
    coordinator,
    /data-sauge-reading-surface="true"\]\[data-sauge-handoff-candidate="true"/
  );
  assert.match(coordinator, /settledPreviewGestureActiveRef/);
  assert.match(coordinator, /if \(settledPreviewGestureActiveRef\.current\) return/);
  assert.match(coordinator, /onRouteGestureActiveChange/);
  assert.match(coordinator, /routeScrollOwnerActive/);
  assert.doesNotMatch(coordinator, /resolveSaugeNoireOriginalPage/);
  assert.match(coordinator, /window\.location\.assign\(latest\.href\)/);
  assert.match(routeTransition, /phase !== "preparing"/);
  assert.match(routeTransition, /data-sauge-route-transition-scrollable/);
  assert.match(routeTransition, /addEventListener\("scroll", handleScroll, \{ passive: true \}\)/);
  assert.match(routeTransition, /data-sauge-route-settled-surface="true"/);
  assert.match(
    routeTransition,
    /data-sauge-route-scroll-owner=\{[\s\S]*phase !== "preparing"[\s\S]*"true"/
  );
  assert.match(routeTransition, /onSettledPreviewGestureActiveChange/);
  assert.doesNotMatch(routeTransition, /data-sauge-route-preview-scroll-target/);
  assert.doesNotMatch(
    routeTransition,
    /resolveSaugeNoireOriginalPage\(overlay,\s*targetPage\)/
  );
});

test("the real PageFlip wrapper exposes the stable-child and lifecycle controls", async () => {
  const experiment = await readFile(experimentPath, "utf8");
  const flipPage = await readFile(flipPagePath, "utf8");

  assert.match(experiment, /onReady\?: \(\) => void/);
  assert.match(experiment, /onError\?: \(\) => void/);
  assert.match(experiment, /renderOnlyPageLengthChange\?: boolean/);
  assert.match(experiment, /renderOnlyPageLengthChange=\{renderOnlyPageLengthChange\}/);
  assert.match(experiment, /const onReadyRef = useRef\(onReady\)/);
  assert.match(experiment, /readyScrollTop\?: number/);
  assert.match(experiment, /resolveSaugeNoireOriginalPage/);
  assert.match(experiment, /originalPagesRef = useRef<Map<number, HTMLElement>>/);
  assert.doesNotMatch(experiment, /pageElements\.length !== pages\.length/);
  assert.match(flipPage, /data-sauge-page-origin="react-original"/);
  assert.match(flipPage, /data-sauge-page-instance-id=/);
  assert.match(flipPage, /SAUGE_REACT_ORIGINAL_PAGE/);
  assert.match(experiment, /mainImage\.decode\(\)\.then\(finish, finish\)/);
  assert.match(experiment, /window\.setTimeout\(finish, 2_000\)/);
  assert.match(experiment, /mainImage\.getBoundingClientRect\(\)\.width <= 0/);
  assert.match(experiment, /onReadyRef\.current\?\.\(\)/);
  assert.doesNotMatch(experiment, /onInit=\{\(\) => \{[\s\S]*onReady\?\.\(\)/);
  assert.match(experiment, /onError\?\.\(\)/);
  assert.match(experiment, /const \[actualPageIndex, setActualPageIndex\] = useState\(startPage\)/);
  assert.match(experiment, /setActualPageIndex\(nextIndex\)/);
  assert.match(experiment, /data-page-flip-actual-page=\{actualPageIndex\}/);
});

test("PageFlip resizes in place for structural width and height changes", async () => {
  const experiment = await readFile(experimentPath, "utf8");

  assert.match(experiment, /const RESIZE_ROUNDING_NOISE_PX = 1/);
  assert.match(experiment, /widthChanged/);
  assert.match(experiment, /orientationChanged/);
  assert.doesNotMatch(experiment, /pendingDimensionUpdateRef/);
  assert.match(experiment, /pendingStructuralDimensionsRef/);
  assert.match(experiment, /const settings = pageFlip\.getSettings\(\)/);
  assert.match(experiment, /settings\.width = currentDimensions\.width/);
  assert.match(experiment, /settings\.height = currentDimensions\.height/);
  assert.match(experiment, /settings\.minWidth = Math\.max\(100, currentDimensions\.width\)/);
  assert.match(experiment, /settings\.maxWidth = currentDimensions\.width/);
  assert.match(experiment, /settings\.minHeight = Math\.max\(100, currentDimensions\.height\)/);
  assert.match(experiment, /settings\.maxHeight = currentDimensions\.height/);
  assert.match(experiment, /pageFlip\.update\(\)/);
  assert.match(
    experiment,
    /appliedDimensionKeyRef\.current === dimensionKey[\s\S]*pendingStructuralDimensionsRef\.current = null/
  );
});

test("the canonical reading surface is visible while PageFlip initializes", async () => {
  const experiment = await readFile(experimentPath, "utf8");
  const readingSurface = await readFile(readingSurfacePath, "utf8");

  assert.doesNotMatch(experiment, /pageFlipInitializing/);
  assert.equal((experiment.match(/data-page-flip-fallback=/g) ?? []).length, 2);
  assert.match(experiment, /!hasReadingSurface && !failed && !bookIsReady/);
  assert.match(experiment, /<SaugeNoireReadingSurface/);
  assert.match(readingSurface, /data-sauge-reading-surface="true"/);
  assert.match(readingSurface, /data-sauge-scroll-owner=\{scrollOwner \? "true" : "false"\}/);
  assert.match(readingSurface, /data-sauge-reading-content="true"/);
  assert.match(readingSurface, /inert=\{contentInert \|\| preview \? true : undefined\}/);
  assert.match(
    readingSurface,
    /window\.addEventListener\("pointerup", finishGlobalPointer, true\)/
  );
  assert.match(
    readingSurface,
    /window\.addEventListener\("pointercancel", finishGlobalPointer, true\)/
  );
  assert.doesNotMatch(readingSurface, /setPointerCapture/);
  assert.match(experiment, /visible=\{hasReadingSurface\}/);
  assert.match(experiment, /scrollOwner=\{readingSurfaceOwnsScroll\}/);
});

test("a short vertical gesture during a flip survives the reading-page commit", async () => {
  const experiment = await readFile(experimentPath, "utf8");

  assert.match(
    experiment,
    /source && source\.readingIdentity !== readingIdentity[\s\S]*readingSurface\.scrollTop - source\.scrollTop/
  );
  assert.match(experiment, /readingIdentity,\s*scrollTop: sourceScrollTop/);
  assert.match(
    experiment,
    /\(readyScrollTop \?\? 0\) \+ gestureDelta/
  );
  assert.match(experiment, /data-page-flip-gesture-delta/);
  assert.match(experiment, /data-page-flip-prepared-scroll-top/);
  assert.match(experiment, /animationSourceClearFrameRef = useRef\(0\)/);
  assert.match(
    experiment,
    /requestAnimationFrame\(\(\) => \{[\s\S]*animationSourceScrollRef\.current === completedSource[\s\S]*animationSourceScrollRef\.current = null/
  );
  assert.doesNotMatch(experiment, /settledSurface\.scrollTop\s*=/);
  assert.match(
    experiment,
    /state === "read"[\s\S]*requestAnimationFrame\(\(\) => \{[\s\S]*animationSourceScrollRef\.current = null/
  );
  assert.doesNotMatch(
    experiment,
    /if \(state === "read"\) animationSourceScrollRef\.current = null/
  );
});

test("only static reading pages restore the definite full-height chain", async () => {
  const styles = await readFile(readingSurfaceStylesPath, "utf8");

  assert.match(
    styles,
    /\.content:has\(> \[data-sauge-static-frame\]\)\s*\{[\s\S]*width:\s*100%;[\s\S]*height:\s*100%;[\s\S]*min-height:\s*0;/
  );
  assert.doesNotMatch(
    styles,
    /\.content\s*\{[^}]*?(?:^|[;\s])height:\s*100%;/m
  );
});

test("a permanent PageFlip error returns to the canonical reading surface", async () => {
  const experiment = await readFile(experimentPath, "utf8");

  assert.match(experiment, /data-page-flip-fallback="error"/);
  assert.match(experiment, /data-page-flip-fallback="loading"[\s\S]*aria-hidden="true"/);
  assert.match(
    experiment,
    /visible=\{hasReadingSurface\}/
  );
  assert.match(
    experiment,
    /!hasReadingSurface \|\| \(!failed && engineState === "flipping"\)/
  );
  assert.match(
    experiment,
    /contentInert=\{[\s\S]*\(!failed && engineState === "flipping"\)[\s\S]*!readingSurfaceOwnsScroll/
  );
  assert.match(
    experiment,
    /onError=\{\(\) => \{[\s\S]*cancelAnimationFrame\(animationSourceClearFrameRef\.current\)[\s\S]*animationSourceScrollRef\.current = null;[\s\S]*setFailed\(true\)/
  );
});

test("multi-page jumps resume when PageFlip returns to read", async () => {
  const experiment = await readFile(experimentPath, "utf8");

  assert.match(
    experiment,
    /\}, \[[\s\S]*bookIsReady,[\s\S]*engineState,[\s\S]*pageIndex,[\s\S]*revealEngineForFlip,[\s\S]*singleFlipJumpRequest[\s\S]*\]\);/
  );
});

test("multi-page contents jumps keep animating until the requested page", async () => {
  const experiment = await readFile(experimentPath, "utf8");

  assert.match(
    experiment,
    /const animationTarget = animationTargetPageRef\.current;[\s\S]*?if \(animationTarget !== null && nextIndex !== animationTarget\)/,
  );
  assert.match(experiment, /reportedFlipPageRef/);
});

test("the Sauge browser fixture provides local dish photos", async () => {
  const { rows } = await import("../e2e/support/sauge-noire-fixture-data.mjs");

  assert.equal(rows.menu_dishes.length, 36);
  assert.equal(rows.menu_dishes[1].slug, "betterave-sous-la-cendre");
  assert.ok(
    rows.menu_dishes.every((dish) =>
      typeof dish.image_url === "string" &&
      dish.image_url.startsWith("/images/demo/dishes/")
    )
  );
});

test("a direct WebKit project selection remains available inside Playwright workers", async () => {
  const config = await readFile(playwrightConfigPath, "utf8");

  assert.match(config, /const cliRequestsWebkit = process\.argv\.some/);
  assert.match(
    config,
    /if \(cliRequestsWebkit\) process\.env\.PLAYWRIGHT_INCLUDE_WEBKIT = "1"/
  );
  assert.match(
    config,
    /const includeWebkit = process\.env\.PLAYWRIGHT_INCLUDE_WEBKIT === "1"/
  );
  assert.match(
    config,
    /if \(cliIncludesSaugeNoireBrowserFlow\) process\.env\.VISTAIRE_SAUGE_NOIRE_FIXTURE = "1"/
  );
  assert.match(
    config,
    /const saugeNoireFixture = process\.env\.VISTAIRE_SAUGE_NOIRE_FIXTURE === "1"/
  );
  assert.match(
    config,
    /webServer: saugeNoireFixture \? \[[\s\S]*command: fixtureStartCommand/
  );
});

test("short non-split sections keep navigation below the final dish", async () => {
  const book = await readFile(bookPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.match(book, /const isShortSection = !isSplit && dishes\.length <= 4/);
  assert.match(book, /isShortSection \? styles\.shortSectionPage : ""/);
  assert.match(styles, /\.shortSectionPage \.pageFooter\s*\{\s*transform: none/);
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
  assert.match(experiment, /onTouchMove=\{handleTouchMove\}/);
  assert.match(experiment, /onTouchEnd=\{handleTouchEnd\}/);
  assert.match(experiment, /onTouchCancel=\{handleTouchCancel\}/);
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

  assert.match(experiment, /\[data-no-page-flip\], \[data-sauge-swipe-block\]/);
  assert.match(experiment, /\[contenteditable\]:not\(\[contenteditable="false"\]\)/);
  assert.doesNotMatch(experiment, /function isPageFlipInteractiveTarget/);
  assert.match(experiment, /type GesturePhase =[\s\S]*"candidate"[\s\S]*"consumed"/);
  assert.match(experiment, /event\.currentTarget\.setPointerCapture/);
  assert.match(experiment, /const SWIPE_DISTANCE = 44/);
  assert.match(experiment, /const FLICK_VELOCITY = 0\.45/);
  assert.match(experiment, /onClickCapture=\{handleClickCapture\}/);
  assert.match(experiment, /event\.detail === 0/);
  assert.match(experiment, /!event\.isTrusted/);
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
  assert.match(styles, /--sn-header-height:\s*132px;/);
  assert.match(
    styles,
    /\.bookHeader\s*\{[\s\S]*position:\s*relative;[\s\S]*width:\s*100%;[\s\S]*height:\s*var\(--sn-header-height\);[\s\S]*overflow:\s*visible;/
  );
  assert.doesNotMatch(styles, /\.bookHeader\s*\{[^}]*position:\s*(?:fixed|sticky);/);
  assert.match(styles, /\.bookHeader > \.brandMark\s*\{[\s\S]*position:\s*absolute;[\s\S]*left:\s*calc\(50% - 5px\);/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.bookHeader > \.brandMark\s*\{[\s\S]*top:\s*65px;/);
  assert.doesNotMatch(styles, /margin-bottom:\s*-92px;/);
  assert.match(styles, /\.pageFlipPage\s*\{[\s\S]*overflow:\s*auto;/);
  assert.match(styles, /\.pageFlipPage\s*\{[\s\S]*overscroll-behavior:\s*contain;/);
  assert.match(styles, /\.pageFlipPage:has\(> \.staticPageFrame\)\s*\{[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /\.pageFlipFallback:has\(> \.staticPageFrame\)\s*\{[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /\.staticPageFrame\s*\{[\s\S]*display:\s*flex;[\s\S]*height:\s*100%;[\s\S]*min-height:\s*0;[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /\.staticPageFrame > \.page\s*\{[\s\S]*height:\s*auto;[\s\S]*min-height:\s*0;[\s\S]*flex:\s*1 1 auto;[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /\.pageViewport\s*\{[\s\S]*height:\s*100%;[\s\S]*min-height:\s*0;[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /\.pageFlipBook\s*\{[\s\S]*height:\s*100%;[\s\S]*min-height:\s*0 !important;[\s\S]*overflow:\s*hidden;/);
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
  assert.match(styles, /\.googleReviewCta\s*\{[\s\S]*width:\s*fit-content;[\s\S]*max-width:\s*min\(100%, 300px\);[\s\S]*min-height:\s*44px;[\s\S]*border-radius:\s*13px;[\s\S]*background:\s*var\(--sn-paper\);/);
  assert.match(styles, /\.googleReviewBrand\s*\{[\s\S]*font-family:\s*"BT Suave", Georgia, serif;[\s\S]*font-weight:\s*400;/);
  assert.match(styles, /\.googleReviewMark\s*\{[\s\S]*color:\s*var\(--sn-bronze\);/);
  assert.doesNotMatch(styles, /\.googleReviewMark\s*\{[\s\S]*conic-gradient/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.endingPage\s*\{[\s\S]*min-height:\s*calc\(100% - 132px\);[\s\S]*padding-top:\s*16px;[\s\S]*padding-bottom:\s*20px;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.endingBotanical\s*\{[\s\S]*height:\s*140px;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.googleReviewCta\s*\{[\s\S]*width:\s*fit-content;[\s\S]*max-width:\s*calc\(100% - 24px\);[\s\S]*min-height:\s*42px;/);
});
