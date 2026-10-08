"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import shared from "./shared.module.css";

/** Fade+rise scroll reveal, once. */
export function DroppyReveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
  style
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "h2" | "p" | "li" | "span";
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`${shared.reveal} ${visible ? shared.revealVisible : ""} ${className}`}
      style={{ ...(delay > 0 ? { transitionDelay: `${delay}ms` } : {}), ...style }}
    >
      {children}
    </Tag>
  );
}

const reduceMotion =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Word-by-word scroll illumination: words brighten as the block
 * travels through the viewport, scrub-linked and reversible.
 */
export function DroppyWordReveal({
  text,
  sub,
  className = ""
}: {
  text: string;
  sub?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const words = text.split(" ");

  useEffect(() => {
    const el = ref.current;
    if (!el || reduceMotion) return;
    const spans = Array.from(el.querySelectorAll<HTMLElement>("[data-w]"));
    const subEl = el.querySelector<HTMLElement>("[data-sub]");
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // progress: 0 when block enters, 1 when its center passes viewport center
      const start = vh * 0.92;
      const end = vh * 0.42;
      const p = Math.min(1, Math.max(0, (start - rect.top) / (start - end)));
      const lit = Math.floor(p * (spans.length + 1));
      spans.forEach((s, i) => s.classList.toggle(shared.lit, i < lit));
      if (subEl) subEl.classList.toggle(shared.lit, p > 0.96);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      <p className={shared.wordReveal} aria-label={text}>
        {words.map((w, i) => (
          <span key={i}>
            <span data-w className={shared.w}>
              {w}
            </span>
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </p>
      {sub ? (
        <p data-sub className={shared.wordRevealSub}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

/** Seamless infinite marquee: 2x duplicated track, translateX(-50%). */
export function DroppyMarquee({
  children,
  className = "",
  duration = "32s",
  label
}: {
  children: ReactNode;
  className?: string;
  duration?: string;
  label?: string;
}) {
  return (
    <div
      className={className}
      aria-label={label}
      style={{ overflow: "hidden", width: "100%" }}
    >
      <div
        style={{
          display: "flex",
          width: "max-content",
          animation: `droppy-marquee ${duration} linear infinite`
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>{children}</div>
        <div style={{ display: "flex", alignItems: "center" }} aria-hidden="true">
          {children}
        </div>
      </div>
      <style>{`@keyframes droppy-marquee { to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) { [style*="droppy-marquee"] { animation: none !important; } }`}</style>
    </div>
  );
}

/** Gentle float loop (used for floating pills/cards). */
export function DroppyFloat({
  children,
  className = "",
  style,
  paused = false
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  paused?: boolean;
}) {
  return (
    <div
      className={className}
      style={{
        ...style,
        animation: "droppy-float 5.5s ease-in-out infinite",
        animationPlayState: paused ? "paused" : "running"
      }}
    >
      {children}
      <style>{`@keyframes droppy-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`}</style>
    </div>
  );
}
