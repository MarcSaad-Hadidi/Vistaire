"use client";

import { useEffect, useRef } from "react";

/**
 * Scroll-scrub hook for pinned sections.
 * Calls `onProgress` every animation frame with a lerped 0→1 progress
 * while the tall section scrolls through the viewport. Pure scrub:
 * no easing, fully reversible. Writes go through refs (no re-renders).
 */
export function useScrub(
  onProgress: (progress: number) => void,
  lerp = 0.14
): React.RefObject<HTMLElement | null> {
  const sectionRef = useRef<HTMLElement | null>(null);
  const cbRef = useRef(onProgress);

  useEffect(() => {
    cbRef.current = onProgress;
  });
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const section = sectionRef.current;
    if (!section) return;

    let raf = 0;
    let current = 0;
    let running = false;

    const tick = () => {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const total = Math.max(1, rect.height - vh);
      const raw = Math.min(1, Math.max(0, -rect.top / total));
      if (reduced.current) {
        cbRef.current(0.5);
        running = false;
        return;
      }
      current += (raw - current) * lerp;
      if (Math.abs(raw - current) < 0.0005) current = raw;
      cbRef.current(current);
      const inRange = rect.top < vh && rect.bottom > 0;
      if (inRange) {
        raf = requestAnimationFrame(tick);
      } else {
        running = false;
      }
    };

    const kick = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };

    kick();
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
    };
  }, [lerp]);

  return sectionRef;
}
