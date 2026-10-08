"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import shared from "./shared.module.css";
import styles from "./TigerMotion.module.css";

/* ------------------------------------------------------------------ */
/* useScrub: 1:1 scroll-scrubbed progress (0..1) over a tall wrapper,   */
/* reversible, rAF-driven, transform/opacity only.                      */
/* ------------------------------------------------------------------ */
export function useScrub(wrapRef: React.RefObject<HTMLDivElement | null>) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let raf = 0;
    let current = 0;
    let target = 0;
    const measure = () => {
      const rect = wrap.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      target = total <= 0 ? 0 : Math.min(1, Math.max(0, -rect.top / total));
    };
    const tick = () => {
      // slight lerp smoothing like the reference's render settle
      current += (target - current) * 0.16;
      if (Math.abs(target - current) < 0.0005) current = target;
      setProgress(current);
      raf = requestAnimationFrame(tick);
    };
    measure();
    raf = requestAnimationFrame(tick);
    const onScroll = () => measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [wrapRef]);
  return progress;
}

/* ------------------------------------------------------------------ */
/* Reveal: IntersectionObserver adds the visible class once.           */
/* ------------------------------------------------------------------ */
export function Reveal({
  children,
  className = "",
  rotate = "0deg",
  delay = 0,
  as: Tag = "div"
}: {
  children: ReactNode;
  className?: string;
  rotate?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "span" | "article";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === "undefined"
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={`${styles.reveal} ${visible ? styles.revealVisible : ""} ${className}`}
      style={{ "--reveal-rotate": rotate, transitionDelay: `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* WordReveal: words light up progressively with scroll (scrub 1:1,    */
/* reversible). EXACT reference behavior: color + opacity only,        */
/* ~1 word per 225px of scroll, no transform.                          */
/* ------------------------------------------------------------------ */
export function WordReveal({
  text,
  className = "",
  dimClassName,
  litClassName,
  as: Tag = "h2"
}: {
  text: string;
  className?: string;
  dimClassName: string;
  litClassName: string;
  as?: "h1" | "h2" | "h3" | "p";
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [progress, setProgress] = useState(0);
  const words = text.split(" ");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        // ~1 word per 225px of scroll travel
        const travel = words.length * 225;
        const start = vh * 0.95;
        const p = Math.min(1, Math.max(0, (start - rect.top) / travel));
        setProgress(p);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      cancelAnimationFrame(raf);
    };
  }, [words.length]);

  return (
    <Tag ref={ref as never} className={className} aria-label={text}>
      {words.map((word, i) => {
        const lit = (i + 1) / words.length <= progress + 0.001;
        return (
          <span key={i} aria-hidden="true" className={`${dimClassName} ${lit ? litClassName : ""}`}>
            {word}
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* Sticker: fly-in once on in-view (time-based, NOT scrubbed).         */
/* EXACT: from {scale .5, rotation ±30° beyond final, y 60} →          */
/* {scale 1, rotation final, y 0}, back-out(1.4), 0.6s, stagger 0.1s.  */
/* ------------------------------------------------------------------ */
export function Sticker({
  children,
  className = "",
  tilt = "-15deg",
  delay = 0
}: {
  children: ReactNode;
  className?: string;
  tilt?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === "undefined"
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <span
      ref={ref}
      className={`${shared.sticker} ${styles.stickerPop} ${visible ? styles.stickerPopVisible : ""} ${className}`}
      style={{ "--sticker-tilt": tilt, transitionDelay: `${delay}ms` } as CSSProperties}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Parallax: image drifts at 0.85-0.9x of text speed (subtle).         */
/* ------------------------------------------------------------------ */
export function Parallax({
  src,
  alt,
  className = "",
  imgClassName = "",
  factor = 0.88,
  sizes = "100vw"
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  factor?: number;
  sizes?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const img = imgRef.current;
    if (!wrap || !img) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = wrap.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        const centerOffset = rect.top + rect.height / 2 - vh / 2;
        const drift = centerOffset * (1 - factor);
        img.style.transform = `translateY(${drift.toFixed(1)}px) scale(1.1)`;
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      cancelAnimationFrame(raf);
    };
  }, [factor]);

  return (
    <div ref={wrapRef} className={className} aria-hidden={alt === ""}>
      <div ref={imgRef} className={imgClassName}>
        <Image src={src} alt={alt} fill sizes={sizes} style={{ objectFit: "cover" }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Marquee: slow infinite band, content duplicated 2x, -50% loop.      */
/* ------------------------------------------------------------------ */
export function Marquee({
  children,
  className = "",
  duration = "38s"
}: {
  children: ReactNode;
  className?: string;
  duration?: string;
}) {
  return (
    <div className={`${shared.marquee} ${className}`} aria-hidden="true">
      <div className={shared.marqueeTrack} style={{ animationDuration: duration }}>
        <div className={styles.marqueeHalf}>{children}</div>
        <div className={styles.marqueeHalf}>{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FloatingActions: fixed circular buttons appearing after scrolling.  */
/* ------------------------------------------------------------------ */
export function FloatingActions() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 320);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`${styles.floating} ${show ? styles.floatingShow : ""}`} aria-hidden={!show}>
      <a href="#experiences" className={styles.circle} title="Voir les expériences" tabIndex={show ? 0 : -1}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <path d="M8 12h8M12 8v8" strokeLinecap="round" />
        </svg>
      </a>
      <Link href="/prendre-rendez-vous" className={styles.circle} title="Prendre rendez-vous" tabIndex={show ? 0 : -1}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" />
        </svg>
      </Link>
    </div>
  );
}
