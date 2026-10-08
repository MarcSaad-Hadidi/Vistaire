"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { LANDING_COPY } from "@/lib/landing/landingCopy";
import shared from "./shared.module.css";
import styles from "./MercuryHero.module.css";
import { Reveal, usePrefersReducedMotion } from "./MercuryReveal";

const copy = LANDING_COPY.fr;

/**
 * Hero: full-bleed warm dish photo, giant serif title, CTA row, and the
 * signature scroll-scrubbed disclaimer pill pinned at the hero bottom.
 * As the user scrolls through the hero (50% -> 100%), the pill translates
 * down 0 -> 100% following scroll 1:1 (linear, reversible) and its divider
 * fades 1 -> 0. CSS animation-timeline when supported, rAF fallback otherwise.
 */
export function MercuryHero() {
  const heroRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    if (CSS.supports("animation-timeline: scroll()")) return; // CSS path handles it
    const hero = heroRef.current;
    const pill = pillRef.current;
    if (!hero || !pill) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = hero.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / rect.height));
      const t = Math.min(1, Math.max(0, (progress - 0.5) / 0.5));
      pill.style.transform = `translateX(-50%) translateY(${(t * 100).toFixed(2)}%)`;
      if (dividerRef.current) {
        dividerRef.current.style.opacity = String(1 - t);
      }
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
  }, [reduced]);

  return (
    <section
      ref={heroRef}
      data-mercury-theme="dark"
      className={styles.hero}
      aria-labelledby="mercury-hero-title"
    >
      <div className={styles.media} aria-hidden="true">
        <Image
          src="/images/demo/dishes/canette-rotie-figues-epices.png"
          alt=""
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover" }}
        />
      </div>
      <div className={styles.shade} aria-hidden="true" />
      <div className={shared.grain} aria-hidden="true" />

      <div className={styles.content}>
        <Reveal>
          <p className={`${shared.eyebrow} ${styles.eyebrow}`}>
            {copy.hero.eyebrow}
          </p>
        </Reveal>
        <Reveal delay={100}>
          <h1
            id="mercury-hero-title"
            className={`${shared.serif} ${styles.title}`}
          >
            {copy.hero.title}
          </h1>
        </Reveal>
        <Reveal delay={200}>
          <p className={styles.body}>{copy.hero.body}</p>
        </Reveal>
        <Reveal delay={300}>
          <div className={styles.actions}>
            <Link
              className={shared.btnPrimary}
              href="/prendre-rendez-vous"
            >
              {copy.finalCta.cta}
            </Link>
            <Link className={shared.btnGhost} href="/demo">
              {copy.hero.secondaryCta}
            </Link>
          </div>
        </Reveal>
      </div>

      <div ref={pillRef} className={styles.pill} aria-hidden="true">
        <span className={styles.pillText}>Page concept</span>
        <span ref={dividerRef} className={styles.pillDivider} />
        <span className={styles.pillText}>Contenu illustratif</span>
      </div>
    </section>
  );
}
