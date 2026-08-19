import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const bookPath = new URL(
  "../components/menu/unique/sauge-noire/SaugeNoireBookMenu.tsx",
  import.meta.url
);
const menuPagesPath = new URL(
  "../components/menu/unique/sauge-noire/SaugeNoireMenuPages.tsx",
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
const mediaReadinessPath = new URL(
  "../components/menu/unique/sauge-noire/SaugeNoireMediaReadiness.ts",
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
const menuLayoutPath = new URL("../app/(fr)/menu/[slug]/layout.tsx", import.meta.url);
const playwrightConfigPath = new URL("../playwright.config.ts", import.meta.url);
const publicMenuPath = new URL("../app/(fr)/menu/[slug]/page.tsx", import.meta.url);
const ownerPreviewPath = new URL(
  "../app/(fr)/owner/restaurants/[restaurantId]/unique-ui/preview/page.tsx",
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

test("awaiting destination uses readiness signals and has a bounded watchdog", async () => {
  const coordinator = await readFile(transitionCoordinatorPath, "utf8");
  const mediaReadiness = await readFile(mediaReadinessPath, "utf8");
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
  assert.doesNotMatch(coordinator, /const pollDestinationReadiness/);
  assert.doesNotMatch(coordinator, /mutationObserver\?\.observe\(document\.body/);
  assert.match(coordinator, /routeRendererRef/);
  assert.match(coordinator, /new MutationObserver/);
  assert.match(coordinator, /new ResizeObserver/);
  assert.match(coordinator, /destinationRendererIsReady\(\)/);
  assert.match(mediaReadiness, /mediaIsRelevantForReadiness/);
  assert.match(mediaReadiness, /loading.*lazy/);
  assert.match(mediaReadiness, /projectedScrollTop/);
  assert.match(mediaReadiness, /triggerLazy/);
  assert.match(mediaReadiness, /element\.loading = "eager"/);
  assert.match(mediaReadiness, /element\.preload = "metadata"/);
  assert.match(mediaReadiness, /element\.load\(\)/);
  assert.match(
    coordinator,
    /readinessMediaForSurface\(activePage,\s*\{[\s\S]*projectedScrollTop:\s*settledPreviewScrollTopRef\.current/
  );
  assert.match(coordinator, /mediaCleanup\(\)/);
  assert.match(coordinator, /removeEventListener\("load", handleMediaSignal\)/);
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
  assert.match(
    coordinator,
    /destinationReadyTransitionIdRef\.current = null;[\s\S]*destinationReadinessCheckRef\.current\?\.\(\)/
  );
  assert.match(
    coordinator,
    /destinationReadinessCheckRef\.current = checkDestinationReadiness/
  );
  assert.match(
    coordinator,
    /if \(!destinationRendererIsReady\(\)\) \{[\s\S]*watchdogFallbackTransitionIdRef\.current !== current\.id[\s\S]*destinationReadyTransitionIdRef\.current = null;[\s\S]*cancelAnimationFrame\(handoffFrameRef\.current\)[\s\S]*return;[\s\S]*\}\s*watchdogFallbackTransitionIdRef\.current = null;[\s\S]*destinationReadyTransitionIdRef\.current = current\.id;[\s\S]*tryCompleteHandoff\(\)/
  );
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

test("watchdog readiness survives a settled gesture until handoff completion", async () => {
  const coordinator = await readFile(transitionCoordinatorPath, "utf8");

  assert.match(coordinator, /watchdogFallbackTransitionIdRef = useRef<string \| null>\(null\)/);
  assert.match(
    coordinator,
    /watchdogFallbackTransitionIdRef\.current = latest\.id;[\s\S]*destinationReadyTransitionIdRef\.current = latest\.id/
  );
  assert.match(
    coordinator,
    /watchdogFallbackTransitionIdRef\.current === current\.id[\s\S]*destinationReadyTransitionIdRef\.current = watchdogFallbackForCurrent\s*\?\s*current\.id\s*:\s*null/
  );
  assert.match(
    coordinator,
    /if \(watchdogFallbackTransitionIdRef\.current !== current\.id\) \{[\s\S]*destinationReadyTransitionIdRef\.current = null/
  );
  assert.match(
    coordinator,
    /const current = transitionRef\.current;[\s\S]*handoffReadyForCurrent[\s\S]*destinationReadyTransitionIdRef\.current === current\.id/
  );
  assert.match(
    coordinator,
    /if \(!handoffReadyForCurrent\) \{[\s\S]*destinationReadinessCheckRef\.current\?\.\(\);[\s\S]*\}[\s\S]*tryCompleteHandoff\(\)/
  );
});

test("aborted route handoffs release their scheduled frame for later transitions", async () => {
  const coordinator = await readFile(transitionCoordinatorPath, "utf8");

  assert.match(
    coordinator,
    /cancelAnimationFrame\(handoffFrameRef\.current\);\s*handoffFrameRef\.current = 0;/g
  );
  assert.match(
    coordinator,
    /window\.cancelAnimationFrame\(handoffFrameRef\.current\);\s*handoffFrameRef\.current = 0;\s*window\.clearTimeout\(awaitingDestinationWatchdogRef\.current\)/
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

test("a target sheet decodes its leading photo before the physical flip starts", async () => {
  const experiment = await readFile(experimentPath, "utf8");

  assert.match(experiment, /const TARGET_MEDIA_DECODE_TIMEOUT_MS = \d+/);
  assert.match(experiment, /async function waitForPreparedPhysicalPageMedia/);
  assert.match(experiment, /await waitForPreparedPhysicalPageMedia/);
  assert.match(experiment, /const startPreparedFlip = useCallback/);
  assert.match(experiment, /startPreparedFlip\(/);
  assert.match(experiment, /const \[mediaPreparing, setMediaPreparing\] = useState\(false\)/);
  assert.match(experiment, /readyBookKeyRef\.current !== preparedBookKey/);
  assert.match(experiment, /const preparedFlipLaunchFrameRef = useRef\(0\)/);
  assert.match(
    experiment,
    /preparedFlipLaunchFrameRef\.current = window\.requestAnimationFrame\(\(\) => \{[\s\S]*preparedFlipLaunchFrameRef\.current = window\.requestAnimationFrame/
  );
  assert.match(
    experiment,
    /window\.cancelAnimationFrame\(preparedFlipLaunchFrameRef\.current\)/
  );
  assert.match(experiment, /flipPreparationTokenRef\.current \+= 1;[\s\S]*setMediaPreparing\(false\);[\s\S]*turnToPage/);
  assert.match(experiment, /const applyRecenter = \(\) =>/);
  assert.match(experiment, /pageFlip\.getState\(\) !== "read"[\s\S]*requestAnimationFrame\(applyRecenter\)/);
  assert.match(experiment, /pageFlip\.turnToPage\(recenterPage\);\s*lastRecenterTokenRef\.current = recenterToken/);
  assert.match(experiment, /data-page-flip-media-preparing="true"/);
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

  assert.match(experiment, /type ScrollHandoffTransition/);
  assert.match(experiment, /sourceSurface: HTMLDivElement \| null/);
  assert.match(experiment, /captureSourceScrollHandoff/);
  assert.match(
    experiment,
    /transition\.latestSourceScrollTop - transition\.sourceScrollTop/
  );
  assert.match(experiment, /sourceIdentity: readingIdentity/);
  assert.match(experiment, /targetIdentity: null/);
  assert.match(experiment, /sequence: \+\+scrollHandoffSequenceRef\.current/);
  assert.match(
    experiment,
    /\(readyScrollTop \?\? 0\) \+ gestureDelta/
  );
  assert.match(experiment, /data-page-flip-gesture-delta/);
  assert.match(experiment, /data-page-flip-prepared-scroll-top/);
  assert.match(experiment, /transition\.handoffApplied = true/);
  assert.match(experiment, /stableFrames < 2/);
  assert.match(experiment, /new ResizeObserver/);
  assert.doesNotMatch(experiment, /animationSourceClearFrameRef/);
  assert.match(
    experiment,
    /clearAnimationSourceIfApplied[\s\S]*animationSourceScrollRef\.current === candidate[\s\S]*animationSourceScrollRef\.current = null/
  );
  assert.doesNotMatch(experiment, /settledSurface\.scrollTop\s*=/);
  assert.match(
    experiment,
    /state === "read"[\s\S]*clearAnimationSourceIfApplied\(\)/
  );
  assert.doesNotMatch(
    experiment,
    /if \(state === "read"\) animationSourceScrollRef\.current = null/
  );
});

test("scroll handoff ignores below-fold lazy media and cleans every readiness signal", async () => {
  const experiment = await readFile(experimentPath, "utf8");
  const mediaReadiness = await readFile(mediaReadinessPath, "utf8");

  assert.match(mediaReadiness, /element\.getAttribute\("loading"\) !== "lazy"/);
  assert.match(mediaReadiness, /mediaIsPrepared\(element\)/);
  assert.match(mediaReadiness, /projectedBottom > viewportTop/);
  assert.match(mediaReadiness, /triggerLazy/);
  assert.match(
    experiment,
    /readinessMediaForSurface\(targetSurface,\s*\{[\s\S]*projectedScrollTop:\s*projectedHandoffScrollTop\(\)[\s\S]*triggerLazy: true/
  );
  assert.match(experiment, /const mediaIsPending = \(\) =>/);
  assert.match(experiment, /scrollHandoffMediaCleanupRef\.current\?\.\(\)/);
  assert.match(experiment, /removeEventListener\("loadedmetadata", handleMediaSignal\)/);
  assert.match(experiment, /scrollHandoffResizeObserverRef\.current\?\.disconnect\(\)/);
  assert.match(experiment, /scrollHandoffMutationObserverRef\.current\?\.disconnect\(\)/);
  assert.match(experiment, /readingSurface\.scrollTop = preparedScrollTop/);
  assert.match(experiment, /gestureDelta[\s\S]*projectedHandoffScrollTop/);
});

test("scroll handoff waits for real layout/media signals and stops after fixed-surface stabilization", async () => {
  const experiment = await readFile(experimentPath, "utf8");
  const handoffStart = experiment.indexOf(
    "    transition.targetIdentity = readingIdentity;"
  );
  const handoffEnd = experiment.indexOf(
    "  }, [cancelScrollHandoff, clearAnimationSourceIfApplied",
    handoffStart
  );
  assert.notEqual(handoffStart, -1);
  assert.notEqual(handoffEnd, -1);
  const handoff = experiment.slice(handoffStart, handoffEnd);

  assert.match(handoff, /const mediaIsPending = \(\) =>/);
  assert.match(handoff, /document\.fonts\?\.status === "loading"/);
  assert.match(handoff, /element\.addEventListener\("load"/);
  assert.match(handoff, /element\.addEventListener\("loadedmetadata"/);
  assert.match(handoff, /new ResizeObserver\(handleLayoutSignal\)/);
  assert.match(handoff, /new MutationObserver\(handleLayoutSignal\)/);
  assert.match(handoff, /resizeObserver\.observe\(readingContent\)/);
  assert.match(handoff, /mutationObserver\.observe\(targetSurface/);
  assert.match(handoff, /window\.addEventListener\("resize", handleWindowResize\)/);
  assert.match(handoff, /document\.fonts\?\.ready\.then\(\(\) => \{[\s\S]*cancelled/);

  assert.match(handoff, /const hasScrollableHeight/);
  assert.match(
    handoff,
    /const preparedScrollTop = hasScrollableHeight[\s\S]*?: 0;/
  );
  assert.match(
    handoff,
    /readingSurface\.setAttribute\(\s*"data-page-flip-handoff-applied",\s*"true"\s*\)/
  );
  assert.match(handoff, /data-page-flip-handoff-raf-requested/);
  assert.match(handoff, /const finish = \(\) => \{\s*cancelScrollHandoff\(\);\s*\};/);
  assert.match(handoff, /scrollHandoffResizeObserverRef\.current = resizeObserver/);
  assert.match(handoff, /scrollHandoffMutationObserverRef\.current = mutationObserver/);
  assert.doesNotMatch(handoff, /setTimeout/);
  assert.doesNotMatch(handoff, /animationSourceClearFrameRef/);
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
    /!hasReadingSurface \|\|[\s\S]*engineState === "flipping" \|\| singleFlipJumpKeepsEngineVisible/
  );
  assert.match(
    experiment,
    /contentInert=\{[\s\S]*engineState === "flipping"[\s\S]*singleFlipJumpKeepsEngineVisible[\s\S]*!readingSurfaceOwnsScroll/
  );
  assert.match(
    experiment,
    /onError=\{\(\) => \{[\s\S]*interruptedSingleFlipJump[\s\S]*cancelAnimationFrame\(singleFlipJumpFrameRef\.current\)[\s\S]*activeSingleFlipJumpRef\.current = null;[\s\S]*requestedPageIndexRef\.current = null;[\s\S]*animationTargetPageRef\.current = null;[\s\S]*onSingleFlipJumpSettledRef\.current\?\.\(interruptedSingleFlipJump\)[\s\S]*setFailed\(true\)/
  );
});

test("multi-page jumps resume when PageFlip returns to read", async () => {
  const experiment = await readFile(experimentPath, "utf8");

  assert.match(
    experiment,
    /\}, \[[\s\S]*bookIsReady,[\s\S]*engineState,[\s\S]*pageIndex,[\s\S]*startPreparedFlip,[\s\S]*singleFlipJumpRequest[\s\S]*\]\);/
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

test("the Sauge browser fixture provides versioned public dish photos", async () => {
  const {
    maisonFixture,
    restaurantId,
    saugeNoireFixture,
    trouvableFixture
  } = await import(
    "../e2e/support/sauge-noire-fixture-data.mjs"
  );
  const { fixtureDishSha256 } = await import(
    "../e2e/support/fixture-dish-images.mjs"
  );
  const saugeDishes = saugeNoireFixture.menu_dishes;

  assert.equal(saugeDishes.length, 36);
  assert.equal(maisonFixture.menu_dishes.length, 1);
  assert.equal(trouvableFixture.menu_dishes.length, 1);
  assert.equal(saugeDishes[1].slug, "betterave-sous-la-cendre");
  assert.ok(
    !trouvableFixture.menu_dishes[0].image_url.includes("maison-elyse")
  );
  assert.ok(
    !trouvableFixture.menu_dishes[0].image_url.includes("sauge-noire")
  );
  assert.ok(
    saugeDishes.every((dish) => {
      const photoStoragePath = dish.metadata?.photoStoragePath ?? "";
      return (
        dish.restaurant_id === restaurantId &&
        typeof dish.image_url === "string" &&
        dish.image_url === `/api/public/menu-dishes/${dish.id}/photo` &&
        dish.metadata?.photoStatus === "ready" &&
        dish.metadata?.photoSha256 ===
          fixtureDishSha256({
            dishName: dish.name,
            restaurantName: "Sauge Noire",
            sourceKey: photoStoragePath
          })
      );
    })
  );
});

test("the Sauge browser fixture exposes one lightweight local 3D model", async () => {
  const { saugeNoireFixture } = await import(
    "../e2e/support/sauge-noire-fixture-data.mjs"
  );
  const truite = saugeNoireFixture.menu_dishes.find(
    (dish) => dish.slug === "truite-des-laurentides"
  );
  assert.equal(truite?.web_model_3d_url, "/models/demo/maison-elyse-n1.glb");
  assert.equal(truite?.model_3d_url, truite?.web_model_3d_url);
  assert.equal(
    saugeNoireFixture.menu_dishes.filter((dish) => dish.web_model_3d_url).length,
    1
  );
  assert.ok(truite?.web_model_3d_url.startsWith("/models/demo/"));
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
  const menuPages = await readFile(menuPagesPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");

  assert.match(menuPages, /const isShortSection = !isSplit && dishes\.length <= 4/);
  assert.match(menuPages, /isShortSection \? styles\.shortSectionPage : ""/);
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
  assert.match(
    experiment,
    /addEventListener\("touchmove", handleTouchMove, \{[\s\S]*passive: false/
  );
  assert.match(
    experiment,
    /removeEventListener\("touchmove", handleTouchMove\)/
  );
  assert.match(experiment, /onTouchEnd=\{handleTouchEnd\}/);
  assert.match(experiment, /onTouchCancel=\{handleTouchCancel\}/);
  assert.match(experiment, /animationTargetPageRef/);
  assert.match(experiment, /requestedTargetPageIndex > sourcePageIndex/);
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
  assert.match(experiment, /const FLICK_VELOCITY = 0\.3/);
  assert.match(experiment, /const FLICK_RECENCY_MS = 160/);
  assert.match(
    experiment,
    /gesture\.lastTime - gesture\.velocityTime <= FLICK_RECENCY_MS/
  );
  assert.match(
    experiment,
    /Math\.sign\(gesture\.velocityX\) === Math\.sign\(gesture\.deltaX\)/
  );
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
  const [book, menuPages] = await Promise.all([
    readFile(bookPath, "utf8"),
    readFile(menuPagesPath, "utf8")
  ]);
  const styles = await readFile(stylesPath, "utf8");

  assert.doesNotMatch(`${book}\n${menuPages}`, /saugenoire\.com/);
  assert.match(menuPages, /data-testid="google-review-cta"/);
  assert.match(book, /Laisser un avis Google/);
  assert.match(menuPages, /\{copy\.googleReview\}/);
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
