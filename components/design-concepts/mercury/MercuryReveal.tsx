"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import shared from "./shared.module.css";

function getPrefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(getPrefersReducedMotion);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

function supportsIntersectionObserver(): boolean {
  return typeof IntersectionObserver !== "undefined";
}

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Stagger delay in ms (80-120ms between siblings). */
  delay?: number;
};

/**
 * Mercury scroll reveal: starts opacity 0 + translateY(50px),
 * IntersectionObserver (~18% threshold) triggers once -> visible
 * over 700ms cubic-bezier(0,0,.2,1). Never replays.
 */
export function Reveal({ children, className = "", delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => !supportsIntersectionObserver());

  useEffect(() => {
    const el = ref.current;
    if (!el || !supportsIntersectionObserver()) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${shared.reveal} ${visible ? shared.revealVisible : ""} ${className}`}
      style={delay > 0 ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

type InViewProps = {
  children: ReactNode;
  className?: string;
  /** Class applied (from the caller's own CSS module) once in view. */
  visibleClass?: string;
  threshold?: number;
};

/** Adds `visibleClass` once the wrapper enters the viewport. Never replays. */
export function InView({
  children,
  className = "",
  visibleClass = "",
  threshold = 0.25
}: InViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(() => !supportsIntersectionObserver());

  useEffect(() => {
    const el = ref.current;
    if (!el || !supportsIntersectionObserver()) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div ref={ref} className={`${className} ${inView ? visibleClass : ""}`}>
      {children}
    </div>
  );
}
