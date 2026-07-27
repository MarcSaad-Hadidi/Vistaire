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
  flipNext: () => void;
  flipPrev: () => void;
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
  onPageFlip: (index: number) => void;
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

export function SaugeNoirePageFlipExperiment({
  pages,
  pageIndex,
  onPageFlip,
  fallback
}: SaugeNoirePageFlipExperimentProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<PageFlipHandle>(null);
  const originalPagesRef = useRef<Set<HTMLElement>>(new Set());
  const readyBookKeyRef = useRef<string | null>(null);
  const requestedPageIndexRef = useRef<number | null>(null);
  const animationTargetPageRef = useRef<number | null>(null);
  const gestureStartRef = useRef<{ x: number; y: number } | null>(null);
  const [dimensions, setDimensions] = useState<FlipDimensions | null>(null);
  const [readyBookKey, setReadyBookKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const bookKey = dimensions ? `${dimensions.width}-${dimensions.height}` : null;
  const bookIsReady = bookKey !== null && readyBookKey === bookKey;

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
    if (!pageFlip || dimensions === null || !bookIsReady || failed) return;

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
  }, [bookIsReady, dimensions, failed, pageIndex]);

  useEffect(() => {
    const activeBookRef = bookRef;
    return () => {
      const pageFlip = activeBookRef.current?.pageFlip();
      if (!pageFlip) return;
      queueMicrotask(() => {
        try {
          pageFlip.destroy();
        } catch {
          // The React wrapper does not clean up its PageFlip instance itself.
        }
      });
    };
  }, []);

  const handleFlip = (event: PageFlipEvent) => {
    if (bookKey === null || readyBookKeyRef.current !== bookKey) return;
    const nextIndex = parsePageIndex(event);
    if (nextIndex === null) return;
    const animationTarget = animationTargetPageRef.current;
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
    setReadyBookKey(bookKey);
    captureOriginalPages();
  };

  const rememberGestureStart = (x: number, y: number, target: EventTarget | null) => {
    if (!bookIsReady || isPageFlipProtectedTarget(target)) {
      gestureStartRef.current = null;
      return;
    }
    gestureStartRef.current = { x, y };
  };

  const handleSwipeEnd = (
    endX: number,
    endY: number,
    preventDefault: () => void
  ) => {
    const start = gestureStartRef.current;
    gestureStartRef.current = null;
    if (!start || requestedPageIndexRef.current !== null) return;

    const deltaX = endX - start.x;
    const deltaY = endY - start.y;
    if (Math.abs(deltaX) < SWIPE_DISTANCE || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    const pageFlip = bookRef.current?.pageFlip();
    if (!pageFlip) return;
    const currentPage = pageFlip.getCurrentPageIndex();
    const nextPage = deltaX < 0 ? currentPage + 1 : currentPage - 1;
    if (nextPage < 0 || nextPage >= pages.length) return;

    preventDefault();
    requestedPageIndexRef.current = nextPage;
    if (deltaX < 0) pageFlip.flipNext();
    else pageFlip.flipPrev();
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPageFlipInteractiveTarget(event.target)) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    rememberGestureStart(event.clientX, event.clientY, event.target);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    handleSwipeEnd(event.clientX, event.clientY, () => event.preventDefault());
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = gestureStartRef.current;
    if (!start) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) >= SWIPE_DISTANCE && Math.abs(deltaX) > Math.abs(deltaY)) {
      event.preventDefault();
    }
  };

  const handlePointerCancel = () => {
    gestureStartRef.current = null;
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (gestureStartRef.current) return;
    if (!bookIsReady || isPageFlipProtectedTarget(event.target)) {
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
    if (Math.abs(deltaX) >= SWIPE_DISTANCE && Math.abs(deltaX) > Math.abs(deltaY)) {
      event.preventDefault();
    }
  };

  const shouldShowFallback = dimensions === null || failed;
  const shouldHideBook = !bookIsReady || failed;

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
      onTouchCancel={handlePointerCancel}
      data-page-flip-state={
        failed ? "fallback-error" : bookIsReady ? "ready" : "loading"
      }
    >
      {shouldShowFallback ? (
        <div className={styles.pageFlipFallback} data-page-flip-fallback="instant">
          {fallback}
        </div>
      ) : (
        <>
          <PageFlipErrorBoundary
            fallback={fallback}
            onError={() => {
              setFailed(true);
              setReadyBookKey(null);
            }}
          >
            <HTMLFlipBook
              key={bookKey ?? undefined}
              ref={bookRef}
              className={`${styles.pageFlipBook} ${shouldHideBook ? styles.pageFlipBookPending : ""}`}
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
              startPage={pageIndex}
              drawShadow
              flippingTime={720}
              usePortrait
              startZIndex={0}
              autoSize={false}
              maxShadowOpacity={0.62}
              showCover
              mobileScrollSupport
              swipeDistance={44}
              clickEventForward
              useMouseEvents={false}
              showPageCorners={false}
              // Mouse events are disabled below; programmatic swipe turns
              // still need the library's corner guard to be bypassed.
              disableFlipByClick={false}
              onFlip={handleFlip}
              onInit={handleInit}
            >
              {pages}
            </HTMLFlipBook>
          </PageFlipErrorBoundary>
          {!bookIsReady ? (
            <div className={styles.pageFlipInitializing} aria-hidden="true">
              {fallback}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
