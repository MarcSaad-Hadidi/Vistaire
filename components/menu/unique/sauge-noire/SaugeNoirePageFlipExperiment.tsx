"use client";

import HTMLFlipBook from "react-pageflip";
import {
  Component,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import styles from "./SaugeNoireBookMenu.module.css";
import {
  resolveSaugeNoireOriginalPage,
  SaugeNoireOriginalPageRegistryContext
} from "./SaugeNoireFlipPage";

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
  direction: "previous";
  finalPage: number;
}>;

type ActiveSingleFlipJump = {
  token: number;
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
  | "instant-jump-to-contents"
  | "completed";

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
  protectInteractiveTargets?: boolean;
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

const SWIPE_DISTANCE = 32;
const RESIZE_ROUNDING_NOISE_PX = 1;

function parsePageIndex(event: PageFlipEvent | number): number | null {
  const value = typeof event === "number" ? event : event.data;
  const index = typeof value === "string" ? Number(value) : value;
  return typeof index === "number" && Number.isInteger(index) && index >= 0
    ? index
    : null;
}

function isPageFlipProtectedTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(
      target.closest(
        "input, select, textarea, [contenteditable=true], [data-no-page-flip]"
      )
    )
  );
}

function isPageFlipInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("a, button"));
}

function isCurrentCleanupGeneration(ref: { current: number }, generation: number): boolean {
  return ref.current === generation;
}

