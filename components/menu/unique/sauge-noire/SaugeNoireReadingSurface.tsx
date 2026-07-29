"use client";

import {
  type ComponentPropsWithoutRef,
  forwardRef,
  type PointerEventHandler,
  type ReactNode,
  type TouchEventHandler,
  useCallback,
  useEffect,
  useRef,
  type UIEventHandler
} from "react";
import styles from "./SaugeNoireReadingSurface.module.css";

export type SaugeNoireReadingKind = "menu" | "dish" | "route-preview";

type SaugeNoireReadingSurfaceProps = {
  children: ReactNode;
  kind: SaugeNoireReadingKind;
  pageIndex?: number;
  visible: boolean;
  preview?: boolean;
  scrollOwner?: boolean;
  contentInert?: boolean;
  onGestureActiveChange?: (active: boolean) => void;
  onScroll?: UIEventHandler<HTMLDivElement>;
} & Omit<
  ComponentPropsWithoutRef<"div">,
  "children" | "inert" | "onScroll"
>;

export const SaugeNoireReadingSurface = forwardRef<
  HTMLDivElement,
  SaugeNoireReadingSurfaceProps
>(function SaugeNoireReadingSurface(
  {
    children,
    className,
    kind,
    pageIndex,
    visible,
    preview = false,
    scrollOwner = visible,
    contentInert = false,
    onGestureActiveChange,
    onScroll,
    onTouchStartCapture,
    onTouchEndCapture,
    onTouchCancelCapture,
    onPointerDownCapture,
    onPointerUpCapture,
    onPointerCancelCapture,
    onLostPointerCaptureCapture,
    ...surfaceProps
  },
  ref
) {
  const activeTouchIdentifiersRef = useRef(new Set<number>());
  const activePointerIdentifiersRef = useRef(new Set<number>());
  const gestureActiveRef = useRef(false);
  const onGestureActiveChangeRef = useRef(onGestureActiveChange);
  onGestureActiveChangeRef.current = onGestureActiveChange;

  const reportGestureState = useCallback(() => {
    const active =
      activeTouchIdentifiersRef.current.size > 0 ||
      activePointerIdentifiersRef.current.size > 0;
    if (gestureActiveRef.current === active) return;
    gestureActiveRef.current = active;
    onGestureActiveChangeRef.current?.(active);
  }, []);

  useEffect(() => {
    const activeTouchIdentifiers = activeTouchIdentifiersRef.current;
    const activePointerIdentifiers = activePointerIdentifiersRef.current;
    return () => {
      activeTouchIdentifiers.clear();
      activePointerIdentifiers.clear();
      if (!gestureActiveRef.current) return;
      gestureActiveRef.current = false;
      onGestureActiveChangeRef.current?.(false);
    };
  }, []);

  const handleTouchStartCapture: TouchEventHandler<HTMLDivElement> = (event) => {
    for (const touch of Array.from(event.changedTouches)) {
      activeTouchIdentifiersRef.current.add(touch.identifier);
    }
    reportGestureState();
    onTouchStartCapture?.(event);
  };

  const finishTouches = (event: Parameters<TouchEventHandler<HTMLDivElement>>[0]) => {
    for (const touch of Array.from(event.changedTouches)) {
      activeTouchIdentifiersRef.current.delete(touch.identifier);
    }
    reportGestureState();
  };

  const handleTouchEndCapture: TouchEventHandler<HTMLDivElement> = (event) => {
    finishTouches(event);
    onTouchEndCapture?.(event);
  };

  const handleTouchCancelCapture: TouchEventHandler<HTMLDivElement> = (event) => {
    finishTouches(event);
    onTouchCancelCapture?.(event);
  };

  const handlePointerDownCapture: PointerEventHandler<HTMLDivElement> = (event) => {
    if (event.pointerType !== "touch") {
      activePointerIdentifiersRef.current.add(event.pointerId);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // The pointer can end before capture is applied.
      }
      reportGestureState();
    }
    onPointerDownCapture?.(event);
  };

  const finishPointer = (event: Parameters<PointerEventHandler<HTMLDivElement>>[0]) => {
    if (event.pointerType === "touch") return;
    activePointerIdentifiersRef.current.delete(event.pointerId);
    reportGestureState();
  };

  const handlePointerUpCapture: PointerEventHandler<HTMLDivElement> = (event) => {
    finishPointer(event);
    onPointerUpCapture?.(event);
  };

  const handlePointerCancelCapture: PointerEventHandler<HTMLDivElement> = (event) => {
    finishPointer(event);
    onPointerCancelCapture?.(event);
  };

  const handleLostPointerCaptureCapture: PointerEventHandler<HTMLDivElement> = (
    event
  ) => {
    finishPointer(event);
    onLostPointerCaptureCapture?.(event);
  };

  return (
    <div
      {...surfaceProps}
      ref={ref}
      className={`${styles.surface} ${className ?? ""}`}
      data-sauge-reading-surface="true"
      data-sauge-scroll-owner={scrollOwner ? "true" : "false"}
      data-sauge-reading-visible={visible ? "true" : "false"}
      data-sauge-reading-page-index={pageIndex}
      data-sauge-reading-kind={kind}
      aria-hidden={preview || !visible || undefined}
      onScroll={onScroll}
      onTouchStartCapture={handleTouchStartCapture}
      onTouchEndCapture={handleTouchEndCapture}
      onTouchCancelCapture={handleTouchCancelCapture}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerUpCapture={handlePointerUpCapture}
      onPointerCancelCapture={handlePointerCancelCapture}
      onLostPointerCaptureCapture={handleLostPointerCaptureCapture}
    >
      <div
        className={styles.content}
        data-sauge-reading-content="true"
        inert={contentInert || preview ? true : undefined}
      >
        {children}
      </div>
    </div>
  );
});
