"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./DroppyNavbar.module.css";

const LINKS = [
  { href: "#fiches", label: "Fiches" },
  { href: "#visuels", label: "Visuels" },
  { href: "#outils", label: "Outils" },
  { href: "#tarifs", label: "Tarifs" },
  { href: "#faq", label: "FAQ" }
];

/**
 * Floating glass pill nav. White frosted over blue/black sections,
 * deep-navy frosted over light sections (theme inversion on scroll).
 */
export function DroppyNavbar() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll('[data-nav-dark="true"]'));
    if (!sections.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setDark(true);
        }
        const anyDark = entries.some((e) => e.isIntersecting);
        if (!anyDark) {
          // re-evaluate: dark if any dark section currently visible
          const visible = sections.some((s) => {
            const r = s.getBoundingClientRect();
            return r.top < 120 && r.bottom > 120;
          });
          setDark(visible);
        }
      },
      { rootMargin: "-60px 0px -80% 0px" }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  return (
    <header className={styles.header}>
      <nav
        className={`${styles.pill} ${dark ? styles.pillDark : styles.pillLight}`}
        aria-label="Navigation principale"
      >
        <Link href="#top" className={styles.brand} aria-label="Vistaire — haut de page">
          <span className={styles.mark} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 2C12 2 5 10.2 5 15a7 7 0 0 0 14 0C19 10.2 12 2 12 2Z" />
              <circle cx="9.4" cy="14.6" r="1.7" fill="#fff" opacity="0.9" />
              <circle cx="14.6" cy="14.6" r="1.7" fill="#fff" opacity="0.9" />
            </svg>
          </span>
          <span className={styles.brandName}>Vistaire</span>
        </Link>
        <div className={styles.links}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={styles.link}>
              {l.label}
            </Link>
          ))}
        </div>
        <Link href="/prendre-rendez-vous" className={styles.cta}>
          Prendre rendez-vous
        </Link>
      </nav>
    </header>
  );
}