export function SaugeNoirePageFlipExperiment({
  pages,
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
  protectInteractiveTargets = false,
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
  const originalPagesRef = useRef<Map<number, HTMLElement>>(new Map());
  const readyBookKeyRef = useRef<string | null>(null);
  const requestedPageIndexRef = useRef<number | null>(null);
  const animationTargetPageRef = useRef<number | null>(null);
  const activeSingleFlipJumpRef = useRef<ActiveSingleFlipJump | null>(null);
  const lastSingleFlipJumpTokenRef = useRef<number | null>(null);
  const singleFlipJumpFrameRef = useRef(0);
  const gestureStartRef = useRef<{
    x: number;
    y: number;
    axis: "undecided" | "horizontal" | "vertical";
  } | null>(null);
  const [dimensions, setDimensions] = useState<FlipDimensions | null>(null);
  const [readyBookKey, setReadyBookKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [engineState, setEngineState] = useState("idle");
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
  const initCountRef = useRef(0);
  // The DOM identity belongs to the logical book, not to a volatile viewport
  // measurement. PageFlip can recalculate its bounds in place on resize.
  const bookKey = resetKey === undefined ? "sauge-main-book" : `sauge-book-${resetKey}`;
  const bookIsReady = bookKey !== null && readyBookKey === bookKey;
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
      if (isPageFlipProtectedTarget(event.target)) event.stopPropagation();
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
    };

    markClones();
    const observer = new MutationObserver(markClones);
    observer.observe(viewport, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [bookIsReady, dimensions, failed]);

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
    const frame = window.requestAnimationFrame(() => {
      const pageFlip = bookRef.current?.pageFlip();
      if (!pageFlip || pageFlip.getState() === "flipping") return;
      lastRecenterTokenRef.current = recenterToken;
      requestedPageIndexRef.current = null;
      animationTargetPageRef.current = null;
      reportedFlipPageRef.current = recenterPage;
      pageFlip.turnToPage(recenterPage);
    });
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
      lastSingleFlipJumpTokenRef.current = singleFlipJumpRequest.token;
      if (currentPage <= finalPage) {
        animationTargetPageRef.current = null;
        requestedPageIndexRef.current = null;
        onPageFlip(finalPage);
        setSingleFlipJumpPhase("completed");
        onSingleFlipJumpSettledRef.current?.(singleFlipJumpRequest.token);
        return;
      }

      const adjacentPage = currentPage - 1;
      activeSingleFlipJumpRef.current = {
        token: singleFlipJumpRequest.token,
        finalPage,
        adjacentPage,
        sawFlipping: false,
        reachedAdjacent: false,
        phase: "single-flip"
      };
      animationTargetPageRef.current = null;
      requestedPageIndexRef.current = adjacentPage;
      reportedFlipPageRef.current = null;
      setSingleFlipJumpPhase("single-flip-started");
      pageFlip.flipPrev();
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
      if (targetPage > currentPage) {
        pageFlip.flipNext();
      } else {
        pageFlip.flipPrev();
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [bookIsReady, dimensions, engineState, failed, pageIndex, singleFlipJumpRequest]);

  useEffect(() => {
    const activeBookRef = bookRef;
    const cleanupGeneration = ++cleanupGenerationRef.current;
    return () => {
      const pageFlip = activeBookRef.current?.pageFlip();
      window.cancelAnimationFrame(singleFlipJumpFrameRef.current);
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

  const handleFlip = (event: PageFlipEvent) => {
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
  };

  const handleInit = () => {
    initCountRef.current += 1;
    viewportRef.current?.setAttribute(
      "data-page-flip-init-count",
      String(initCountRef.current)
    );
    setActualPageIndex(bookRef.current?.pageFlip()?.getCurrentPageIndex() ?? startPage);
    readyBookKeyRef.current = bookKey;
    requestedPageIndexRef.current = null;
    animationTargetPageRef.current = null;
    reportedFlipPageRef.current = null;
    setEngineState("read");
    setReadyBookKey(bookKey);
    appliedDimensionKeyRef.current = null;
    appliedDimensionsRef.current = dimensionsRef.current;
  };

  const handleChangeState = useCallback((event: PageFlipEvent) => {
    const state = String(event.data);
    setEngineState(state);
    if (state === "flipping") reportedFlipPageRef.current = null;
    const singleFlipJump = activeSingleFlipJumpRef.current;
    if (state === "flipping" && singleFlipJump?.phase === "single-flip") {
      singleFlipJump.sawFlipping = true;
    }
    onChangeStateRef.current?.(state);
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
          setSingleFlipJumpPhase("instant-jump-to-contents");
          pageFlip.turnToPage(activeCommand.finalPage);
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
        if (targetPage > currentPage) {
          pageFlip.flipNext();
        } else {
          pageFlip.flipPrev();
        }
      });
    }
    if (state === "read" && pendingStructuralDimensionsRef.current) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(updatePageFlipBounds);
      });
    }
  }, [onPageFlip, updatePageFlipBounds]);

  const rememberGestureStart = (x: number, y: number, target: EventTarget | null) => {
    if (
      !bookIsReady ||
      isPageFlipProtectedTarget(target) ||
      (protectInteractiveTargets && isPageFlipInteractiveTarget(target))
    ) {
      gestureStartRef.current = null;
      return;
    }
    gestureStartRef.current = { x, y, axis: "undecided" };
  };

  const handleSwipeEnd = (
    endX: number,
    endY: number,
    preventDefault: () => void
  ) => {
    const start = gestureStartRef.current;
    gestureStartRef.current = null;
    if (
      !start ||
      start.axis !== "horizontal" ||
      requestedPageIndexRef.current !== null
    ) return;

    const deltaX = endX - start.x;
    const deltaY = endY - start.y;
    if (Math.abs(deltaX) < SWIPE_DISTANCE || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    const pageFlip = bookRef.current?.pageFlip();
    if (!pageFlip) return;
    const currentPage = pageFlip.getCurrentPageIndex();
    const nextPage = deltaX < 0 ? currentPage + 1 : currentPage - 1;
    if (interceptSwipe && onSwipe) {
      preventDefault();
      onSwipe(deltaX < 0 ? "next" : "previous");
      return;
    }
    if (nextPage < 0 || nextPage >= pages.length) {
      if (onSwipe) {
        preventDefault();
        onSwipe(deltaX < 0 ? "next" : "previous");
      }
      return;
    }

    preventDefault();
    requestedPageIndexRef.current = nextPage;
    if (deltaX < 0) {
      pageFlip.flipNext();
    } else {
      pageFlip.flipPrev();
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    rememberGestureStart(event.clientX, event.clientY, event.target);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    handleSwipeEnd(event.clientX, event.clientY, () => event.preventDefault());
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = gestureStartRef.current;
    if (!start) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (start.axis === "undecided") {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 8) return;
      if (Math.abs(deltaX) <= Math.abs(deltaY)) {
        start.axis = "vertical";
        return;
      }
      start.axis = "horizontal";
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    if (start.axis === "horizontal") {
      event.preventDefault();
    }
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    gestureStartRef.current = null;
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (gestureStartRef.current) return;
    if (
      !bookIsReady ||
      isPageFlipProtectedTarget(event.target) ||
      (protectInteractiveTargets && isPageFlipInteractiveTarget(event.target))
    ) {
      gestureStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    if (touch) rememberGestureStart(touch.clientX, touch.clientY, event.target);
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    handleSwipeEnd(touch.clientX, touch.clientY, () => event.preventDefault());
  };

  const handleTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = gestureStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (start.axis === "undecided") {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 8) return;
      start.axis = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
    }
    if (start.axis === "horizontal") {
      event.preventDefault();
    }
  };

  const shouldShowTransientFallback = !failed && !bookIsReady;

  return (
    <div
      ref={viewportRef}
      className={styles.pageFlipViewport}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        gestureStartRef.current = null;
      }}
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
          style={{ display: "contents" }}
          aria-hidden={!bookIsReady && !failed ? true : undefined}
          ref={(element) => {
            if (!element) return;
            if (bookIsReady || failed) element.removeAttribute("inert");
            else element.setAttribute("inert", "");
          }}
        >
          <SaugeNoireOriginalPageRegistryContext.Provider value={originalPageRegistry}>
            <PageFlipErrorBoundary
              fallback={fallback}
              onError={() => {
                setFailed(true);
                setReadyBookKey(null);
                onError?.();
              }}
            >
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
            </PageFlipErrorBoundary>
          </SaugeNoireOriginalPageRegistryContext.Provider>
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
