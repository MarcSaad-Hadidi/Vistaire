import { useEffect, useRef } from "react";

type ScrubCallback<T extends HTMLElement> = (
  progress: number,
  section: T
) => void;

/**
 * Pinned-section scroll scrubbing (oryzo.ai motion language).
 *
 * Measures a tall section (e.g. 300vh) that contains a sticky 100vh stage and
 * invokes `onScrub` on every animation frame with a smoothed 0..1 progress:
 * - Pure scrub: no easing curve, fully reversible (scrolling up rewinds).
 * - Slight lerp smoothing (0.14/frame ≈ 1s settle) for a buttery feel without
 *   breaking the 1:1 scroll-driven character.
 * - The callback writes transforms directly to DOM nodes (via refs) — no
 *   React state updates per frame, transform/opacity only (GPU-friendly).
 * - prefers-reduced-motion: sets `data-scrub-reduced` on the section and skips
 *   the loop; CSS forces a static, fully-visible state.
 */
export function useScrub<T extends HTMLElement>(onScrub: ScrubCallback<T>) {
  const sectionRef = useRef<T | null>(null);
  const callbackRef = useRef(onScrub);

  // Keep the latest callback without re-subscribing the rAF loop.
  useEffect(() => {
    callbackRef.current = onScrub;
  });

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      section.setAttribute("data-scrub-reduced", "true");
      return;
    }
    let raf = 0;
    let current = -1; // -1 = snap to target on the first frame (no travel)
    const tick = () => {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const total = rect.height - vh;
      const target =
        total > 0 ? Math.min(1, Math.max(0, (vh - rect.top) / total)) : 1;
      current = current < 0 ? target : current + (target - current) * 0.14;
      if (Math.abs(target - current) < 0.0004) current = target;
      callbackRef.current(current, section);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return sectionRef;
}
