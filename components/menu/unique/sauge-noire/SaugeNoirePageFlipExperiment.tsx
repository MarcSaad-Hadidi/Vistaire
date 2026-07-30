"use client";

import HTMLFlipBook from "react-pageflip";
import {
  Component,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import styles from "./SaugeNoireBookMenu.module.css";
import {
  resolveSaugeNoireOriginalPage,
  SaugeNoirePhysicalPageMediaContext,
  SaugeNoireOriginalPageRegistryContext
} from "./SaugeNoireFlipPage";
import {
  SaugeNoireReadingSurface,
  type SaugeNoireReadingKind
} from "./SaugeNoireReadingSurface";

type PageFlipApi = {
  getCurrentPageIndex: () => number;
  turnToPage: (page: number) => void;
  flipNext: () => void;
  flipPrev: () => void;
  getState: () => string;
  getSettings: () => {
    width: number;
    height: number;
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
  };
  update: () => void;
  destroy: () => void;
};

type PageFlipHandle = {
  pageFlip: () => PageFlipApi | undefined;
};

type PageFlipEvent = {
  data?: number | string;
};

export type SingleFlipJumpRequest = Readonly<{
  token: number;
  direction: "previous" | "next";
  finalPage: number;
}>;

type ActiveSingleFlipJump = {
  token: number;
  direction: "previous" | "next";
  finalPage: number;
  adjacentPage: number;
  sawFlipping: boolean;
  reachedAdjacent: boolean;
  phase: "single-flip" | "instant-jump";
};

type SingleFlipJumpPhase =
  | "idle"
  | "requested"
  | "single-flip-started"
  | "adjacent-page-reached"
  | "read-after-single-flip"
  | "instant-jump-to-target"
  | "completed";

type GesturePhase =
  | "idle"
  | "candidate"
  | "horizontal"
  | "vertical"
  | "consumed"
  | "cancelled";

type GestureSession = {
  phase: GesturePhase;
  sequence: number;
  pointerId: number | null;
  pointerType: string;
  target: Element | null;
  clickScope: Element | null;
  startX: number;
  startY: number;
  startTime: number;
  lastX: number;
  lastY: number;
  lastTime: number;
  deltaX: number;
  deltaY: number;
  velocityX: number;
  velocityTime: number;
  captured: boolean;
  consumed: boolean;
  suppressClick: boolean;
  direction: "next" | "previous" | null;
};

type ConsumedClickSuppression = {
  sequence: number;
  pointerId: number;
  pointerType: string;
  target: Element | null;
  clickScope: Element | null;
};

type PageFlipErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
  onError: () => void;
};

type PageFlipErrorBoundaryState = {
  hasError: boolean;
};

class PageFlipErrorBoundary extends Component<
  PageFlipErrorBoundaryProps,
  PageFlipErrorBoundaryState
> {
  state: PageFlipErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PageFlipErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(): void {
    this.props.onError();
  }

  render(): ReactNode {
    return this.state.hasError ? (
      <div className={styles.pageFlipFallback} data-page-flip-fallback="error">
        {this.props.fallback}
      </div>
    ) : (
      this.props.children
    );
  }
}

type SaugeNoirePageFlipExperimentProps = {
  pages: ReactNode[];
  readingPages?: ReactNode[];
  readingPage?: ReactNode;
  readingKey?: string | number;
  readingKind?: Exclude<SaugeNoireReadingKind, "route-preview">;
  readingSurfaceOwnsScroll?: boolean;
  onReadingGestureActiveChange?: (active: boolean) => void;
  pageIndex: number;
  startPage?: number;
  onPageFlip: (index: number) => void;
  onReady?: () => void;
  readyScrollTop?: number;
  onChangeState?: (state: string) => void;
  onError?: () => void;
  onSwipe?: (direction: "next" | "previous") => void;
  interceptSwipe?: boolean;
  resetKey?: string | number;
  showCover?: boolean;
  renderOnlyPageLengthChange?: boolean;
  recenterPage?: number;
  recenterToken?: string | number;
  singleFlipJumpRequest?: SingleFlipJumpRequest | null;
  onSingleFlipJumpSettled?: (token: number) => void;
  fallback: ReactNode;
};

type FlipDimensions = {
  width: number;
  height: number;
};

const GESTURE_SLOP = 8;
const GESTURE_CLAIM_DISTANCE = 10;
const HORIZONTAL_CLAIM_RATIO = 1.15;
const VERTICAL_CLAIM_RATIO = 1.3;
const SWIPE_DISTANCE = 44;
const FLICK_DISTANCE = 24;
const FLICK_VELOCITY = 0.3;
const FLICK_RECENCY_MS = 160;
const RESIZE_ROUNDING_NOISE_PX = 1;
const TARGET_MEDIA_DECODE_TIMEOUT_MS = 2_000;

function parsePageIndex(event: PageFlipEvent | number): number | null {
  const value = typeof event === "number" ? event : event.data;
  const index = typeof value === "string" ? Number(value) : value;
  return typeof index === "number" && Number.isInteger(index) && index >= 0
    ? index
    : null;
}

type PhysicalMediaPhase = "rest" | "flip";

function applyPhysicalMediaPolicy(
  viewport: ParentNode,
  preparedPageIndexes: ReadonlySet<number>,
  phase: PhysicalMediaPhase
) {
  viewport
    .querySelectorAll<HTMLImageElement>("img[data-sauge-deferred-src]")
    .forEach((image) => {
      const page = image.closest<HTMLElement>("[data-sauge-flip-page-index]");
      const pageIndex = Number(
        page?.getAttribute("data-sauge-flip-page-index")
      );
      const source = image.getAttribute("data-sauge-deferred-src")?.trim() ?? "";
      const shouldPrepare =
        Number.isInteger(pageIndex) &&
        preparedPageIndexes.has(pageIndex) &&
        Boolean(source);

      if (!shouldPrepare) {
        image.removeAttribute("src");
        image.loading = "lazy";
        image.fetchPriority = "low";
        return;
      }

      image.loading = phase === "flip" ? "eager" : "lazy";
      image.fetchPriority = "low";
      if (image.getAttribute("src") !== source) {
        image.setAttribute("src", source);
      }
    });
}

async function waitForPreparedPhysicalPageMedia(
  viewport: ParentNode,
  targetPageIndex: number
) {
  const targetPage = resolveSaugeNoireOriginalPage(
    viewport,
    targetPageIndex
  );
  const leadingImage = targetPage?.querySelector<HTMLImageElement>(
    "img[data-sauge-deferred-src]"
  );
  if (
    !leadingImage ||
    (leadingImage.complete && leadingImage.naturalWidth > 0)
  ) {
    return;
  }

  leadingImage.loading = "eager";
  leadingImage.fetchPriority = "high";
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      leadingImage.fetchPriority = "low";
      resolve();
    };
    const timeout = window.setTimeout(
      finish,
      TARGET_MEDIA_DECODE_TIMEOUT_MS
    );
    void leadingImage.decode().then(finish, finish);
  });
}

