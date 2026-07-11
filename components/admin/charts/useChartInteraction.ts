"use client";

import { useEffect, useReducer, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
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

export function useChartInteraction(count: number, columns = 1) {
  const [state, dispatch] = useReducer(interactionReducer, { active: null, pinned: false });
  const rootRef = useRef<HTMLDivElement>(null);
  const suppressNextKeyboardClick = useRef(false);
  const suppressionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const suppressSyntheticKeyboardClick = (event: MouseEvent) => {
      // Enter/Space is handled by onKeyDown. Browsers may subsequently emit a
      // detail=0 click for that focused SVG mark, which would otherwise toggle
      // twice. Ordinary programmatic/assistive clicks remain untouched.
      if (!suppressNextKeyboardClick.current || event.detail !== 0 || event.target !== document.activeElement) return;
      suppressNextKeyboardClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    };
    root.addEventListener("click", suppressSyntheticKeyboardClick, true);
    return () => {
      root.removeEventListener("click", suppressSyntheticKeyboardClick, true);
      if (suppressionTimer.current) clearTimeout(suppressionTimer.current);
    };
  }, []);
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
    if (event.key === "Tab") { dispatch({ type: "key", key: event.key, count, columns }); return; }
    if (!controlled.includes(event.key)) return;
    event.preventDefault();
    if ((event.key === "Enter" || event.key === " ") && state.active !== null) {
      suppressNextKeyboardClick.current = true;
      if (suppressionTimer.current) clearTimeout(suppressionTimer.current);
      suppressionTimer.current = setTimeout(() => { suppressNextKeyboardClick.current = false; }, 0);
    }
    dispatch({ type: "key", key: event.key, count, columns });
  };
  const onBlur = (event: FocusEvent<SVGElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) dispatch({ type: "blur" });
  };
  return { ...state, rootRef, send, onKeyDown, onBlur };
}
