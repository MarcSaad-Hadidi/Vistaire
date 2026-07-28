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
  useRef,
  useState
} from "react";
import styles from "./SaugeNoireBookMenu.module.css";

type PageFlipApi = {
  getCurrentPageIndex: () => number;
  turnToPage: (page: number) => void;
  flipNext: () => void;
  flipPrev: () => void;
  getState: () => string;
  update: () => void;
  destroy: () => void;
};

type PageFlipHandle = {
  pageFlip: () => PageFlipApi | undefined;
};

type PageFlipEvent = {
  data?: number | string;
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
  pageIndex: number;
  startPage?: number;
  onPageFlip: (index: number) => void;
  onReady?: () => void;
  onChangeState?: (state: string) => void;
  onError?: () => void;
  onSwipe?: (direction: "next" | "previous") => void;
  interceptSwipe?: boolean;
  resetKey?: string | number;
  protectInteractiveTargets?: boolean;
  showCover?: boolean;
  renderOnlyPageLengthChange?: boolean;
  fallback: ReactNode;
};

type FlipDimensions = {
  width: number;
  height: number;
};

const SWIPE_DISTANCE = 32;

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
  onChangeState,
  onError,
  onSwipe,
  interceptSwipe = false,
  resetKey,
  protectInteractiveTargets = false,
  showCover = true,
  renderOnlyPageLengthChange = false,
  fallback
}: SaugeNoirePageFlipExperimentProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<PageFlipHandle>(null);
  const originalPagesRef = useRef<Set<HTMLElement>>(new Set());
  const readyBookKeyRef = useRef<string | null>(null);
  const requestedPageIndexRef = useRef<number | null>(null);
  const animationTargetPageRef = useRef<number | null>(null);
  const gestureStartRef = useRef<{
    x: number;
    y: number;
    axis: "undecided" | "horizontal" | "vertical";
  } | null>(null);
  const [dimensions, setDimensions] = useState<FlipDimensions | null>(null);
  const [readyBookKey, setReadyBookKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [engineState, setEngineState] = useState("idle");
  const lastResetKeyRef = useRef<string | number | undefined>(resetKey);
  const dimensionsRef = useRef<FlipDimensions | null>(null);
  const onChangeStateRef = useRef(onChangeState);
  const pendingDimensionUpdateRef = useRef(false);
  const appliedDimensionKeyRef = useRef<string | null>(null);
  const failedRef = useRef(false);
  const cleanupGenerationRef = useRef(0);
  const reportedFlipPageRef = useRef<number | null>(null);
  // The DOM identity belongs to the logical book, not to a volatile viewport
  // measurement. PageFlip can recalculate its bounds in place on resize.
  const bookKey = resetKey === undefined ? "sauge-main-book" : `sauge-book-${resetKey}`;
  const bookIsReady = bookKey !== null && readyBookKey === bookKey;

  useEffect(() => {
    dimensionsRef.current = dimensions;
    onChangeStateRef.current = onChangeState;
    failedRef.current = failed;
  }, [dimensions, failed, onChangeState]);

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

    const dimensionKey = `${currentDimensions.width}-${currentDimensions.height}`;
    if (pageFlip.getState() === "flipping") {
      pendingDimensionUpdateRef.current = true;
      return;
    }
    if (appliedDimensionKeyRef.current === dimensionKey && !pendingDimensionUpdateRef.current) {
      return;
    }

    pageFlip.update();
    appliedDimensionKeyRef.current = dimensionKey;
    pendingDimensionUpdateRef.current = false;
  }, [bookKey]);

  useEffect(() => {
    updatePageFlipBounds();
  }, [dimensions, updatePageFlipBounds]);

  const captureOriginalPages = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const pageElements = Array.from(
      viewport.querySelectorAll<HTMLElement>("[data-sauge-flip-page-index]")
    );
    if (pageElements.length !== pages.length) return;

    const currentElements = new Set(pageElements);
    const currentSetStillMatches =
      originalPagesRef.current.size === pageElements.length &&
      Array.from(originalPagesRef.current).every((element) => currentElements.has(element));
    if (!currentSetStillMatches) originalPagesRef.current = currentElements;
  }, [pages.length]);

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
      setDimensions((current) =>
        current?.width === next.width && current.height === next.height ? current : next
      );
    };

    updateDimensions();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

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
      captureOriginalPages();
      viewport.querySelectorAll<HTMLElement>(".stf__item").forEach((page) => {
        if (originalPagesRef.current.has(page)) return;
        page.setAttribute("data-sauge-flip-clone", "true");
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
  }, [bookIsReady, captureOriginalPages, dimensions, failed]);

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
    const frame = window.requestAnimationFrame(() => {
      const pageFlip = bookRef.current?.pageFlip();
      if (!pageFlip || dimensions === null || !bookIsReady || failed) return;
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
  }, [bookIsReady, dimensions, engineState, failed, pageIndex]);

  useEffect(() => {
    const activeBookRef = bookRef;
    const cleanupGeneration = ++cleanupGenerationRef.current;
    return () => {
      const pageFlip = activeBookRef.current?.pageFlip();
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
    readyBookKeyRef.current = bookKey;
    requestedPageIndexRef.current = null;
    animationTargetPageRef.current = null;
    reportedFlipPageRef.current = null;
    setEngineState("read");
    setReadyBookKey(bookKey);
    appliedDimensionKeyRef.current = null;
    captureOriginalPages();
  };

  const handleChangeState = useCallback((event: PageFlipEvent) => {
    const state = String(event.data);
    setEngineState(state);
    if (state === "flipping") reportedFlipPageRef.current = null;
    onChangeStateRef.current?.(state);
    if (state === "read" && pendingDimensionUpdateRef.current) {
      window.requestAnimationFrame(updatePageFlipBounds);
    }
  }, [updatePageFlipBounds]);

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

  const shouldShowFallback = dimensions === null || failed;
  const isTransientFallback = dimensions === null && !failed;

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
    >
      {shouldShowFallback ? (
        <div
          className={styles.pageFlipFallback}
          data-page-flip-fallback="instant"
          aria-hidden={isTransientFallback ? "true" : undefined}
          ref={(element) => {
            if (!element) return;
            if (isTransientFallback) {
              element.setAttribute("inert", "");
            } else {
              element.removeAttribute("inert");
            }
          }}
        >
          {fallback}
        </div>
      ) : (
        <>
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
              onInit={() => {
                handleInit();
                onReady?.();
              }}
            >
              {pages}
            </HTMLFlipBook>
          </PageFlipErrorBoundary>
          {!bookIsReady ? (
            <div
              className={styles.pageFlipInitializing}
              aria-hidden="true"
              ref={(element) => element?.setAttribute("inert", "")}
            >
              {fallback}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
