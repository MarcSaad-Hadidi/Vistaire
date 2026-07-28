"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SaugeNoireRoutePageFlip } from "./SaugeNoireRoutePageFlip";

export type SaugeNoireRouteTransition = {
  id: string;
  href: string;
  direction: "next" | "previous";
  source: ReactNode;
  destination: ReactNode;
  sourceScrollTop: number;
};

type ActiveTransition = SaugeNoireRouteTransition & {
  phase: "preparing" | "animating" | "awaiting-destination";
};

type TransitionContextValue = {
  beginTransition: (transition: SaugeNoireRouteTransition) => boolean;
  notifyDestinationReady: () => void;
  transitionActive: boolean;
};

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
  const handoffFrameRef = useRef(0);
  const [transition, setTransition] = useState<ActiveTransition | null>(null);

  const beginTransition = useCallback((next: SaugeNoireRouteTransition) => {
    if (transitionRef.current) return false;
    const active = { ...next, phase: "preparing" as const };
    destinationReadyTransitionIdRef.current = null;
    transitionRef.current = active;
    setTransition(active);
    return true;
  }, []);

  const updatePhase = useCallback((phase: ActiveTransition["phase"]) => {
    const current = transitionRef.current;
    if (!current || current.phase === phase) return;
    const next = { ...current, phase };
    transitionRef.current = next;
    setTransition(next);
  }, []);

  const handleOverlayReady = useCallback(() => {
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

  const tryCompleteHandoff = useCallback(() => {
    const current = transitionRef.current;
    if (!current || current.phase !== "awaiting-destination") return;
    if (destinationReadyTransitionIdRef.current !== current.id) return;
    const expectedPathname = new URL(current.href, window.location.origin).pathname;
    if (pathnameRef.current !== expectedPathname) return;
    window.cancelAnimationFrame(handoffFrameRef.current);
    handoffFrameRef.current = window.requestAnimationFrame(() => {
      const latest = transitionRef.current;
      if (!latest || latest.id !== current.id || latest.phase !== "awaiting-destination") return;
      if (destinationReadyTransitionIdRef.current !== latest.id) return;
      const latestExpectedPathname = new URL(latest.href, window.location.origin).pathname;
      if (pathnameRef.current !== latestExpectedPathname) return;
      destinationReadyTransitionIdRef.current = null;
      transitionRef.current = null;
      setTransition(null);
    });
  }, []);

  useEffect(() => {
    pathnameRef.current = pathname;
    tryCompleteHandoff();
  }, [pathname, tryCompleteHandoff]);

  const notifyDestinationReady = useCallback(() => {
    const current = transitionRef.current;
    if (!current || current.phase !== "awaiting-destination") return;
    destinationReadyTransitionIdRef.current = current.id;
    tryCompleteHandoff();
  }, [tryCompleteHandoff]);

  const contextValue = useMemo<TransitionContextValue>(
    () => ({
      beginTransition,
      notifyDestinationReady,
      transitionActive: transition !== null
    }),
    [beginTransition, notifyDestinationReady, transition]
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
          if (routeIsHidden) element.setAttribute("inert", "");
          else element.removeAttribute("inert");
        }}
        data-sauge-route-renderer-hidden={routeIsHidden ? "true" : "false"}
      >
        {children}
      </div>
      {transition ? (
        <SaugeNoireRoutePageFlip
          id={transition.id}
          direction={transition.direction}
          source={transition.source}
          destination={transition.destination}
          sourceScrollTop={transition.sourceScrollTop}
          phase={transition.phase}
          targetActivated={transition.phase !== "preparing"}
          visible={transition.phase !== "preparing"}
          onReady={handleOverlayReady}
          onFlip={handleFlipSettled}
          onFallback={handleOverlayFallback}
        />
      ) : null}
    </TransitionContext.Provider>
  );
}
