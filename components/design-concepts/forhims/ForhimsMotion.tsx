"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import shared from "./shared.module.css";

/** Scroll progress (0..1) of a tall wrapper, for scrubbed pinned sequences. Reversible. */
export function useScrubProgress(ref: RefObject<HTMLElement | null>): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const prog = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
      setP(prog);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ref]);
  return p;
}

/** Fade+rise reveal, once, on intersection. */
export function Reveal({
  children,
  className,
  delay = 0
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(48px)",
        transition: `opacity 0.7s cubic-bezier(0,0,.2,1) ${delay}ms, transform 0.7s cubic-bezier(0,0,.2,1) ${delay}ms`
      }}
    >
      {children}
    </div>
  );
}

function StatusIcons({ dark }: { dark?: boolean }) {
  const c = dark ? "#fff" : "#101418";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }} aria-hidden="true">
      <svg width="16" height="11" viewBox="0 0 16 11" fill={c}>
        <rect x="0" y="7" width="3" height="4" rx="1" />
        <rect x="4.5" y="5" width="3" height="6" rx="1" />
        <rect x="9" y="2.5" width="3" height="8.5" rx="1" />
        <rect x="13" y="0" width="3" height="11" rx="1" />
      </svg>
      <svg width="15" height="11" viewBox="0 0 16 12" fill="none" stroke={c} strokeWidth="1.6">
        <path d="M1.5 4.5a10 10 0 0 1 13 0M4 7.2a6.4 6.4 0 0 1 8 0M6.6 9.7a2.8 2.8 0 0 1 2.8 0" strokeLinecap="round" />
        <circle cx="8" cy="11" r="1" fill={c} stroke="none" />
      </svg>
      <svg width="22" height="11" viewBox="0 0 24 12" fill="none">
        <rect x="0.8" y="0.8" width="19" height="10.4" rx="3" stroke={c} strokeWidth="1.4" opacity="0.5" />
        <rect x="2.8" y="2.8" width="13" height="6.4" rx="1.8" fill={c} />
        <rect x="21" y="4" width="2.2" height="4" rx="1.1" fill={c} opacity="0.5" />
      </svg>
    </span>
  );
}

/** CSS-built iPhone frame with status bar + notch. */
export function PhoneFrame({
  children,
  dark = false,
  className,
  screenClassName
}: {
  children: ReactNode;
  dark?: boolean;
  className?: string;
  screenClassName?: string;
}) {
  return (
    <div className={`${shared.phone} ${className ?? ""}`} role="img" aria-label="Aperçu de la carte Vistaire sur mobile">
      <div className={`${shared.screen} ${screenClassName ?? ""}`}>
        <div className={shared.notch} />
        <div className={`${shared.statusbar} ${dark ? shared.statusbarDark : ""}`}>
          <span>9:41</span>
          <StatusIcons dark={dark} />
        </div>
        {children}
      </div>
    </div>
  );
}
