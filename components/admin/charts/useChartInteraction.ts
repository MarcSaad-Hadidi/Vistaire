"use client";

import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { interactionReducer, type InteractionAction } from "./interaction";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function useChartInteraction(count: number) {
  const [state, dispatch] = useReducer(interactionReducer, { active: null, pinned: false });
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!state.pinned) return;
    const outside = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) dispatch({ type: "outside" }); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [state.pinned]);
  useEffect(() => {
    if (state.active === null || !rootRef.current?.contains(document.activeElement)) return;
    rootRef.current.querySelectorAll<SVGElement>("[tabindex]")[state.active]?.focus();
  }, [state.active]);
  const send = (action: InteractionAction) => dispatch(action);
  const onKeyDown = (event: KeyboardEvent<SVGElement>) => {
    const controlled = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Enter", " ", "Escape"];
    if (!controlled.includes(event.key)) return;
    event.preventDefault(); dispatch({ type: "key", key: event.key, count });
  };
  return { ...state, rootRef, send, onKeyDown };
}
