"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { SaugeNoireFlipPage } from "./SaugeNoireFlipPage";
import { SaugeNoirePageFlipExperiment } from "./SaugeNoirePageFlipExperiment";
import styles from "./SaugeNoireRoutePageFlip.module.css";

type SaugeNoireRoutePageFlipProps = {
  id: string;
  direction: "next" | "previous";
  source: ReactNode;
  destination: ReactNode;
  sourceScrollTop: number;
  active: boolean;
  visible: boolean;
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
  sourceScrollTop,
  active,
  visible,
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
    const sourcePage = overlayRef.current?.querySelector<HTMLElement>(
      `[data-sauge-flip-page-index="${startPage}"]:not([data-sauge-flip-clone])`
    );
    if (sourcePage && sourcePage.scrollTop !== sourceScrollTop) {
      sourcePage.scrollTop = sourceScrollTop;
    }
  }, [sourceScrollTop, startPage]);

  useLayoutEffect(() => {
    restoreSourceScroll();
    const frame = window.requestAnimationFrame(restoreSourceScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [restoreSourceScroll]);

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
      setHasStartedFlipping(true);
      return;
    }
    if (state !== "read" || !phaseRef.current.started) return;

    phaseRef.current.returnedToRead = true;
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
      aria-hidden="true"
    >
      <SaugeNoirePageFlipExperiment
        pages={pages}
        pageIndex={active ? targetPage : startPage}
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
  );
}
