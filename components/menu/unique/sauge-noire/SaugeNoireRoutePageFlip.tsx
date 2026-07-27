"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
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
  onFlip: () => void;
  onFallback: () => void;
};

/**
 * A short-lived, two-sheet PageFlip kept inside the currently mounted route.
 * The route owner decides what to navigate to only after this component gets
 * the real StPageFlip `flip` event.
 */
export function SaugeNoireRoutePageFlip({
  id,
  direction,
  source,
  destination,
  sourceScrollTop,
  onFlip,
  onFallback
}: SaugeNoireRoutePageFlipProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);
  const readyRef = useRef(false);

  const startPage = direction === "next" ? 0 : 1;
  const targetPage = direction === "next" ? 1 : 0;
  const pages = useMemo(
    () => [
      <SaugeNoireFlipPage density="soft" index={0} key={`${id}-source`}>
        {source}
      </SaugeNoireFlipPage>,
      <SaugeNoireFlipPage density="soft" index={1} key={`${id}-destination`}>
        {destination}
      </SaugeNoireFlipPage>
    ],
    [destination, id, source]
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
    // This is only a failure escape hatch. A successful transition always
    // navigates from onFlip, never from this timer.
    const timeout = window.setTimeout(() => {
      if (!readyRef.current && !completedRef.current) {
        onFallback();
      }
    }, 2_500);
    return () => window.clearTimeout(timeout);
  }, [onFallback]);

  const handleFlip = useCallback(
    (index: number) => {
      if (index !== targetPage || completedRef.current) return;
      completedRef.current = true;
      onFlip();
    },
    [onFlip, targetPage]
  );

  const handleReady = useCallback(() => {
    readyRef.current = true;
  }, []);

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
      aria-hidden="true"
    >
      <SaugeNoirePageFlipExperiment
        pages={pages}
        pageIndex={targetPage}
        startPage={startPage}
        onPageFlip={handleFlip}
        onReady={handleReady}
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
