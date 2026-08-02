"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SaugeNoireRoutePageFlip } from "./SaugeNoireRoutePageFlip";
import {
  mediaIsPrepared,
  readinessMediaForSurface
} from "./SaugeNoireMediaReadiness";

export type SaugeNoireRouteTransition = {
  id: string;
  href: string;
  snapshot: {
    currency: string;
    locale: string;
    view?: string;
    table?: string;
    zone?: string;
    href: string;
  };
  direction: "next" | "previous";
  source: ReactNode;
  destination: ReactNode;
  rail: ReactNode;
  frameClassName?: string;
  sourceScrollTop: number;
};

type ActiveTransition = SaugeNoireRouteTransition & {
  phase: "preparing" | "animating" | "awaiting-destination";
  sourcePathname: string;
};

type TransitionContextValue = {
  beginTransition: (transition: SaugeNoireRouteTransition) => boolean;
  prefetchDestination: (href: string) => void;
  notifyDestinationReady: (readyPathname: string) => void;
  onRouteGestureActiveChange: (active: boolean) => void;
  routeScrollOwnerActive: boolean;
  transitionActive: boolean;
};

type FullPrefetchRouter = {
  prefetch: (
    href: string,
    options: {
      kind: "full";
      onInvalidate: () => void;
    }
  ) => void;
};

const AWAITING_DESTINATION_TIMEOUT_MS = 6_000;

const TransitionContext = createContext<TransitionContextValue | null>(null);

export function useSaugeNoireTransition() {
  return useContext(TransitionContext);
}

