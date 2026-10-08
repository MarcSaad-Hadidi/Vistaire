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
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
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
      className={`${shared.reveal} ${visible ? shared.revealVisible : ""} ${className}`}
      style={{ "--reveal-rotate": rotate, transitionDelay: `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* WordReveal: signature word-by-word title illumination, copied from  */
/* the reference: ONLY color + opacity animate (no transform),        */
/* scrubbed 1:1 with scroll (reversible) at ~1 word per 225px.        */
/* ------------------------------------------------------------------ */
const WORD_SCROLL_PX = 225;

export function WordReveal({
  text,
  className = "",
  dimClassName,
  litClassName
}: {
  text: string;
  className?: string;
  dimClassName: string;
  litClassName: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [progress, setProgress] = useState(0);
  const words = text.split(" ");
  const wordCount = words.length;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        // p = 0 when the title top reaches the viewport bottom;
        // each word lights after WORD_SCROLL_PX more px of scroll.
        const total = Math.max(1, wordCount) * WORD_SCROLL_PX;
        const p = Math.min(1, Math.max(0, (vh - rect.top) / total));
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
  }, [wordCount]);

  return (
    <h2 ref={ref} className={className} aria-label={text}>
      {words.map((word, i) => {
        const lit = i / wordCount < progress;
        return (
          <span key={i} aria-hidden="true" className={lit ? litClassName : dimClassName}>
            {word}
            {i < wordCount - 1 ? " " : ""}
          </span>
        );
      })}
    </h2>
  );
}

/* ------------------------------------------------------------------ */
/* Sticker: signature sticker fly-in, copied from the reference.       */
/* Enters ONCE on in-view (time-based, not scrubbed):                 */
/* from { scale: 0.5, rotation: 30deg beyond final tilt, y: 60px }    */
/* to   { scale: 1, rotation: final tilt, y: 0 }                      */
/* easing back-out(1.4), 0.6s, stagger via the delay prop. Stays.     */
/* ------------------------------------------------------------------ */
export function Sticker({
  children,
  className = "",
  tilt = "0deg",
  delay = 0
}: {
  children: ReactNode;
  className?: string;
  tilt?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
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

  const final = parseFloat(tilt) || 0;
  const from = final + (final < 0 ? -30 : 30);

  return (
    <span
      ref={ref}
      className={`${styles.stickerPop} ${visible ? styles.stickerPopVisible : ""} ${className}`}
      style={
        {
          "--sticker-tilt": tilt,
          "--sticker-from": `${from}deg`,
          transitionDelay: `${delay}ms`
        } as CSSProperties
      }
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Parallax: image translates at a different speed than the scroll.    */
/* ------------------------------------------------------------------ */
export function Parallax({
  src,
  alt,
  className = "",
  imgClassName = "",
  speed = 0.12,
  sizes = "100vw"
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  speed?: number;
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
        img.style.transform = `translateY(${(-centerOffset * speed).toFixed(1)}px) scale(1.1)`;
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
  }, [speed]);

  return (
    <div ref={wrapRef} className={className} aria-hidden={alt === ""}>
      <div ref={imgRef} className={imgClassName}>
        <Image src={src} alt={alt} fill sizes={sizes} style={{ objectFit: "cover" }} />
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
      <a href="#experiences" className={styles.circle} title="Voir les expériences">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <path d="M14 14h3v3h-3z M21 14v.01 M14 21h.01 M18 18h.01" strokeLinecap="round" />
        </svg>
      </a>
      <Link href="/prendre-rendez-vous" className={styles.circle} title="Prendre rendez-vous">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" />
        </svg>
      </Link>
    </div>
  );
}
