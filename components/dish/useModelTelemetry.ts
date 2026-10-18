"use client";
import { useCallback, useEffect, useRef } from "react";
import {
  trackMenuEvent,
  type PublicMenuAnalyticsContext,
} from "@/lib/analytics/client";
import {
  createModelTelemetry,
  type ArObservedOutcome,
  type ModelInteraction,
} from "./modelTelemetry";

export function useModelTelemetry({
  context,
  dishSlug,
  categorySlug,
  attempt,
  modelSource,
  hasModel,
  loaded,
  failure,
}: {
  context?: PublicMenuAnalyticsContext;
  dishSlug: string;
  categorySlug: string;
  attempt: number;
  modelSource: string | undefined;
  hasModel: boolean;
  loaded: boolean;
  failure: "timeout" | "load-failed" | null;
}) {
  const controller = useRef<ReturnType<typeof createModelTelemetry> | null>(
    null,
  );
  const node = useRef<HTMLElement | null>(null);
  const disposeNode = useRef<(() => void) | null>(null);
  const contextRef = useRef(context);
  useEffect(() => {
    contextRef.current = context;
  }, [context]);
  const arTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connect = useCallback(() => {
    disposeNode.current?.();
    disposeNode.current = null;
    const element = node.current;
    if (!element) return;
    let inView = false,
      pointer: { id: number; x: number; y: number; pan: boolean } | null = null;
    const sync = () =>
      controller.current?.visibility(
        inView &&
          !element.closest('[aria-hidden="true"], [inert], [hidden]') &&
          document.visibilityState === "visible" &&
          document.hasFocus(),
      );
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              inView = Boolean(
                entries[0]?.isIntersecting &&
                entries[0].intersectionRatio >= 0.5,
              );
              sync();
            },
            { threshold: [0, 0.5] },
          )
        : null;
    observer?.observe(element);
    const hiddenObserver = new MutationObserver(sync);
    for (
      let ancestor: HTMLElement | null = element;
      ancestor;
      ancestor = ancestor.parentElement
    ) {
      hiddenObserver.observe(ancestor, {
        attributes: true,
        attributeFilter: ["aria-hidden", "inert", "hidden"],
      });
    }
    if (!observer) {
      const rect = element.getBoundingClientRect();
      inView = rect.bottom > 0 && rect.top < innerHeight;
      sync();
    }
    const interact = (kind: ModelInteraction) => {
      sync();
      controller.current?.interact(kind);
    };
    const down = (event: PointerEvent) => {
      pointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        pan: event.shiftKey,
      };
    };
    const move = (event: PointerEvent) => {
      if (
        pointer?.id === event.pointerId &&
        Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 5
      )
        interact(pointer.pan ? "pan" : "rotate");
    };
    const up = () => {
      pointer = null;
    };
    const wheel = () => interact("zoom");
    const key = (event: KeyboardEvent) => {
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      )
        interact(event.shiftKey ? "pan" : "rotate");
      if (["+", "-", "="].includes(event.key)) interact("zoom");
    };
    const hide = () => {
      sync();
      controller.current?.flush();
    };
    const pageHide = () => {
      controller.current?.visibility(false);
      controller.current?.flush();
    };
    element.addEventListener("pointerdown", down, { passive: true });
    element.addEventListener("pointermove", move, { passive: true });
    element.addEventListener("pointerup", up, { passive: true });
    element.addEventListener("pointercancel", up, { passive: true });
    element.addEventListener("wheel", wheel, { passive: true });
    element.addEventListener("keydown", key);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("focus", sync);
    window.addEventListener("blur", hide);
    window.addEventListener("pagehide", pageHide);
    window.addEventListener("pageshow", sync);
    // At most one duration delta each 30s; idle/hidden periods never contribute.
    const timer = setInterval(() => {
      sync();
      controller.current?.flush();
    }, 30000);
    disposeNode.current = () => {
      observer?.disconnect();
      hiddenObserver.disconnect();
      clearInterval(timer);
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
      element.removeEventListener("wheel", wheel);
      element.removeEventListener("keydown", key);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("focus", sync);
      window.removeEventListener("blur", hide);
      window.removeEventListener("pagehide", pageHide);
      window.removeEventListener("pageshow", sync);
    };
  }, []);
  const bindNode = useCallback(
    (element: HTMLElement | null) => {
      controller.current?.visibility(false);
      controller.current?.flush();
      node.current = element;
      connect();
    },
    [connect],
  );
  useEffect(() => {
    const modelAttemptId = crypto.randomUUID();
    const current = createModelTelemetry({
      now: () => performance.now(),
      emit: (event) => {
        if (
          event.eventName !== "model_active_duration" &&
          node.current?.closest('[aria-hidden="true"], [inert], [hidden]')
        )
          return;
        trackMenuEvent({
          ...contextRef.current,
          ...event,
          metadata: { ...event.metadata, modelAttemptId },
          dishSlug,
          categorySlug,
        });
      },
    });
    controller.current = current;
    if (hasModel) current.start();
    connect();
    return () => {
      disposeNode.current?.();
      disposeNode.current = null;
      current.dispose();
      if (controller.current === current) controller.current = null;
      if (arTimer.current) clearTimeout(arTimer.current);
    };
  }, [
    attempt,
    modelSource,
    hasModel,
    dishSlug,
    categorySlug,
    context?.restaurantId,
    context?.menuId,
    context?.source,
    connect,
  ]);
  useEffect(() => {
    if (loaded) controller.current?.loaded();
    else if (failure) controller.current?.failed(failure);
  }, [loaded, failure, attempt]);
  const arIntent = useCallback(() => {
    controller.current?.arIntent();
    if (arTimer.current) clearTimeout(arTimer.current);
    arTimer.current = setTimeout(
      () => controller.current?.arOutcome("unknown"),
      10000,
    );
  }, []);
  const arOutcome = useCallback((outcome: ArObservedOutcome) => {
    if (arTimer.current) clearTimeout(arTimer.current);
    controller.current?.arOutcome(outcome);
  }, []);
  return { bindNode, arIntent, arOutcome };
}
