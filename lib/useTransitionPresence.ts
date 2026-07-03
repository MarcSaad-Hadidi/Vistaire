"use client";

import { useEffect, useState } from "react";

export type TransitionPresenceState = "open" | "closing" | "closed";

type TransitionPresenceOptions = {
  /** Duration, in ms, the closing content stays mounted so the exit animation can play. */
  durationMs?: number;
  /** When true (e.g. prefers-reduced-motion), the content unmounts instantly with no closing phase. */
  disabled?: boolean;
};

type TransitionPresenceResult<T> = {
  /** The value to render. Holds the last active value during the closing phase, then null. */
  value: T | null;
  /** Lifecycle phase, meant to be exposed as a `data-*` attribute for CSS to drive enter/exit. */
  state: TransitionPresenceState;
  /** Convenience flag: true while the content should stay mounted. */
  isMounted: boolean;
};

/**
 * Keeps conditionally-rendered content mounted long enough for a CSS exit animation to run.
 *
 * When `active` becomes null the content is kept mounted with `state === "closing"` for
 * `durationMs`, then fully unmounts (`state === "closed"`, `value === null`). Reduced-motion
 * callers pass `disabled: true` to unmount immediately without any closing phase.
 *
 * This is intentionally tiny and dependency-free: at most one timer per instance, cleaned up.
 */
export function useTransitionPresence<T>(
  active: T | null,
  { durationMs = 220, disabled = false }: TransitionPresenceOptions = {}
): TransitionPresenceResult<T> {
  const [rendered, setRendered] = useState<T | null>(active);
  const [state, setState] = useState<TransitionPresenceState>(
    active != null ? "open" : "closed"
  );
  const [prevActive, setPrevActive] = useState<T | null>(active);

  // Adjust state during render when `active` changes (React's "storing information from
  // previous renders" pattern), so the common open/reopen path never schedules a cascading
  // effect. Only the closing -> closed step is deferred, from an async timer in the effect below.
  if (active !== prevActive) {
    setPrevActive(active);
    if (active != null) {
      setRendered(active);
      setState("open");
    } else if (disabled || durationMs <= 0) {
      setRendered(null);
      setState("closed");
    } else {
      // Keep the last rendered content mounted, but mark it closing so CSS can animate it out.
      setState((current) => (current === "closed" ? "closed" : "closing"));
    }
  }

  useEffect(() => {
    if (state !== "closing") return;
    const timeoutId = window.setTimeout(() => {
      setRendered(null);
      setState("closed");
    }, durationMs);
    return () => window.clearTimeout(timeoutId);
  }, [state, durationMs]);

  return { value: rendered, state, isMounted: state !== "closed" };
}
