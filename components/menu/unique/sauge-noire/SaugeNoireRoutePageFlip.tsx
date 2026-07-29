"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  resolveSaugeNoireOriginalPage,
  SaugeNoireFlipPage
} from "./SaugeNoireFlipPage";
import { SaugeNoirePageFlipExperiment } from "./SaugeNoirePageFlipExperiment";
import styles from "./SaugeNoireRoutePageFlip.module.css";

type SaugeNoireRoutePageFlipProps = {
  id: string;
  direction: "next" | "previous";
  source: ReactNode;
  destination: ReactNode;
  rail: ReactNode;
  frameClassName?: string;
  sourceScrollTop: number;
  phase: "preparing" | "animating" | "awaiting-destination";
  targetActivated: boolean;
  visible: boolean;
  onTargetPreviewScrollTopChange: (scrollTop: number) => void;
  onReady: () => void;
  onFlip: () => void;
  onFallback: () => void;
};

/**
 * A short-lived, two-sheet PageFlip kept inside the currently mounted route.
 * The route owner decides what to navigate to only after this component gets
 * the real StPageFlip `flip` event and the following `read` state.
 */
export function SaugeNoireRoutePageFlip({
  id,
  direction,
  source,
  destination,
  rail,
  frameClassName,
  sourceScrollTop,
  phase,
  targetActivated,
  visible,
  onTargetPreviewScrollTopChange,
  onReady,
  onFlip,
  onFallback
}: SaugeNoireRoutePageFlipProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);
  const phaseRef = useRef({
    started: false,
    reachedTarget: false,
    returnedToRead: false
  });
  const [hasStartedFlipping, setHasStartedFlipping] = useState(false);
  const [hasReachedTarget, setHasReachedTarget] = useState(false);
  const [hasReturnedToRead, setHasReturnedToRead] = useState(false);

  const startPage = direction === "next" ? 0 : 1;
  const targetPage = direction === "next" ? 1 : 0;
  const pages = useMemo(
    () => {
      const sourcePage = (
        <SaugeNoireFlipPage density="soft" index={startPage} key={`${id}-source`}>
          {source}
        </SaugeNoireFlipPage>
      );
      const destinationPage = (
        <SaugeNoireFlipPage density="soft" index={targetPage} key={`${id}-destination`}>
          {destination}
        </SaugeNoireFlipPage>
      );

      return direction === "next"
        ? [sourcePage, destinationPage]
        : [destinationPage, sourcePage];
    },
    [destination, direction, id, source, startPage, targetPage]
  );

  const restoreSourceScroll = useCallback(() => {
    const overlay = overlayRef.current;
    const sourcePage = overlay
      ? resolveSaugeNoireOriginalPage(overlay, startPage)
      : null;
    if (sourcePage && sourcePage.scrollTop !== sourceScrollTop) {
      sourcePage.scrollTop = sourceScrollTop;
    }
  }, [sourceScrollTop, startPage]);

  useLayoutEffect(() => {
    restoreSourceScroll();
    const frame = window.requestAnimationFrame(restoreSourceScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [restoreSourceScroll]);

  useLayoutEffect(() => {
    if (phase !== "awaiting-destination") return;
    const overlay = overlayRef.current;
    const target = overlay
      ? resolveSaugeNoireOriginalPage(overlay, targetPage)
      : null;
    if (!target) return;

    target.setAttribute("data-sauge-route-preview-scroll-target", "true");
    const inertChildren = Array.from(target.children).map((child) => ({
      child,
      wasInert: child.hasAttribute("inert")
    }));
    for (const { child } of inertChildren) child.setAttribute("inert", "");

    const handleScroll = () => {
      onTargetPreviewScrollTopChange(target.scrollTop);
    };
    onTargetPreviewScrollTopChange(target.scrollTop);
    target.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      target.removeEventListener("scroll", handleScroll);
      target.removeAttribute("data-sauge-route-preview-scroll-target");
      for (const { child, wasInert } of inertChildren) {
        if (!wasInert) child.removeAttribute("inert");
      }
    };
  }, [onTargetPreviewScrollTopChange, phase, targetPage]);

  useEffect(() => {
    // This is only a failure escape hatch. A successful transition navigates
    // after the flip event and the following read state.
    const timeout = window.setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onFallback();
      }
    }, 2_500);
    return () => window.clearTimeout(timeout);
  }, [onFallback]);

  const handleFlip = useCallback(
    (index: number) => {
      if (index !== targetPage || completedRef.current) return;
      phaseRef.current.reachedTarget = true;
      overlayRef.current?.setAttribute(
        "data-sauge-route-transition-target-reached",
        "true"
      );
      setHasReachedTarget(true);
      if (phaseRef.current.started && phaseRef.current.returnedToRead) {
        completedRef.current = true;
        onFlip();
      }
    },
    [onFlip, targetPage]
  );

  const handleChangeState = useCallback((state: string) => {
    if (state === "flipping") {
      phaseRef.current.started = true;
      overlayRef.current?.setAttribute(
        "data-sauge-route-transition-flip-started",
        "true"
      );
      setHasStartedFlipping(true);
      return;
    }
    if (state !== "read" || !phaseRef.current.started) return;

    phaseRef.current.returnedToRead = true;
    overlayRef.current?.setAttribute("data-sauge-route-transition-settled", "true");
    setHasReturnedToRead(true);
    if (phaseRef.current.reachedTarget && !completedRef.current) {
      completedRef.current = true;
      onFlip();
    }
  }, [onFlip]);

  const handleError = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onFallback();
  }, [onFallback]);

  return (
    <div
      ref={overlayRef}
      className={styles.routeTransitionOverlay}
      data-sauge-route-transition="true"
      data-sauge-route-transition-direction={direction}
      data-sauge-route-transition-start={startPage}
      data-sauge-route-transition-target={targetPage}
      data-sauge-route-transition-flip-started={hasStartedFlipping ? "true" : "false"}
      data-sauge-route-transition-target-reached={hasReachedTarget ? "true" : "false"}
      data-sauge-route-transition-settled={hasReturnedToRead ? "true" : "false"}
      data-sauge-route-transition-visible={visible ? "true" : "false"}
      data-sauge-route-transition-phase={phase}
      data-sauge-route-transition-scrollable={
        phase === "awaiting-destination" ? "true" : "false"
      }
      data-sauge-route-transition-current-page={targetActivated ? targetPage : startPage}
      aria-hidden="true"
      inert={phase !== "awaiting-destination" ? true : undefined}
    >
      {rail}
      <div
        className={`${styles.routeTransitionSurface} ${frameClassName ?? ""}`}
        data-sauge-route-transition-surface="true"
      >
        <SaugeNoirePageFlipExperiment
          pages={pages}
          pageIndex={targetActivated ? targetPage : startPage}
          startPage={startPage}
          onPageFlip={handleFlip}
          onReady={onReady}
          onChangeState={handleChangeState}
          onError={handleError}
          resetKey={id}
          protectInteractiveTargets
          showCover={false}
          renderOnlyPageLengthChange
          fallback={source}
        />
      </div>
    </div>
  );
}
