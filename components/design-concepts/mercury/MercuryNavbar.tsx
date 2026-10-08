"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./MercuryNavbar.module.css";

const EXPERIENCES = [
  { label: "Sauge Noire", href: "/demo" },
  { label: "Maison Élysée", href: "/demo" },
  { label: "Voir la démo", href: "/demo" }
];

/**
 * Announcement bar + sticky nav. Theme inverts (dark <-> light) depending on
 * the themed section under the nav line — 300ms ease-out color transitions.
 */
export function MercuryNavbar() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [dropOpen, setDropOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const sections = Array.from(
        document.querySelectorAll<HTMLElement>("[data-mtheme]")
      );
      const y = 40;
      let current: "dark" | "light" = "dark";
      for (const s of sections) {
        const r = s.getBoundingClientRect();
        if (r.top <= y) current = s.dataset.mtheme === "light" ? "light" : "dark";
      }
      setTheme(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDropOpen(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className={styles.announce}>
        <Link href="/demo" className={styles.announceLink}>
          <span aria-hidden="true" className={styles.announceStar}>
            ✳
          </span>
          Nouveau : la 3D/AR sélective Vistaire — l&apos;immersion pour vos
          plats signatures
          <span aria-hidden="true" className={styles.announceArrow}>
            {" →"}
          </span>
        </Link>
      </div>

      <header
        ref={navRef}
        className={`${styles.nav} ${theme === "light" ? styles.navLight : styles.navDark}`}
      >
        <div className={styles.navInner}>
          <Link href="/design-mercury" className={styles.logo} aria-label="Vistaire — accueil concept">
            <svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true">
              <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="2.4" />
              <circle cx="20" cy="20" r="10.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
              <circle cx="20" cy="20" r="4" fill="currentColor" />
            </svg>
            <span className={styles.wordmark}>VISTAIRE</span>
          </Link>

          <nav className={styles.links} aria-label="Navigation principale">
            <div className={styles.dropWrap}>
              <button
                type="button"
                className={styles.link}
                aria-expanded={dropOpen}
                aria-haspopup="true"
                onClick={() => setDropOpen((v) => !v)}
              >
                Expériences
                <svg
                  viewBox="0 0 12 12"
                  width="11"
                  height="11"
                  aria-hidden="true"
                  className={`${styles.chev} ${dropOpen ? styles.chevOpen : ""}`}
                >
                  <path
                    d="M2.5 4.5 6 8l3.5-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {dropOpen && (
                <div className={styles.drop} role="menu">
                  {EXPERIENCES.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={styles.dropItem}
                      role="menuitem"
                      onClick={() => setDropOpen(false)}
                    >
                      {item.label}
                      <span aria-hidden="true" className={styles.dropArrow}>
                        {" →"}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link href="/apercu-restaurateur" className={styles.link}>
              Restaurateurs
            </Link>
            <Link href="/contact" className={styles.link}>
              Contact
            </Link>
          </nav>

          <div className={styles.actions}>
            <Link href="/sign-in" className={styles.login}>
              Se connecter
            </Link>
            <Link href="/prendre-rendez-vous" className={styles.cta}>
              Prendre rendez-vous
            </Link>
            <button
              type="button"
              className={styles.burger}
              aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className={styles.mobileMenu} role="dialog" aria-label="Menu">
          <Link href="/demo" onClick={() => setMobileOpen(false)}>
            Expériences
          </Link>
          <Link href="/apercu-restaurateur" onClick={() => setMobileOpen(false)}>
            Restaurateurs
          </Link>
          <Link href="/contact" onClick={() => setMobileOpen(false)}>
            Contact
          </Link>
          <Link href="/sign-in" onClick={() => setMobileOpen(false)}>
            Se connecter
          </Link>
          <Link
            href="/prendre-rendez-vous"
            className={styles.mobileCta}
            onClick={() => setMobileOpen(false)}
          >
            Prendre rendez-vous
          </Link>
        </div>
      )}
    </>
  );
}