function isPageFlipProtectedTarget(
  target: EventTarget | null,
  path: readonly EventTarget[] = []
): boolean {
  const elements = [
    ...(target instanceof Element ? [target] : []),
    ...path.filter((item): item is Element => item instanceof Element)
  ];
  return elements.some(
    (element) =>
      (element instanceof HTMLElement && element.isContentEditable) ||
      Boolean(
        element.closest(
          "input, select, textarea, " +
            '[contenteditable]:not([contenteditable="false"]), ' +
            "[data-no-page-flip], [data-sauge-swipe-block]"
        )
      )
  );
}

function clickScopeForTarget(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  return target.closest("a, button, [role=link], [role=button]") ?? target;
}

function idleGesture(sequence = 0): GestureSession {
  return {
    phase: "idle",
    sequence,
    pointerId: null,
    pointerType: "",
    target: null,
    clickScope: null,
    startX: 0,
    startY: 0,
    startTime: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    deltaX: 0,
    deltaY: 0,
    velocityX: 0,
    velocityTime: 0,
    captured: false,
    consumed: false,
    suppressClick: false,
    direction: null
  };
}

function updateGestureSample(
  gesture: GestureSession,
  x: number,
  y: number,
  timeStamp: number
) {
  const sampleDeltaX = x - gesture.lastX;
  const sampleDuration = Math.max(1, timeStamp - gesture.lastTime);
  if (Math.abs(sampleDeltaX) > 0.5) {
    gesture.velocityX = sampleDeltaX / sampleDuration;
    gesture.velocityTime = timeStamp;
  }
  gesture.lastX = x;
  gesture.lastY = y;
  gesture.lastTime = timeStamp;
  gesture.deltaX = x - gesture.startX;
  gesture.deltaY = y - gesture.startY;
}

function classifyGesture(gesture: GestureSession) {
  if (gesture.phase !== "candidate") return;
  const absX = Math.abs(gesture.deltaX);
  const absY = Math.abs(gesture.deltaY);
  if (Math.max(absX, absY) < GESTURE_SLOP) return;
  if (
    absX >= GESTURE_CLAIM_DISTANCE &&
    absX >= absY * HORIZONTAL_CLAIM_RATIO
  ) {
    gesture.phase = "horizontal";
    return;
  }
  if (
    absY >= GESTURE_CLAIM_DISTANCE &&
    absY >= absX * VERTICAL_CLAIM_RATIO
  ) {
    gesture.phase = "vertical";
  }
}

type GestureTouchList = ArrayLike<{
  identifier: number;
  clientX: number;
  clientY: number;
}>;

function touchForGesture(
  changedTouches: GestureTouchList,
  touches: GestureTouchList,
  gesture: GestureSession
) {
  return (
    Array.from(changedTouches).find(
      (touch) => touch.identifier === gesture.pointerId
    ) ??
    Array.from(touches).find(
      (touch) => touch.identifier === gesture.pointerId
    )
  );
}

function isCurrentCleanupGeneration(ref: { current: number }, generation: number): boolean {
  return ref.current === generation;
}

