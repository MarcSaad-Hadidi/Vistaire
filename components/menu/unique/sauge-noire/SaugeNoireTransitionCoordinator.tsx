"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { resolveSaugeNoireOriginalPage } from "./SaugeNoireFlipPage";
import { SaugeNoireRoutePageFlip } from "./SaugeNoireRoutePageFlip";

export type SaugeNoireRouteTransition = {
  id: string;
  href: string;
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
  const readinessFrameRef = useRef(0);
  const awaitingDestinationWatchdogRef = useRef(0);
  const focusFrameRef = useRef(0);
  const focusAfterHandoffRef = useRef(false);
  const targetPreviewScrollTopRef = useRef(0);
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
    targetPreviewScrollTopRef.current = 0;
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

  const handleOverlayReady = useCallback(() => {
    const current = transitionRef.current;
    if (!current || current.phase !== "preparing") return;
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
    updatePhase("awaiting-destination");
    router.push(current.href);
  }, [router, updatePhase]);

  const syncDestinationScroll = useCallback(() => {
    const renderer = document.querySelector<HTMLElement>(
      '[data-sauge-route-renderer-hidden="true"]'
    );
    const viewport = renderer?.querySelector<HTMLElement>("[data-page-flip-state]");
    const actualPage = viewport?.getAttribute("data-page-flip-actual-page");
    const activePage =
      viewport && actualPage !== null && actualPage !== undefined
        ? resolveSaugeNoireOriginalPage(viewport, actualPage)
        : null;
    if (!activePage || !activePage.isConnected) return false;
    const desiredScrollTop = Math.max(0, targetPreviewScrollTopRef.current);
    activePage.scrollTop = desiredScrollTop;
    return Math.abs(activePage.scrollTop - desiredScrollTop) <= 1;
  }, []);

  const tryCompleteHandoff = useCallback(() => {
    const current = transitionRef.current;
    if (!current || current.phase !== "awaiting-destination") return;
    if (destinationReadyTransitionIdRef.current !== current.id) return;
    const expectedPathname = new URL(current.href, window.location.origin).pathname;
    if (pathnameRef.current !== expectedPathname) return;
    window.cancelAnimationFrame(handoffFrameRef.current);
    window.cancelAnimationFrame(readinessFrameRef.current);
    const completeOnFrame = () => {
      const latest = transitionRef.current;
      if (!latest || latest.id !== current.id || latest.phase !== "awaiting-destination") return;
      if (destinationReadyTransitionIdRef.current !== latest.id) return;
      const latestExpectedPathname = new URL(latest.href, window.location.origin).pathname;
      if (pathnameRef.current !== latestExpectedPathname) return;
      if (!syncDestinationScroll()) {
        handoffFrameRef.current = window.requestAnimationFrame(completeOnFrame);
        return;
      }
      window.clearTimeout(awaitingDestinationWatchdogRef.current);
      destinationReadyTransitionIdRef.current = null;
      transitionRef.current = null;
      setTransition(null);
    };
    handoffFrameRef.current = window.requestAnimationFrame(completeOnFrame);
  }, [syncDestinationScroll]);

  useEffect(() => {
    if (transition !== null || !focusAfterHandoffRef.current) return;
    focusAfterHandoffRef.current = false;
    window.cancelAnimationFrame(focusFrameRef.current);
    focusFrameRef.current = window.requestAnimationFrame(() => {
      const renderer = document.querySelector<HTMLElement>(
        '[data-sauge-route-renderer-hidden="false"]'
      );
      const viewport = renderer?.querySelector<HTMLElement>(
        '[data-page-flip-state="ready"]'
      );
      const activePageIndex = viewport?.getAttribute("data-page-flip-actual-page");
      const activePage =
        viewport && activePageIndex !== null && activePageIndex !== undefined
          ? resolveSaugeNoireOriginalPage(viewport, activePageIndex)
          : null;
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
      window.cancelAnimationFrame(readinessFrameRef.current);
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
        window.cancelAnimationFrame(readinessFrameRef.current);
        window.clearTimeout(awaitingDestinationWatchdogRef.current);
        destinationReadyTransitionIdRef.current = null;
        destinationPathnameObservedRef.current = false;
        transitionRef.current = null;
        setTransition(null);
        return;
      }
    }
    tryCompleteHandoff();
  }, [pathname, tryCompleteHandoff]);

  const destinationRendererIsReady = useCallback(() => {
    const renderer = document.querySelector<HTMLElement>(
      '[data-sauge-route-renderer-hidden="true"]'
    );
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
    const actualPage = viewport.getAttribute("data-page-flip-actual-page");
    if (currentPage === null || currentPage !== actualPage) return false;
    const activePage =
      actualPage === null
        ? null
        : resolveSaugeNoireOriginalPage(viewport, actualPage);
    if (!activePage || !syncDestinationScroll()) return false;
    const image = activePage.querySelector<HTMLImageElement>("img");
    if (image) {
      const rect = image.getBoundingClientRect();
      if (!image.complete || rect.width <= 0 || rect.height <= 0) return false;
    }
    return true;
  }, [syncDestinationScroll]);

  const destinationRendererIsUsable = useCallback(() => {
    const renderer = document.querySelector<HTMLElement>(
      '[data-sauge-route-renderer-hidden="true"]'
    );
    const viewport = renderer?.querySelector<HTMLElement>("[data-page-flip-state]");
    if (!viewport) return false;
    if (viewport.getAttribute("data-page-flip-state") === "fallback-error") return true;
    const actualPage = viewport.getAttribute("data-page-flip-actual-page");
    const currentPage = viewport.getAttribute("data-page-flip-current-page");
    if (
      viewport.getAttribute("data-page-flip-state") !== "ready" ||
      actualPage === null ||
      currentPage !== actualPage
    ) {
      return false;
    }
    return syncDestinationScroll();
  }, [syncDestinationScroll]);

  const handleTargetPreviewScrollTopChange = useCallback((scrollTop: number) => {
    targetPreviewScrollTopRef.current = Math.max(0, scrollTop);
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

    const pollDestinationReadiness = () => {
      const latest = transitionRef.current;
      if (
        !latest ||
        latest.id !== current.id ||
        latest.phase !== "awaiting-destination"
      ) {
        return;
      }
      if (!destinationRendererIsReady()) {
        readinessFrameRef.current = window.requestAnimationFrame(
          pollDestinationReadiness
        );
        return;
      }
      destinationReadyTransitionIdRef.current = current.id;
      tryCompleteHandoff();
    };

    readinessFrameRef.current = window.requestAnimationFrame(
      pollDestinationReadiness
    );

    return () => {
      window.cancelAnimationFrame(readinessFrameRef.current);
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
      window.cancelAnimationFrame(readinessFrameRef.current);
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
      transitionActive: transition !== null
    }),
    [beginTransition, notifyDestinationReady, prefetchDestination, transition]
  );

  const routeIsHidden =
    transition?.phase === "animating" || transition?.phase === "awaiting-destination";

  return (
    <TransitionContext.Provider value={contextValue}>
      <div
        style={{
          display: "contents",
          visibility: routeIsHidden ? "hidden" : undefined
        }}
        aria-hidden={routeIsHidden || undefined}
        ref={(element) => {
          if (!element) return;
          if (transition !== null) element.setAttribute("inert", "");
          else element.removeAttribute("inert");
        }}
        data-sauge-route-renderer-hidden={routeIsHidden ? "true" : "false"}
      >
        {children}
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {transition ? "Ouverture de la page…" : ""}
      </p>
      {transition ? (
        <SaugeNoireRoutePageFlip
          id={transition.id}
          direction={transition.direction}
          source={transition.source}
          destination={transition.destination}
          rail={transition.rail}
          frameClassName={transition.frameClassName}
          sourceScrollTop={transition.sourceScrollTop}
          phase={transition.phase}
          targetActivated={transition.phase !== "preparing"}
          visible={transition.phase !== "preparing"}
          onTargetPreviewScrollTopChange={handleTargetPreviewScrollTopChange}
          onReady={handleOverlayReady}
          onFlip={handleFlipSettled}
          onFallback={handleOverlayFallback}
        />
      ) : null}
    </TransitionContext.Provider>
  );
}
