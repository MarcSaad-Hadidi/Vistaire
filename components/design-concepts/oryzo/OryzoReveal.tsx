"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import styles from "./OryzoReveal.module.css";

type OryzoRevealProps = {
  children: ReactNode;
  className?: string;
  /** Optional extra delay (ms) for staggered reveals. */
  delay?: number;
};

/**
 * Reveal-on-scroll wrapper for the Oryzo concept.
 * Adds `.visible` once the element enters the viewport (IntersectionObserver).
 * Pure CSS transitions — no animation library.
 */
export function OryzoReveal({
  children,
  className,
  delay = 0
}: OryzoRevealProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  // No IntersectionObserver (very old browser / SSR edge): visible immediately.
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === "undefined"
  );

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${styles.reveal} ${visible ? styles.visible : ""} ${
        className ?? ""
      }`}
      style={delay > 0 ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