export function SaugeNoirePageFlipExperiment({
  pages,
  readingPages,
  readingPage,
  readingKey,
  readingKind = "menu",
  readingSurfaceOwnsScroll = true,
  onReadingGestureActiveChange,
  pageIndex,
  startPage = pageIndex,
  onPageFlip,
  onReady,
  readyScrollTop,
  onChangeState,
  onError,
  onSwipe,
  interceptSwipe = false,
  resetKey,
  showCover = true,
  renderOnlyPageLengthChange = false,
  recenterPage,
  recenterToken,
  singleFlipJumpRequest,
  onSingleFlipJumpSettled,
  fallback
}: SaugeNoirePageFlipExperimentProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<PageFlipHandle>(null);
  const readingSurfaceRef = useRef<HTMLDivElement>(null);
  const originalPagesRef = useRef<Map<number, HTMLElement>>(new Map());
  const readyBookKeyRef = useRef<string | null>(null);
  const requestedPageIndexRef = useRef<number | null>(null);
  const animationTargetPageRef = useRef<number | null>(null);
  const activeSingleFlipJumpRef = useRef<ActiveSingleFlipJump | null>(null);
  const lastSingleFlipJumpTokenRef = useRef<number | null>(null);
  const singleFlipJumpFrameRef = useRef(0);
  const gestureRef = useRef<GestureSession>(idleGesture());
  const gestureSequenceRef = useRef(0);
  const consumedClickRef = useRef<ConsumedClickSuppression | null>(null);
  const [dimensions, setDimensions] = useState<FlipDimensions | null>(null);
  const [readyBookKey, setReadyBookKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [engineState, setEngineState] = useState("idle");
  const [mediaPreparing, setMediaPreparing] = useState(false);
  const [actualPageIndex, setActualPageIndex] = useState(startPage);
  const [singleFlipJumpPhase, setSingleFlipJumpPhase] =
    useState<SingleFlipJumpPhase>("idle");
  const lastResetKeyRef = useRef<string | number | undefined>(resetKey);
  const dimensionsRef = useRef<FlipDimensions | null>(null);
  const onChangeStateRef = useRef(onChangeState);
  const onReadyRef = useRef(onReady);
  const onSingleFlipJumpSettledRef = useRef(onSingleFlipJumpSettled);
  const appliedDimensionKeyRef = useRef<string | null>(null);
  const appliedDimensionsRef = useRef<FlipDimensions | null>(null);
  const pendingStructuralDimensionsRef = useRef<FlipDimensions | null>(null);
  const lastRecenterTokenRef = useRef<string | number | undefined>(recenterToken);
  const failedRef = useRef(false);
  const readyNotificationBookKeyRef = useRef<string | null>(null);
  const cleanupGenerationRef = useRef(0);
  const reportedFlipPageRef = useRef<number | null>(null);
  const sawFlipStateRef = useRef(false);
  const animationSourceScrollRef = useRef<{
    pageIndex: number;
    readingIdentity: string;
    scrollTop: number;
  } | null>(null);
  const animationSourceClearFrameRef = useRef(0);
  const flipPreparationTokenRef = useRef(0);
  const preparedPhysicalPageIndexesRef = useRef<Set<number>>(
    new Set([startPage])
  );
  const initCountRef = useRef(0);
  const hasReadingSurface = readingPage !== undefined || readingPages !== undefined;
  // The DOM identity belongs to the logical book, not to a volatile viewport
  // measurement. PageFlip can recalculate its bounds in place on resize.
  const bookKey = resetKey === undefined ? "sauge-main-book" : `sauge-book-${resetKey}`;
  const bookIsReady = bookKey !== null && readyBookKey === bookKey;
  const activeReadingPage =
    readingPage ?? readingPages?.[pageIndex] ?? fallback;
  const readingIdentity = `${bookKey}:${
    readingKey ?? pageIndex
  }`;
  const singleFlipJumpKeepsEngineVisible =
    singleFlipJumpPhase === "single-flip-started" ||
    singleFlipJumpPhase === "adjacent-page-reached" ||
    singleFlipJumpPhase === "read-after-single-flip" ||
    singleFlipJumpPhase === "instant-jump-to-target";
  const pageFlipEngineVisible =
    !hasReadingSurface ||
    (!failed &&
      (engineState === "flipping" || singleFlipJumpKeepsEngineVisible));
  const originalPageRegistry = useMemo(
    () => ({
      bookId: bookKey,
      register: (index: number, element: HTMLElement) => {
        originalPagesRef.current.set(index, element);
        element.setAttribute("data-sauge-page-origin", "react-original");
        element.removeAttribute("data-sauge-flip-clone");
        element.removeAttribute("data-sauge-page-clone-reason");
        element.removeAttribute("aria-hidden");
        element.removeAttribute("inert");
      },
      unregister: (index: number, element: HTMLElement) => {
        if (originalPagesRef.current.get(index) === element) {
          originalPagesRef.current.delete(index);
        }
      }
    }),
    [bookKey]
  );

  useEffect(() => {
    dimensionsRef.current = dimensions;
    onChangeStateRef.current = onChangeState;
    onReadyRef.current = onReady;
    onSingleFlipJumpSettledRef.current = onSingleFlipJumpSettled;
    failedRef.current = failed;
  }, [dimensions, failed, onChangeState, onReady, onSingleFlipJumpSettled]);

  useLayoutEffect(() => {
    const readingSurface = readingSurfaceRef.current;
    if (!readingSurface) return;
    const source = animationSourceScrollRef.current;
    const gestureDelta =
      source && source.readingIdentity !== readingIdentity
        ? readingSurface.scrollTop - source.scrollTop
        : 0;
    const preparedScrollTop = Math.min(
      Math.max(0, readingSurface.scrollHeight - readingSurface.clientHeight),
      Math.max(0, (readyScrollTop ?? 0) + gestureDelta)
    );
    readingSurface.setAttribute(
      "data-page-flip-prepared-scroll-top",
      String(preparedScrollTop)
    );
    readingSurface.setAttribute(
      "data-page-flip-gesture-delta",
      String(gestureDelta)
    );
    if (readingSurface.scrollTop !== preparedScrollTop) {
      readingSurface.scrollTop = preparedScrollTop;
    }
    if (source && source.readingIdentity !== readingIdentity) {
      const completedSource = source;
      window.cancelAnimationFrame(animationSourceClearFrameRef.current);
      animationSourceClearFrameRef.current = window.requestAnimationFrame(() => {
        if (animationSourceScrollRef.current === completedSource) {
          animationSourceScrollRef.current = null;
        }
      });
    }
  }, [readingIdentity, readyScrollTop]);

  const preparePageFlip = useCallback(
    (sourcePageIndex: number, targetPageIndex: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const preparedPageIndexes = new Set([
        sourcePageIndex,
        targetPageIndex
      ]);
      preparedPhysicalPageIndexesRef.current = preparedPageIndexes;
      applyPhysicalMediaPolicy(viewport, preparedPageIndexes, "flip");
      window.cancelAnimationFrame(animationSourceClearFrameRef.current);
      const sourcePage = resolveSaugeNoireOriginalPage(viewport, sourcePageIndex);
      const targetPage = resolveSaugeNoireOriginalPage(viewport, targetPageIndex);
      const sourceScrollTop = readingSurfaceRef.current?.scrollTop ?? 0;
      animationSourceScrollRef.current = {
        pageIndex: sourcePageIndex,
        readingIdentity,
        scrollTop: sourceScrollTop
      };
      viewport.setAttribute(
        "data-page-flip-source-scroll-top",
        String(sourceScrollTop)
      );
      if (sourcePage && sourcePage.scrollTop !== sourceScrollTop) {
        sourcePage.scrollTop = sourceScrollTop;
      }
      const targetScrollTop = Math.max(0, readyScrollTop ?? 0);
      if (
        targetPage &&
        targetPage !== sourcePage &&
        targetPage.scrollTop !== targetScrollTop
      ) {
        targetPage.scrollTop = targetScrollTop;
      }
    },
    [readingIdentity, readyScrollTop]
  );

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (
      !viewport ||
      dimensions === null ||
      !bookIsReady ||
      failed ||
      engineState !== "read"
    ) {
      return;
    }
    const preparedPageIndexes = new Set([actualPageIndex]);
    preparedPhysicalPageIndexesRef.current = preparedPageIndexes;
    applyPhysicalMediaPolicy(viewport, preparedPageIndexes, "rest");
  }, [
    actualPageIndex,
    bookIsReady,
    dimensions,
    engineState,
    failed,
    pages
  ]);

  useLayoutEffect(() => {
    if (engineState !== "flipping") return;
    const source = animationSourceScrollRef.current;
    const viewport = viewportRef.current;
    if (!source || !viewport) return;
    const sourcePage = resolveSaugeNoireOriginalPage(
      viewport,
      source.pageIndex
    );
    if (sourcePage && sourcePage.scrollTop !== source.scrollTop) {
      sourcePage.scrollTop = source.scrollTop;
    }
  }, [engineState]);

  const revealEngineForFlip = useCallback(
    async (sourcePageIndex: number, targetPageIndex: number) => {
      const preparationToken = ++flipPreparationTokenRef.current;
      const preparedBookKey = bookKey;
      if (hasReadingSurface) setMediaPreparing(true);
      preparePageFlip(sourcePageIndex, targetPageIndex);
      const viewport = viewportRef.current;
      if (!viewport) {
        if (preparationToken === flipPreparationTokenRef.current) {
          setMediaPreparing(false);
        }
        return false;
      }
      await waitForPreparedPhysicalPageMedia(viewport, targetPageIndex);
      const pageFlip = bookRef.current?.pageFlip();
      if (
        preparationToken !== flipPreparationTokenRef.current ||
        readyBookKeyRef.current !== preparedBookKey ||
        viewport !== viewportRef.current ||
        failedRef.current ||
        !pageFlip ||
        pageFlip.getState() !== "read" ||
        pageFlip.getCurrentPageIndex() !== sourcePageIndex
      ) {
        if (preparationToken === flipPreparationTokenRef.current) {
          setMediaPreparing(false);
        }
        return false;
      }
      setMediaPreparing(false);
      return true;
    },
    [bookKey, hasReadingSurface, preparePageFlip]
  );

  const startPreparedFlip = useCallback(
    (
      sourcePageIndex: number,
      requestedTargetPageIndex: number,
      onPrepared?: () => void
    ) => {
      const direction =
        requestedTargetPageIndex > sourcePageIndex ? "next" : "previous";
      const targetPageIndex =
        sourcePageIndex + (direction === "next" ? 1 : -1);
      const preparedBookKey = bookKey;
      void revealEngineForFlip(sourcePageIndex, targetPageIndex).then(
        (prepared) => {
          if (!prepared) return;
          const pageFlip = bookRef.current?.pageFlip();
          if (
            readyBookKeyRef.current !== preparedBookKey ||
            !pageFlip ||
            pageFlip.getState() !== "read" ||
            pageFlip.getCurrentPageIndex() !== sourcePageIndex
          ) {
            return;
          }
          onPrepared?.();
          if (hasReadingSurface) setEngineState("flipping");
          if (direction === "next") {
            pageFlip.flipNext();
          } else {
            pageFlip.flipPrev();
          }
        }
      );
    },
    [bookKey, hasReadingSurface, revealEngineForFlip]
  );

  useEffect(() => {
    if (!bookIsReady) return;

    let cancelled = false;
    let verificationFrame = 0;

    const verifyReadyPage = async () => {
      const viewport = viewportRef.current;
      const pageFlip = bookRef.current?.pageFlip();
      const activePage = viewport
        ? resolveSaugeNoireOriginalPage(viewport, pageIndex)
        : null;

      if (
        !viewport ||
        !pageFlip ||
        !activePage ||
        !activePage.isConnected ||
        pageFlip.getCurrentPageIndex() !== pageIndex ||
        (
          readyScrollTop !== undefined &&
          Math.abs(activePage.scrollTop - readyScrollTop) > 1
        )
      ) {
        verificationFrame = requestAnimationFrame(() => {
          void verifyReadyPage();
        });
        return;
      }

      const mainImage = activePage.querySelector<HTMLImageElement>("img");
      if (mainImage && (!mainImage.complete || mainImage.naturalWidth === 0)) {
        await new Promise<void>((resolve) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            resolve();
          };
          const timeout = window.setTimeout(finish, 2_000);
          void mainImage.decode().then(finish, finish);
        });
      }

      if (cancelled) return;
      verificationFrame = requestAnimationFrame(() => {
        if (
          cancelled ||
          readyNotificationBookKeyRef.current === bookKey ||
          !activePage.isConnected ||
          pageFlip.getCurrentPageIndex() !== pageIndex ||
          (
            readyScrollTop !== undefined &&
            Math.abs(activePage.scrollTop - readyScrollTop) > 1
          ) ||
          (
            mainImage !== null &&
            (
              mainImage.getBoundingClientRect().width <= 0 ||
              mainImage.getBoundingClientRect().height <= 0
            )
          )
        ) {
          if (!cancelled && readyNotificationBookKeyRef.current !== bookKey) {
            void verifyReadyPage();
          }
          return;
        }

        readyNotificationBookKeyRef.current = bookKey;
        onReadyRef.current?.();
      });
    };

    verificationFrame = requestAnimationFrame(() => {
      void verifyReadyPage();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(verificationFrame);
    };
  }, [bookIsReady, bookKey, pageIndex, readyScrollTop]);

  const updatePageFlipBounds = useCallback(() => {
    const pageFlip = bookRef.current?.pageFlip();
    const currentDimensions = dimensionsRef.current;
    if (
      !pageFlip ||
      currentDimensions === null ||
      readyBookKeyRef.current !== bookKey ||
      failedRef.current
    ) {
      return;
    }

    const appliedDimensions = appliedDimensionsRef.current;
    const widthChanged =
      appliedDimensions !== null && appliedDimensions.width !== currentDimensions.width;
    const orientationChanged =
      appliedDimensions !== null &&
      (appliedDimensions.width > appliedDimensions.height) !==
        (currentDimensions.width > currentDimensions.height);
    const heightDelta =
      appliedDimensions === null
        ? 0
        : Math.abs(appliedDimensions.height - currentDimensions.height);
    const dimensionKey = `${currentDimensions.width}-${currentDimensions.height}`;
    if (appliedDimensions === null) {
      appliedDimensionsRef.current = currentDimensions;
      appliedDimensionKeyRef.current = dimensionKey;
      return;
    }
    if (!widthChanged && !orientationChanged) {
      pendingStructuralDimensionsRef.current = null;
    }
    if (!widthChanged && !orientationChanged && heightDelta <= RESIZE_ROUNDING_NOISE_PX) {
      return;
    }
    if (pageFlip.getState() === "flipping") {
      pendingStructuralDimensionsRef.current = currentDimensions;
      return;
    }
    if (appliedDimensionKeyRef.current === dimensionKey) {
      pendingStructuralDimensionsRef.current = null;
      return;
    }

    const settings = pageFlip.getSettings();
    settings.width = currentDimensions.width;
    settings.height = currentDimensions.height;
    settings.minWidth = Math.max(100, currentDimensions.width);
    settings.maxWidth = currentDimensions.width;
    settings.minHeight = Math.max(100, currentDimensions.height);
    settings.maxHeight = currentDimensions.height;
    pageFlip.update();
    appliedDimensionKeyRef.current = dimensionKey;
    appliedDimensionsRef.current = currentDimensions;
    pendingStructuralDimensionsRef.current = null;
  }, [bookKey]);

  useEffect(() => {
    updatePageFlipBounds();
  }, [dimensions, updatePageFlipBounds]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateDimensions = () => {
      const rect = viewport.getBoundingClientRect();
      const next = {
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height))
      };
      if (next.width === 1 || next.height === 1) return;
      const pageFlip = bookRef.current?.pageFlip();
      if (
        pageFlip &&
        readyBookKeyRef.current === bookKey &&
        pageFlip.getState() === "flipping"
      ) {
        pendingStructuralDimensionsRef.current = next;
        return;
      }
      dimensionsRef.current = next;
      setDimensions((current) =>
        current?.width === next.width && current.height === next.height ? current : next
      );
      updatePageFlipBounds();
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    if (typeof ResizeObserver === "undefined") {
      return () => window.removeEventListener("resize", updateDimensions);
    }

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(viewport);
    return () => {
      window.removeEventListener("resize", updateDimensions);
      observer.disconnect();
    };
  }, [bookKey, updatePageFlipBounds]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || dimensions === null || !bookIsReady || failed) return;

    const protectInteractiveTargets = (event: Event) => {
      if (isPageFlipProtectedTarget(event.target, event.composedPath())) {
        event.stopPropagation();
      }
    };
    viewport.addEventListener("mousedown", protectInteractiveTargets, true);
    viewport.addEventListener("touchstart", protectInteractiveTargets, true);
    return () => {
      viewport.removeEventListener("mousedown", protectInteractiveTargets, true);
      viewport.removeEventListener("touchstart", protectInteractiveTargets, true);
    };
  }, [bookIsReady, dimensions, failed]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || dimensions === null || !bookIsReady || failed) return;

    const markClones = () => {
      viewport
        .querySelectorAll<HTMLElement>(".stf__item[data-sauge-flip-page-index]")
        .forEach((page) => {
        const pageIndex = Number(page.getAttribute("data-sauge-flip-page-index"));
        const originalPage = originalPagesRef.current.get(pageIndex);
        if (!originalPage) return;
        if (page === originalPage) {
          page.setAttribute("data-sauge-page-origin", "react-original");
          page.removeAttribute("data-sauge-flip-clone");
          page.removeAttribute("data-sauge-page-clone-reason");
          page.removeAttribute("aria-hidden");
          page.removeAttribute("inert");
          return;
        }
        page.setAttribute("data-sauge-flip-clone", "true");
        page.setAttribute("data-sauge-page-origin", "pageflip-clone");
        page.setAttribute("data-sauge-page-clone-reason", "dom-reference-mismatch");
        page.setAttribute("aria-hidden", "true");
        page.setAttribute("inert", "");
        page.querySelectorAll<HTMLElement>("button, a, input, select, textarea, [tabindex]").forEach(
          (control) => control.setAttribute("tabindex", "-1")
        );
      });
      applyPhysicalMediaPolicy(
        viewport,
        preparedPhysicalPageIndexesRef.current,
        engineState === "flipping" ? "flip" : "rest"
      );
    };

    markClones();
    const observer = new MutationObserver(markClones);
    observer.observe(viewport, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [bookIsReady, dimensions, engineState, failed]);

  useEffect(() => {
    const pageFlip = bookRef.current?.pageFlip();
    if (
      !pageFlip ||
      dimensions === null ||
      !bookIsReady ||
      failed ||
      resetKey === undefined ||
      lastResetKeyRef.current === resetKey
    ) {
      return;
    }

    lastResetKeyRef.current = resetKey;
    flipPreparationTokenRef.current += 1;
    setMediaPreparing(false);
    requestedPageIndexRef.current = null;
    animationTargetPageRef.current = null;
    pageFlip.turnToPage(startPage);
  }, [bookIsReady, dimensions, failed, resetKey, startPage]);

  useEffect(() => {
    if (
      recenterPage === undefined ||
      recenterToken === undefined ||
      lastRecenterTokenRef.current === recenterToken ||
      dimensions === null ||
      !bookIsReady ||
      failed
    ) {
      return;
    }

    lastRecenterTokenRef.current = recenterToken;
    flipPreparationTokenRef.current += 1;
    setMediaPreparing(false);
    requestedPageIndexRef.current = null;
    animationTargetPageRef.current = null;
    reportedFlipPageRef.current = recenterPage;

    let frame = 0;
    const applyRecenter = () => {
      const pageFlip = bookRef.current?.pageFlip();
      if (!pageFlip) return;
      if (pageFlip.getState() !== "read") {
        frame = window.requestAnimationFrame(applyRecenter);
        return;
      }
      pageFlip.turnToPage(recenterPage);
    };
    frame = window.requestAnimationFrame(applyRecenter);
    return () => window.cancelAnimationFrame(frame);
  }, [bookIsReady, dimensions, failed, recenterPage, recenterToken]);

  useEffect(() => {
    if (!singleFlipJumpRequest) {
      if (!activeSingleFlipJumpRef.current) setSingleFlipJumpPhase("idle");
      return;
    }
    if (
      lastSingleFlipJumpTokenRef.current === singleFlipJumpRequest.token ||
      activeSingleFlipJumpRef.current ||
      dimensions === null ||
      !bookIsReady ||
      failed ||
      engineState !== "read"
    ) {
      return;
    }

    setSingleFlipJumpPhase("requested");
    window.cancelAnimationFrame(singleFlipJumpFrameRef.current);
    const startFrame = window.requestAnimationFrame(() => {
      const pageFlip = bookRef.current?.pageFlip();
      if (!pageFlip || pageFlip.getState() !== "read") return;

      const currentPage = pageFlip.getCurrentPageIndex();
      const finalPage = Math.max(
        0,
        Math.min(singleFlipJumpRequest.finalPage, pages.length - 1)
      );
      const direction = singleFlipJumpRequest.direction;
      const step = direction === "next" ? 1 : -1;
      const canAnimate =
        direction === "next"
          ? currentPage < finalPage
          : currentPage > finalPage;
      lastSingleFlipJumpTokenRef.current = singleFlipJumpRequest.token;
      if (!canAnimate) {
        animationTargetPageRef.current = null;
        requestedPageIndexRef.current = null;
        onPageFlip(finalPage);
        setSingleFlipJumpPhase("completed");
        onSingleFlipJumpSettledRef.current?.(singleFlipJumpRequest.token);
        return;
      }

      const adjacentPage = currentPage + step;
      activeSingleFlipJumpRef.current = {
        token: singleFlipJumpRequest.token,
        direction,
        finalPage,
        adjacentPage,
        sawFlipping: false,
        reachedAdjacent: false,
        phase: "single-flip"
      };
      animationTargetPageRef.current = null;
      requestedPageIndexRef.current = adjacentPage;
      reportedFlipPageRef.current = null;
      setSingleFlipJumpPhase("requested");
      startPreparedFlip(currentPage, adjacentPage, () => {
        setSingleFlipJumpPhase("single-flip-started");
      });
    });
    singleFlipJumpFrameRef.current = startFrame;

    return () => window.cancelAnimationFrame(startFrame);
  }, [
    bookIsReady,
    dimensions,
    engineState,
    failed,
    onPageFlip,
    pages.length,
    startPreparedFlip,
    singleFlipJumpRequest
  ]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const pageFlip = bookRef.current?.pageFlip();
      if (!pageFlip || dimensions === null || !bookIsReady || failed) return;
      if (singleFlipJumpRequest || activeSingleFlipJumpRef.current) return;
      if (pageFlip.getState() === "flipping") return;

      const currentPage = pageFlip.getCurrentPageIndex();
      if (animationTargetPageRef.current === null) {
        if (requestedPageIndexRef.current !== null || currentPage === pageIndex) return;
        animationTargetPageRef.current = pageIndex;
      }

      const targetPage = animationTargetPageRef.current;
      if (targetPage === null) return;

      if (currentPage === targetPage) {
        animationTargetPageRef.current = null;
        requestedPageIndexRef.current = null;
        return;
      }

      requestedPageIndexRef.current = targetPage;
      startPreparedFlip(currentPage, targetPage);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    bookIsReady,
    dimensions,
    engineState,
    failed,
    pageIndex,
    startPreparedFlip,
    singleFlipJumpRequest
  ]);

  useEffect(() => {
    const activeBookRef = bookRef;
    const cleanupGeneration = ++cleanupGenerationRef.current;
    return () => {
      const pageFlip = activeBookRef.current?.pageFlip();
      window.cancelAnimationFrame(singleFlipJumpFrameRef.current);
      window.cancelAnimationFrame(animationSourceClearFrameRef.current);
      flipPreparationTokenRef.current += 1;
      activeSingleFlipJumpRef.current = null;
      if (!pageFlip) return;
      queueMicrotask(() => {
        // React Strict Mode runs effect cleanup and setup once during
        // development. Do not destroy the live PageFlip root from that
        // rehearsal; only the final unmount may remove it.
        if (!isCurrentCleanupGeneration(cleanupGenerationRef, cleanupGeneration)) return;
        try {
          pageFlip.destroy();
        } catch {
          // The React wrapper does not clean up its PageFlip instance itself.
        }
      });
    };
  }, []);

  const handleFlip = useCallback((event: PageFlipEvent) => {
    if (readyBookKeyRef.current !== bookKey) return;
    const nextIndex = parsePageIndex(event);
    if (nextIndex === null) return;
    setActualPageIndex(nextIndex);
    const singleFlipJump = activeSingleFlipJumpRef.current;
    if (singleFlipJump) {
      if (
        singleFlipJump.phase === "single-flip" &&
        singleFlipJump.sawFlipping &&
        nextIndex === singleFlipJump.adjacentPage
      ) {
        singleFlipJump.reachedAdjacent = true;
        setSingleFlipJumpPhase("adjacent-page-reached");
        return;
      }
      if (
        singleFlipJump.phase === "instant-jump" &&
        nextIndex === singleFlipJump.finalPage
      ) {
        activeSingleFlipJumpRef.current = null;
        requestedPageIndexRef.current = null;
        animationTargetPageRef.current = null;
        reportedFlipPageRef.current = nextIndex;
        onPageFlip(nextIndex);
        setSingleFlipJumpPhase("completed");
        onSingleFlipJumpSettledRef.current?.(singleFlipJump.token);
      }
      return;
    }
    const animationTarget = animationTargetPageRef.current;
    if (reportedFlipPageRef.current === nextIndex && animationTarget === null) return;
    reportedFlipPageRef.current = nextIndex;
    if (animationTarget !== null && nextIndex !== animationTarget) {
      requestedPageIndexRef.current = animationTarget;
      onPageFlip(nextIndex);
      return;
    }
    requestedPageIndexRef.current = null;
    animationTargetPageRef.current = null;
    onPageFlip(nextIndex);
  }, [bookKey, onPageFlip]);

  const handleInit = () => {
    initCountRef.current += 1;
    viewportRef.current?.setAttribute(
      "data-page-flip-init-count",
      String(initCountRef.current)
    );
    const initialPageIndex =
      bookRef.current?.pageFlip()?.getCurrentPageIndex() ?? startPage;
    setActualPageIndex(initialPageIndex);
    preparedPhysicalPageIndexesRef.current = new Set([initialPageIndex]);
    readyBookKeyRef.current = bookKey;
    requestedPageIndexRef.current = null;
    animationTargetPageRef.current = null;
    reportedFlipPageRef.current = null;
    sawFlipStateRef.current = false;
    setEngineState("read");
    setReadyBookKey(bookKey);
    appliedDimensionKeyRef.current = null;
    appliedDimensionsRef.current = dimensionsRef.current;
  };

  const handleChangeState = useCallback((event: PageFlipEvent) => {
    const state = String(event.data);
    setEngineState(state);
    if (state === "flipping") {
      reportedFlipPageRef.current = null;
      sawFlipStateRef.current = true;
    }
    if (state === "read") {
      const completedSource = animationSourceScrollRef.current;
      window.cancelAnimationFrame(animationSourceClearFrameRef.current);
      animationSourceClearFrameRef.current = window.requestAnimationFrame(() => {
        if (animationSourceScrollRef.current === completedSource) {
          animationSourceScrollRef.current = null;
        }
      });
    }
    if (
      state === "flipping" &&
      activeSingleFlipJumpRef.current?.phase === "single-flip"
    ) {
      activeSingleFlipJumpRef.current.sawFlipping = true;
    }
    onChangeStateRef.current?.(state);
    // WebKit can commit the physical page before its wrapper emits `flip`.
    // Reconcile from the engine after a genuine flipping -> read cycle so the
    // logical page and the canonical reading surface cannot remain one sheet
    // behind a completed animation.
    if (state === "read" && sawFlipStateRef.current) {
      const settledPage = bookRef.current?.pageFlip()?.getCurrentPageIndex();
      sawFlipStateRef.current = false;
      if (settledPage !== undefined) handleFlip({ data: settledPage });
    }
    const singleFlipJump = activeSingleFlipJumpRef.current;
    if (state === "read" && pendingStructuralDimensionsRef.current) {
      const pendingDimensions = pendingStructuralDimensionsRef.current;
      pendingStructuralDimensionsRef.current = null;
      dimensionsRef.current = pendingDimensions;
      setDimensions((current) =>
        current?.width === pendingDimensions.width &&
        current.height === pendingDimensions.height
          ? current
          : pendingDimensions
      );
    }
    if (
      state === "read" &&
      singleFlipJump?.phase === "single-flip" &&
      singleFlipJump.sawFlipping &&
      singleFlipJump.reachedAdjacent
    ) {
      setSingleFlipJumpPhase("read-after-single-flip");
      if (singleFlipJump.adjacentPage === singleFlipJump.finalPage) {
        activeSingleFlipJumpRef.current = null;
        requestedPageIndexRef.current = null;
        animationTargetPageRef.current = null;
        reportedFlipPageRef.current = singleFlipJump.finalPage;
        onPageFlip(singleFlipJump.finalPage);
        setSingleFlipJumpPhase("completed");
        onSingleFlipJumpSettledRef.current?.(singleFlipJump.token);
      } else {
        window.cancelAnimationFrame(singleFlipJumpFrameRef.current);
        singleFlipJumpFrameRef.current = window.requestAnimationFrame(() => {
          const pageFlip = bookRef.current?.pageFlip();
          const activeCommand = activeSingleFlipJumpRef.current;
          if (
            !pageFlip ||
            !activeCommand ||
            activeCommand.token !== singleFlipJump.token ||
            pageFlip.getState() !== "read" ||
            pageFlip.getCurrentPageIndex() !== activeCommand.adjacentPage
          ) {
            return;
          }
          activeCommand.phase = "instant-jump";
          requestedPageIndexRef.current = activeCommand.finalPage;
          setSingleFlipJumpPhase("instant-jump-to-target");
          singleFlipJumpFrameRef.current = window.requestAnimationFrame(() => {
            const currentCommand = activeSingleFlipJumpRef.current;
            const currentPageFlip = bookRef.current?.pageFlip();
            if (
              !currentCommand ||
              currentCommand.token !== activeCommand.token ||
              currentCommand.phase !== "instant-jump" ||
              !currentPageFlip ||
              currentPageFlip.getState() !== "read" ||
              currentPageFlip.getCurrentPageIndex() !==
                currentCommand.adjacentPage
            ) {
              return;
            }
            const viewport = viewportRef.current;
            if (!viewport) return;
            const preparedPageIndexes = new Set([
              currentCommand.adjacentPage,
              currentCommand.finalPage
            ]);
            const preparationToken = ++flipPreparationTokenRef.current;
            const preparedBookKey = bookKey;
            setMediaPreparing(true);
            preparedPhysicalPageIndexesRef.current = preparedPageIndexes;
            applyPhysicalMediaPolicy(
              viewport,
              preparedPageIndexes,
              "flip"
            );
            void waitForPreparedPhysicalPageMedia(
              viewport,
              currentCommand.finalPage
            ).then(() => {
              const latestCommand = activeSingleFlipJumpRef.current;
              const latestPageFlip = bookRef.current?.pageFlip();
              if (
                preparationToken !== flipPreparationTokenRef.current ||
                readyBookKeyRef.current !== preparedBookKey ||
                viewport !== viewportRef.current ||
                latestCommand?.token !== currentCommand.token ||
                latestCommand.phase !== "instant-jump" ||
                !latestPageFlip ||
                latestPageFlip.getState() !== "read" ||
                latestPageFlip.getCurrentPageIndex() !==
                  currentCommand.adjacentPage
              ) {
                if (preparationToken === flipPreparationTokenRef.current) {
                  setMediaPreparing(false);
                }
                return;
              }
              setMediaPreparing(false);
              latestPageFlip.turnToPage(currentCommand.finalPage);
            });
          });
        });
      }
    }
    if (
      state === "read" &&
      !singleFlipJump &&
      animationTargetPageRef.current !== null
    ) {
      window.requestAnimationFrame(() => {
        const pageFlip = bookRef.current?.pageFlip();
        const targetPage = animationTargetPageRef.current;
        if (
          !pageFlip ||
          targetPage === null ||
          pageFlip.getState() !== "read"
        ) {
          return;
        }

        const currentPage = pageFlip.getCurrentPageIndex();
        if (currentPage === targetPage) {
          requestedPageIndexRef.current = null;
          animationTargetPageRef.current = null;
          return;
        }

        requestedPageIndexRef.current = targetPage;
        startPreparedFlip(currentPage, targetPage);
      });
    }
    if (state === "read" && pendingStructuralDimensionsRef.current) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(updatePageFlipBounds);
      });
    }
  }, [
    bookKey,
    handleFlip,
    onPageFlip,
    startPreparedFlip,
    updatePageFlipBounds
  ]);

  const releaseGestureCapture = (
    target: HTMLDivElement,
    gesture: GestureSession
  ) => {
    if (!gesture.captured || gesture.pointerId === null) return;
    try {
      if (target.hasPointerCapture?.(gesture.pointerId)) {
        target.releasePointerCapture?.(gesture.pointerId);
      }
    } catch {
      // The browser may already have released capture during cancellation.
    }
    gesture.captured = false;
  };

  const resetGesture = () => {
    gestureRef.current = idleGesture(gestureSequenceRef.current);
  };

  const consumeGesture = (
    gesture: GestureSession,
    direction: "next" | "previous",
    preventDefault: () => void
  ) => {
    gesture.phase = "consumed";
    gesture.consumed = true;
    gesture.suppressClick = true;
    gesture.direction = direction;
    consumedClickRef.current = {
      sequence: gesture.sequence,
      pointerId: gesture.pointerType === "touch" ? -1 : gesture.pointerId ?? -1,
      pointerType: gesture.pointerType,
      target: gesture.target,
      clickScope: gesture.clickScope
    };
    preventDefault();
  };

  const handleSwipeEnd = (
    gesture: GestureSession,
    preventDefault: () => void
  ) => {
    if (
      gesture.phase !== "horizontal" ||
      requestedPageIndexRef.current !== null
    ) {
      return;
    }

    const absX = Math.abs(gesture.deltaX);
    const absY = Math.abs(gesture.deltaY);
    const hasHorizontalIntent = absX >= absY * HORIZONTAL_CLAIM_RATIO;
    const hasDistance = absX >= SWIPE_DISTANCE;
    const hasFreshVelocity =
      gesture.velocityTime > 0 &&
      gesture.lastTime - gesture.velocityTime <= FLICK_RECENCY_MS;
    const velocityMatchesDisplacement =
      Math.sign(gesture.velocityX) === Math.sign(gesture.deltaX);
    const isFlick =
      absX >= FLICK_DISTANCE &&
      Math.abs(gesture.velocityX) >= FLICK_VELOCITY &&
      hasFreshVelocity &&
      velocityMatchesDisplacement;
    if (!hasHorizontalIntent || (!hasDistance && !isFlick)) return;

    const pageFlip = bookRef.current?.pageFlip();
    if (!pageFlip) return;
    const currentPage = pageFlip.getCurrentPageIndex();
    const direction = gesture.deltaX < 0 ? "next" : "previous";
    const nextPage = direction === "next" ? currentPage + 1 : currentPage - 1;
    if (interceptSwipe && onSwipe) {
      consumeGesture(gesture, direction, preventDefault);
      onSwipe(direction);
      return;
    }
    if (nextPage < 0 || nextPage >= pages.length) {
      if (onSwipe) {
        consumeGesture(gesture, direction, preventDefault);
        onSwipe(direction);
      }
      return;
    }

    consumeGesture(gesture, direction, preventDefault);
    requestedPageIndexRef.current = nextPage;
    startPreparedFlip(currentPage, nextPage);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    consumedClickRef.current = null;
    const activeGesture = gestureRef.current;
    if (
      activeGesture.phase !== "idle" &&
      activeGesture.pointerId !== event.pointerId
    ) {
      activeGesture.phase = "cancelled";
      releaseGestureCapture(event.currentTarget, activeGesture);
      return;
    }

    gestureSequenceRef.current += 1;
    const nextGesture: GestureSession = {
      ...idleGesture(gestureSequenceRef.current),
      phase: "candidate",
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      target: event.target instanceof Element ? event.target : null,
      clickScope: clickScopeForTarget(event.target),
      startX: event.clientX,
      startY: event.clientY,
      startTime: performance.now(),
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: performance.now()
    };
    gestureRef.current = nextGesture;

    if (
      !event.isPrimary ||
      event.button !== 0 ||
      !bookIsReady ||
      engineState !== "read" ||
      isPageFlipProtectedTarget(
        event.target,
        event.nativeEvent.composedPath()
      )
    ) {
      nextGesture.phase = "cancelled";
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const gesture = gestureRef.current;
    if (
      gesture.pointerId !== event.pointerId ||
      gesture.phase === "idle" ||
      gesture.phase === "vertical" ||
      gesture.phase === "cancelled" ||
      gesture.phase === "consumed"
    ) {
      return;
    }

    updateGestureSample(
      gesture,
      event.clientX,
      event.clientY,
      performance.now()
    );
    classifyGesture(gesture);
    if (gesture.phase !== "horizontal") return;
    if (!gesture.captured) {
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        gesture.captured = true;
      } catch {
        gesture.phase = "cancelled";
        return;
      }
    }
    event.preventDefault();
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId) return;
    updateGestureSample(
      gesture,
      event.clientX,
      event.clientY,
      performance.now()
    );
    classifyGesture(gesture);
    handleSwipeEnd(gesture, () => event.preventDefault());
    releaseGestureCapture(event.currentTarget, gesture);
    resetGesture();
  };

  const cancelGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId) return;
    gesture.phase = "cancelled";
    consumedClickRef.current = null;
    releaseGestureCapture(event.currentTarget, gesture);
    resetGesture();
  };

  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    const pending = consumedClickRef.current;
    if (
      !pending ||
      !event.isTrusted ||
      event.detail === 0 ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const nativePointer = event.nativeEvent as MouseEvent & {
      pointerId?: number;
      pointerType?: string;
    };
    if (
      typeof nativePointer.pointerId === "number" &&
      nativePointer.pointerId > 0 &&
      pending.pointerId > 0 &&
      nativePointer.pointerId !== pending.pointerId
    ) {
      return;
    }
    if (
      nativePointer.pointerType &&
      pending.pointerType &&
      nativePointer.pointerType !== pending.pointerType
    ) {
      return;
    }

    const clickTarget = event.target instanceof Element ? event.target : null;
    const matchesScope =
      clickTarget !== null &&
      (pending.clickScope?.contains(clickTarget) ||
        (pending.target !== null && clickTarget.contains(pending.target)));
    if (!matchesScope) return;

    consumedClickRef.current = null;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    consumedClickRef.current = null;
    const current = gestureRef.current;
    if (event.touches.length !== 1) {
      if (current.phase === "idle") {
        gestureSequenceRef.current += 1;
        gestureRef.current = {
          ...idleGesture(gestureSequenceRef.current),
          phase: "cancelled",
          pointerType: "touch"
        };
      } else {
        current.phase = "cancelled";
        current.pointerType = "touch";
      }
      return;
    }
    if (current.phase !== "idle") {
      current.phase = "cancelled";
      current.pointerType = "touch";
      return;
    }
    const touch = event.changedTouches[0];
    if (!touch) return;

    gestureSequenceRef.current += 1;
    const nextGesture: GestureSession = {
      ...idleGesture(gestureSequenceRef.current),
      phase: "candidate",
      pointerId: touch.identifier,
      pointerType: "touch",
      target: event.target instanceof Element ? event.target : null,
      clickScope: clickScopeForTarget(event.target),
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: performance.now(),
      lastX: touch.clientX,
      lastY: touch.clientY,
      lastTime: performance.now()
    };
    gestureRef.current = nextGesture;
    if (
      !bookIsReady ||
      engineState !== "read" ||
      isPageFlipProtectedTarget(
        event.target,
        event.nativeEvent.composedPath()
      )
    ) {
      nextGesture.phase = "cancelled";
    }
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (gesture.phase === "cancelled") {
      if (event.touches.length === 0) resetGesture();
      return;
    }
    if (gesture.pointerType !== "touch" || gesture.phase === "idle") return;
    const touch = touchForGesture(
      event.changedTouches,
      event.touches,
      gesture
    );
    if (touch) {
      updateGestureSample(
        gesture,
        touch.clientX,
        touch.clientY,
        performance.now()
      );
      classifyGesture(gesture);
    }
    handleSwipeEnd(gesture, () => event.preventDefault());
    resetGesture();
  };

  const handleTouchCancel = () => {
    const gesture = gestureRef.current;
    if (gesture.phase === "idle") return;
    gesture.phase = "cancelled";
    consumedClickRef.current = null;
    resetGesture();
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleTouchMove = (event: TouchEvent) => {
      const gesture = gestureRef.current;
      if (
        gesture.pointerType !== "touch" ||
        gesture.phase === "idle" ||
        gesture.phase === "vertical" ||
        gesture.phase === "cancelled" ||
        gesture.phase === "consumed"
      ) {
        return;
      }
      const touch = touchForGesture(
        event.changedTouches,
        event.touches,
        gesture
      );
      if (!touch) return;
      updateGestureSample(
        gesture,
        touch.clientX,
        touch.clientY,
        performance.now()
      );
      classifyGesture(gesture);
      if (gesture.phase === "horizontal") event.preventDefault();
    };

    viewport.addEventListener("touchmove", handleTouchMove, {
      passive: false
    });
    return () => viewport.removeEventListener("touchmove", handleTouchMove);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    return () => {
      const gesture = gestureRef.current;
      if (viewport) releaseGestureCapture(viewport, gesture);
      gesture.phase = "cancelled";
      consumedClickRef.current = null;
      resetGesture();
    };
  }, []);

  const shouldShowTransientFallback =
    !hasReadingSurface && !failed && !bookIsReady;

  return (
    <div
      ref={viewportRef}
      className={styles.pageFlipViewport}
      onClickCapture={handleClickCapture}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={cancelGesture}
      onLostPointerCapture={cancelGesture}
      data-page-flip-state={
        failed ? "fallback-error" : bookIsReady ? "ready" : "loading"
      }
      data-page-flip-book-key={bookKey}
      data-page-flip-engine-state={engineState}
      data-page-flip-current-page={pageIndex}
      data-page-flip-actual-page={actualPageIndex}
      data-page-flip-single-jump-phase={singleFlipJumpPhase}
    >
      {dimensions !== null ? (
        <div
          className={styles.pageFlipEngineLayer}
          data-page-flip-engine-visible={pageFlipEngineVisible ? "true" : "false"}
          aria-hidden={hasReadingSurface || undefined}
          inert={hasReadingSurface ? true : undefined}
        >
          <SaugeNoireOriginalPageRegistryContext.Provider value={originalPageRegistry}>
            <PageFlipErrorBoundary
              fallback={fallback}
              onError={() => {
                const interruptedSingleFlipJump =
                  activeSingleFlipJumpRef.current?.token ??
                  singleFlipJumpRequest?.token ??
                  null;
                window.cancelAnimationFrame(singleFlipJumpFrameRef.current);
                window.cancelAnimationFrame(animationSourceClearFrameRef.current);
                flipPreparationTokenRef.current += 1;
                setMediaPreparing(false);
                activeSingleFlipJumpRef.current = null;
                requestedPageIndexRef.current = null;
                animationTargetPageRef.current = null;
                animationSourceScrollRef.current = null;
                setSingleFlipJumpPhase("completed");
                if (interruptedSingleFlipJump !== null) {
                  lastSingleFlipJumpTokenRef.current = interruptedSingleFlipJump;
                  onSingleFlipJumpSettledRef.current?.(interruptedSingleFlipJump);
                }
                setFailed(true);
                setReadyBookKey(null);
                onError?.();
              }}
            >
              <SaugeNoirePhysicalPageMediaContext.Provider value>
                <HTMLFlipBook
              key={bookKey ?? undefined}
              ref={bookRef}
              // PageFlip adds `.stf__parent` to this root. Keep React's class
              // list stable so a ready-state render cannot remove it.
              className={styles.pageFlipBook}
              style={{} as CSSProperties}
              width={dimensions.width}
              height={dimensions.height}
              size="stretch"
              // Keep StPageFlip in portrait mode at every viewport size: one
              // physical menu page per screen, while retaining the 3D fold.
              minWidth={Math.max(100, dimensions.width)}
              maxWidth={dimensions.width}
              minHeight={Math.max(100, dimensions.height)}
              maxHeight={dimensions.height}
              startPage={startPage}
              drawShadow
              flippingTime={720}
              usePortrait
              startZIndex={0}
              autoSize={false}
              maxShadowOpacity={0.62}
              showCover={showCover}
              mobileScrollSupport
              swipeDistance={44}
              clickEventForward
              useMouseEvents={false}
              showPageCorners={false}
              // Mouse events are disabled below; programmatic swipe turns
              // still need the library's corner guard to be bypassed.
              disableFlipByClick={false}
              renderOnlyPageLengthChange={renderOnlyPageLengthChange}
              onFlip={handleFlip}
              onChangeState={handleChangeState}
              onInit={handleInit}
                >
                  {pages}
                </HTMLFlipBook>
              </SaugeNoirePhysicalPageMediaContext.Provider>
            </PageFlipErrorBoundary>
          </SaugeNoireOriginalPageRegistryContext.Provider>
        </div>
      ) : null}
      {hasReadingSurface ? (
        <SaugeNoireReadingSurface
          ref={readingSurfaceRef}
          kind={readingKind}
          pageIndex={pageIndex}
          visible={hasReadingSurface}
          scrollOwner={readingSurfaceOwnsScroll}
          contentInert={
            (!failed &&
              (engineState === "flipping" ||
                singleFlipJumpKeepsEngineVisible)) ||
            !readingSurfaceOwnsScroll
          }
          onGestureActiveChange={onReadingGestureActiveChange}
          data-sauge-handoff-candidate="true"
        >
          {activeReadingPage}
        </SaugeNoireReadingSurface>
      ) : null}
      {mediaPreparing && hasReadingSurface ? (
        <div
          className={styles.pageFlipMediaPreparing}
          data-page-flip-media-preparing="true"
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
        </div>
      ) : null}
      {shouldShowTransientFallback ? (
        <div
          className={styles.pageFlipFallback}
          data-page-flip-fallback="loading"
          aria-hidden="true"
          ref={(element) => element?.setAttribute("inert", "")}
        >
          {fallback}
        </div>
      ) : null}
    </div>
  );
}