export function SaugeNoireTransitionCoordinator({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const transitionRef = useRef<ActiveTransition | null>(null);
  const destinationReadyTransitionIdRef = useRef<string | null>(null);
  const destinationPathnameObservedRef = useRef(false);
  const prefetchedDestinationsRef = useRef(new Set<string>());
  const handoffFrameRef = useRef(0);
  const awaitingDestinationWatchdogRef = useRef(0);
  const focusFrameRef = useRef(0);
  const focusAfterHandoffRef = useRef(false);
  const settledPreviewScrollTopRef = useRef(0);
  const routeGestureActiveRef = useRef(false);
  const overlayReadyPendingRef = useRef(false);
  const overlayFallbackPendingRef = useRef(false);
  const settledPreviewGestureActiveRef = useRef(false);
  const destinationReadinessCheckRef = useRef<(() => void) | null>(null);
  const routeRendererRef = useRef<HTMLDivElement | null>(null);
  const [transition, setTransition] = useState<ActiveTransition | null>(null);

  const prefetchDestination = useCallback((href: string) => {
    let cacheKey: string | null = null;
    try {
      const destination = new URL(href, window.location.origin);
      if (destination.origin !== window.location.origin) return;
      const normalizedCacheKey = `${destination.pathname}${destination.search}`;
      cacheKey = normalizedCacheKey;
      if (prefetchedDestinationsRef.current.has(normalizedCacheKey)) return;

      prefetchedDestinationsRef.current.add(normalizedCacheKey);
      // Next 16.2.11 exposes FULL prefetching at runtime, but its enum type is
      // internal. Keep the application boundary structural and version-local.
      (router as unknown as FullPrefetchRouter).prefetch(normalizedCacheKey, {
        kind: "full",
        onInvalidate: () => {
          prefetchedDestinationsRef.current.delete(normalizedCacheKey);
        }
      });
    } catch {
      if (cacheKey !== null) prefetchedDestinationsRef.current.delete(cacheKey);
      // Prefetch is best-effort; the click keeps its native navigation path.
    }
  }, [router]);

  const beginTransition = useCallback((next: SaugeNoireRouteTransition) => {
    if (transitionRef.current) return false;
    prefetchDestination(next.href);
    const active = {
      ...next,
      phase: "preparing" as const,
      sourcePathname: pathnameRef.current
    };
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    focusAfterHandoffRef.current = true;
    settledPreviewScrollTopRef.current = 0;
    overlayReadyPendingRef.current = false;
    overlayFallbackPendingRef.current = false;
    settledPreviewGestureActiveRef.current = false;
    destinationReadyTransitionIdRef.current = null;
    destinationPathnameObservedRef.current = false;
    transitionRef.current = active;
    setTransition(active);
    return true;
  }, [prefetchDestination]);

  const updatePhase = useCallback((phase: ActiveTransition["phase"]) => {
    const current = transitionRef.current;
    if (!current || current.phase === phase) return;
    const next = { ...current, phase };
    transitionRef.current = next;
    setTransition(next);
  }, []);

  const handleRouteGestureActiveChange = useCallback((active: boolean) => {
    routeGestureActiveRef.current = active;
    if (active) return;
    const current = transitionRef.current;
    if (!current || current.phase !== "preparing") return;
    if (overlayFallbackPendingRef.current) {
      overlayFallbackPendingRef.current = false;
      overlayReadyPendingRef.current = false;
      updatePhase("awaiting-destination");
      router.push(current.href);
      return;
    }
    if (!overlayReadyPendingRef.current) return;
    overlayReadyPendingRef.current = false;
    updatePhase("animating");
  }, [router, updatePhase]);

  const handleOverlayReady = useCallback(() => {
    const current = transitionRef.current;
    if (!current || current.phase !== "preparing") return;
    if (overlayFallbackPendingRef.current) return;
    if (routeGestureActiveRef.current) {
      overlayReadyPendingRef.current = true;
      return;
    }
    updatePhase("animating");
  }, [updatePhase]);

  const handleFlipSettled = useCallback(() => {
    const current = transitionRef.current;
    if (!current || current.phase !== "animating") return;
    updatePhase("awaiting-destination");
    router.push(current.href);
  }, [router, updatePhase]);

  const handleOverlayFallback = useCallback(() => {
    const current = transitionRef.current;
    if (!current || current.phase === "awaiting-destination") return;
    if (
      current.phase === "preparing" &&
      routeGestureActiveRef.current
    ) {
      overlayFallbackPendingRef.current = true;
      return;
    }
    updatePhase("awaiting-destination");
    router.push(current.href);
  }, [router, updatePhase]);

  const transferDestinationScroll = useCallback(() => {
    const renderer = routeRendererRef.current?.matches(
      '[data-sauge-route-renderer-pending-handoff="true"]'
    )
      ? routeRendererRef.current
      : null;
    const activePage = renderer?.querySelector<HTMLElement>(
      '[data-sauge-reading-surface="true"][data-sauge-handoff-candidate="true"]'
    );
    if (!activePage?.isConnected) return false;
    const maxScroll = Math.max(
      0,
      activePage.scrollHeight - activePage.clientHeight
    );
    const desiredScrollTop = Math.min(
      maxScroll,
      Math.max(0, settledPreviewScrollTopRef.current)
    );
    if (Math.abs(activePage.scrollTop - desiredScrollTop) > 1) {
      activePage.scrollTop = desiredScrollTop;
    }
    return true;
  }, []);

  const tryCompleteHandoff = useCallback(() => {
    const current = transitionRef.current;
    if (!current || current.phase !== "awaiting-destination") return;
    if (destinationReadyTransitionIdRef.current !== current.id) return;
    const expectedPathname = new URL(current.href, window.location.origin).pathname;
    if (pathnameRef.current !== expectedPathname) return;
    if (settledPreviewGestureActiveRef.current) return;
    if (handoffFrameRef.current) return;
    const completeOnFrame = () => {
      handoffFrameRef.current = 0;
      const latest = transitionRef.current;
      if (!latest || latest.id !== current.id || latest.phase !== "awaiting-destination") return;
      if (destinationReadyTransitionIdRef.current !== latest.id) return;
      const latestExpectedPathname = new URL(latest.href, window.location.origin).pathname;
      if (pathnameRef.current !== latestExpectedPathname) return;
      if (settledPreviewGestureActiveRef.current) return;
      if (!transferDestinationScroll()) return;
      window.clearTimeout(awaitingDestinationWatchdogRef.current);
      destinationReadyTransitionIdRef.current = null;
      transitionRef.current = null;
      setTransition(null);
    };
    handoffFrameRef.current = window.requestAnimationFrame(completeOnFrame);
  }, [transferDestinationScroll]);

  const handleSettledPreviewGestureActiveChange = useCallback(
    (active: boolean) => {
      settledPreviewGestureActiveRef.current = active;
      if (!active) {
        const current = transitionRef.current;
        const handoffReadyForCurrent =
          current?.phase === "awaiting-destination" &&
          destinationReadyTransitionIdRef.current === current.id;
        if (!handoffReadyForCurrent) {
          destinationReadinessCheckRef.current?.();
        }
        tryCompleteHandoff();
      }
    },
    [tryCompleteHandoff]
  );

  useEffect(() => {
    if (transition !== null || !focusAfterHandoffRef.current) return;
    focusAfterHandoffRef.current = false;
    window.cancelAnimationFrame(focusFrameRef.current);
    focusFrameRef.current = window.requestAnimationFrame(() => {
      const renderer = routeRendererRef.current?.matches(
        '[data-sauge-route-renderer-pending-handoff="false"]'
      )
        ? routeRendererRef.current
        : null;
      const activePage = renderer?.querySelector<HTMLElement>(
        '[data-sauge-reading-surface="true"][data-sauge-scroll-owner="true"]'
      );
      const heading = activePage?.querySelector<HTMLElement>("h1, h2");
      if (!heading) return;
      const hadTabIndex = heading.hasAttribute("tabindex");
      if (!hadTabIndex) heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
      if (!hadTabIndex) {
        heading.addEventListener(
          "blur",
          () => heading.removeAttribute("tabindex"),
          { once: true }
        );
      }
    });
  }, [transition]);

  useEffect(() => {
    return () => {
      window.cancelAnimationFrame(handoffFrameRef.current);
      handoffFrameRef.current = 0;
      window.clearTimeout(awaitingDestinationWatchdogRef.current);
      window.cancelAnimationFrame(focusFrameRef.current);
    };
  }, []);

  useEffect(() => {
    pathnameRef.current = pathname;
    const current = transitionRef.current;
    if (current) {
      const expectedPathname = new URL(current.href, window.location.origin).pathname;
      if (pathname === expectedPathname) {
        destinationPathnameObservedRef.current = true;
      } else if (
        pathname !== current.sourcePathname ||
        destinationPathnameObservedRef.current
      ) {
        window.cancelAnimationFrame(handoffFrameRef.current);
        handoffFrameRef.current = 0;
        window.clearTimeout(awaitingDestinationWatchdogRef.current);
        destinationReadyTransitionIdRef.current = null;
        destinationPathnameObservedRef.current = false;
        overlayReadyPendingRef.current = false;
        overlayFallbackPendingRef.current = false;
        settledPreviewGestureActiveRef.current = false;
        transitionRef.current = null;
        setTransition(null);
        return;
      }
    }
    tryCompleteHandoff();
  }, [pathname, tryCompleteHandoff]);

  const destinationRendererIsReady = useCallback(() => {
    const renderer = routeRendererRef.current?.matches(
      '[data-sauge-route-renderer-pending-handoff="true"]'
    )
      ? routeRendererRef.current
      : null;
    const viewport = renderer?.querySelector<HTMLElement>("[data-page-flip-state]");
    if (!viewport) return false;
    if (viewport.getAttribute("data-page-flip-state") === "fallback-error") return true;
    if (
      viewport.getAttribute("data-page-flip-state") !== "ready" ||
      viewport.getAttribute("data-page-flip-engine-state") !== "read"
    ) {
      return false;
    }

    const currentPage = viewport.getAttribute("data-page-flip-current-page");
    const activePage = renderer?.querySelector<HTMLElement>(
      '[data-sauge-reading-surface="true"][data-sauge-handoff-candidate="true"]'
    );
    if (
      currentPage === null ||
      !activePage ||
      activePage.getAttribute("data-sauge-reading-page-index") !== currentPage
    ) {
      return false;
    }
    const media = readinessMediaForSurface(activePage, {
      projectedScrollTop: settledPreviewScrollTopRef.current,
      triggerLazy: true
    });
    for (const element of media) {
      const rect = element.getBoundingClientRect();
      if (!mediaIsPrepared(element) || rect.width <= 0 || rect.height <= 0) return false;
    }
    return true;
  }, []);

  const destinationRendererIsUsable = useCallback(() => {
    const renderer = routeRendererRef.current?.matches(
      '[data-sauge-route-renderer-pending-handoff="true"]'
    )
      ? routeRendererRef.current
      : null;
    const viewport = renderer?.querySelector<HTMLElement>("[data-page-flip-state]");
    if (!viewport) return false;
    if (viewport.getAttribute("data-page-flip-state") === "fallback-error") return true;
    const currentPage = viewport.getAttribute("data-page-flip-current-page");
    const activePage = renderer?.querySelector<HTMLElement>(
      '[data-sauge-reading-surface="true"][data-sauge-handoff-candidate="true"]'
    );
    if (
      viewport.getAttribute("data-page-flip-state") !== "ready" ||
      currentPage === null ||
      !activePage ||
      activePage.getAttribute("data-sauge-reading-page-index") !== currentPage
    ) {
      return false;
    }
    return true;
  }, []);

  const handleSettledPreviewScrollTopChange = useCallback((scrollTop: number) => {
    const nextScrollTop = Math.max(0, scrollTop);
    if (Math.abs(nextScrollTop - settledPreviewScrollTopRef.current) <= 1) return;
    settledPreviewScrollTopRef.current = nextScrollTop;
    destinationReadyTransitionIdRef.current = null;
    destinationReadinessCheckRef.current?.();
  }, []);

  const notifyDestinationReady = useCallback((readyPathname: string) => {
    const current = transitionRef.current;
    if (!current || current.phase !== "awaiting-destination") return;
    const expectedPathname = new URL(current.href, window.location.origin).pathname;
    if (readyPathname !== expectedPathname) return;
    if (!destinationRendererIsReady()) return;
    destinationReadyTransitionIdRef.current = current.id;
    tryCompleteHandoff();
  }, [destinationRendererIsReady, tryCompleteHandoff]);

  useEffect(() => {
    const current = transitionRef.current;
    if (!current || current.phase !== "awaiting-destination") return;
    const expectedPathname = new URL(current.href, window.location.origin).pathname;
    if (pathname !== expectedPathname) return;

    let mediaCleanup = () => {};
    const bindMediaSignals = () => {
      mediaCleanup();
      const renderer = routeRendererRef.current?.matches(
        '[data-sauge-route-renderer-pending-handoff="true"]'
      )
        ? routeRendererRef.current
        : null;
      const activePage = renderer?.querySelector<HTMLElement>(
        '[data-sauge-reading-surface="true"][data-sauge-handoff-candidate="true"]'
      );
      const media = activePage
        ? readinessMediaForSurface(activePage, {
            projectedScrollTop: settledPreviewScrollTopRef.current,
            triggerLazy: true
          })
        : [];
      const handleMediaSignal = () => checkDestinationReadiness();
      for (const element of media) {
        element.addEventListener("load", handleMediaSignal);
        element.addEventListener("error", handleMediaSignal);
        element.addEventListener("loadeddata", handleMediaSignal);
        element.addEventListener("loadedmetadata", handleMediaSignal);
      }
      mediaCleanup = () => {
        for (const element of media) {
          element.removeEventListener("load", handleMediaSignal);
          element.removeEventListener("error", handleMediaSignal);
          element.removeEventListener("loadeddata", handleMediaSignal);
          element.removeEventListener("loadedmetadata", handleMediaSignal);
        }
      };
    };

    const checkDestinationReadiness = () => {
      bindMediaSignals();
      const latest = transitionRef.current;
      if (
        !latest ||
        latest.id !== current.id ||
        latest.phase !== "awaiting-destination"
      ) {
        return;
      }
      if (pathnameRef.current !== expectedPathname) return;
      if (!destinationRendererIsReady()) {
        destinationReadyTransitionIdRef.current = null;
        if (handoffFrameRef.current) {
          window.cancelAnimationFrame(handoffFrameRef.current);
          handoffFrameRef.current = 0;
        }
        return;
      }
      destinationReadyTransitionIdRef.current = current.id;
      tryCompleteHandoff();
    };
    destinationReadinessCheckRef.current = checkDestinationReadiness;

    const mutationObserver =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(checkDestinationReadiness);
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(checkDestinationReadiness);
    const renderer = routeRendererRef.current?.matches(
      '[data-sauge-route-renderer-pending-handoff="true"]'
    )
      ? routeRendererRef.current
      : null;
    const activePage = renderer?.querySelector<HTMLElement>(
      '[data-sauge-reading-surface="true"][data-sauge-handoff-candidate="true"]'
    );
    const observeReadiness = () => {
      if (renderer) {
        mutationObserver?.observe(renderer, {
          attributes: true,
          childList: true,
          subtree: true
        });
      }
      if (renderer) resizeObserver?.observe(renderer);
      if (activePage) resizeObserver?.observe(activePage);
    };
    const handleWindowLoad = () => checkDestinationReadiness();
    const handleFontSignal = () => checkDestinationReadiness();

    bindMediaSignals();
    observeReadiness();
    window.addEventListener("load", handleWindowLoad);
    document.fonts?.addEventListener("loadingdone", handleFontSignal);
    document.fonts?.addEventListener("loadingerror", handleFontSignal);
    checkDestinationReadiness();

    return () => {
      if (destinationReadinessCheckRef.current === checkDestinationReadiness) {
        destinationReadinessCheckRef.current = null;
      }
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      mediaCleanup();
      window.removeEventListener("load", handleWindowLoad);
      document.fonts?.removeEventListener("loadingdone", handleFontSignal);
      document.fonts?.removeEventListener("loadingerror", handleFontSignal);
    };
  }, [
    destinationRendererIsReady,
    pathname,
    transition,
    tryCompleteHandoff
  ]);

  useEffect(() => {
    const current = transitionRef.current;
    if (!current || current.phase !== "awaiting-destination") return;

    awaitingDestinationWatchdogRef.current = window.setTimeout(() => {
      const latest = transitionRef.current;
      if (
        !latest ||
        latest.id !== current.id ||
        latest.phase !== "awaiting-destination"
      ) {
        return;
      }
      const latestExpectedPathname = new URL(
        latest.href,
        window.location.origin
      ).pathname;
      if (
        pathnameRef.current === latestExpectedPathname &&
        destinationRendererIsUsable()
      ) {
        destinationReadyTransitionIdRef.current = latest.id;
        tryCompleteHandoff();
        return;
      }
      window.location.assign(latest.href);
    }, AWAITING_DESTINATION_TIMEOUT_MS);

    return () => {
      window.clearTimeout(awaitingDestinationWatchdogRef.current);
    };
  }, [
    destinationRendererIsUsable,
    transition,
    tryCompleteHandoff
  ]);

  const contextValue = useMemo<TransitionContextValue>(
    () => ({
      beginTransition,
      prefetchDestination,
      notifyDestinationReady,
      onRouteGestureActiveChange: handleRouteGestureActiveChange,
      routeScrollOwnerActive:
        transition === null || transition.phase === "preparing",
      transitionActive: transition !== null
    }),
    [
      beginTransition,
      handleRouteGestureActiveChange,
      notifyDestinationReady,
      prefetchDestination,
      transition
    ]
  );

  const routeHasPendingHandoff =
    transition?.phase === "animating" || transition?.phase === "awaiting-destination";

  return (
    <TransitionContext.Provider value={contextValue}>
      <div
        ref={routeRendererRef}
        style={{
          display: "contents"
        }}
        data-sauge-route-renderer-pending-handoff={
          routeHasPendingHandoff ? "true" : "false"
        }
        aria-hidden={routeHasPendingHandoff || undefined}
        inert={routeHasPendingHandoff ? true : undefined}
      >
        {children}
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {transition ? "Ouverture de la page…" : ""}
      </p>
      {transition ? (
        <SaugeNoireRoutePageFlip
          id={transition.id}
          snapshot={transition.snapshot}
          direction={transition.direction}
          source={transition.source}
          destination={transition.destination}
          rail={transition.rail}
          frameClassName={transition.frameClassName}
          sourceScrollTop={transition.sourceScrollTop}
          phase={transition.phase}
          targetActivated={transition.phase !== "preparing"}
          visible={transition.phase !== "preparing"}
          onSettledPreviewScrollTopChange={handleSettledPreviewScrollTopChange}
          onSettledPreviewGestureActiveChange={
            handleSettledPreviewGestureActiveChange
          }
          onReady={handleOverlayReady}
          onFlip={handleFlipSettled}
          onFallback={handleOverlayFallback}
        />
      ) : null}
    </TransitionContext.Provider>
  );
}
