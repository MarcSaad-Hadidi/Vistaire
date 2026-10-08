"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import styles from "./MercuryHero.module.css";

/**
 * Full-bleed hero. The legal pill at the bottom is scroll-scrubbed:
 * translateY 0 -> 120% (+ fade) across the hero's 50% -> 100% scroll range.
 */
export function MercuryHero() {
  const heroRef = useRef<HTMLElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    const hero = heroRef.current;
    const pill = pillRef.current;
    if (!hero || !pill) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = hero.getBoundingClientRect();
        const total = r.height;
        const scrolled = Math.min(Math.max(-r.top, 0), total);
        const p = Math.min(Math.max((scrolled - total * 0.5) / (total * 0.5), 0), 1);
        pill.style.transform = `translateY(${(p * 120).toFixed(2)}%)`;
        pill.style.opacity = String(1 - p);
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
  }, []);

  return (
    <section ref={heroRef} className={styles.hero} data-mtheme="dark" aria-label="Introduction">
      <div className={styles.bg} aria-hidden="true">
        <Image
          src="/images/landing/sauge-noire-experience.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover" }}
        />
        <div className={styles.scrim} />
      </div>

      <div className={styles.content}>
        <h1 className={styles.title}>
          Donnez envie avant la première bouchée.
        </h1>
        <p className={styles.sub}>
          Vistaire transforme votre QR code en une carte mobile claire,
          visuelle et fidèle à l’identité de votre restaurant.
        </p>

        <form
          className={styles.emailRow}
          onSubmit={(e) => {
            e.preventDefault();
            router.push("/prendre-rendez-vous");
          }}
        >
          <div className={styles.emailPill}>
            <label htmlFor="mercury-email" className={styles.srOnly}>
              Votre courriel
            </label>
            <input
              id="mercury-email"
              type="email"
              required
              placeholder="Votre courriel"
              className={styles.emailInput}
            />
            <button type="submit" className={styles.emailBtn}>
              Prendre rendez-vous
            </button>
          </div>
          <Link href="/demo" className={styles.ghostBtn}>
            Voir la démo
          </Link>
        </form>
      </div>

      <div ref={pillRef} className={styles.disclaimer} aria-hidden="true">
        Vistaire conçoit des cartes digitales premium pour restaurants — la
        démo se fait sur rendez-vous.
      </div>
    </section>
  );
}
