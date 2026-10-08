"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import shared from "./shared.module.css";
import styles from "./MercuryNavbar.module.css";

const NAV_LINE = 72;

const EXPERIENCES = [
  {
    name: "Sauge Noire",
    description: "Gastronomique — carte immersive",
    href: "/demo"
  },
  {
    name: "Maison Élysée",
    description: "Bistronomique — carte visuelle",
    href: "/demo"
  },
  {
    name: "Toutes les expériences",
    description: "Découvrir la démo",
    href: "/demo"
  }
] as const;

/**
 * Sticky navbar with theme inversion: sections carry
 * data-mercury-theme="dark|light"; the theme of the section under the
 * navbar line drives a theme class, with 300ms ease-out color transitions.
 */
export function MercuryNavbar() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [menu, setMenu] = useState<"closed" | "open" | "closing">("closed");
  const closeTimer = useRef<number | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      let current: "dark" | "light" = "dark";
      document
        .querySelectorAll<HTMLElement>("[data-mercury-theme]")
        .forEach((section) => {
          if (section.getBoundingClientRect().top <= NAV_LINE) {
            const t = section.dataset.mercuryTheme;
            if (t === "dark" || t === "light") current = t;
          }
        });
      setTheme(current);
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

  const openMenu = useCallback(() => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setMenu("open");
  }, []);

  const closeMenu = useCallback(() => {
    setMenu((m) => (m === "open" ? "closing" : m));
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setMenu("closed"), 250);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    const onPointerDown = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, [closeMenu]);

  return (
    <header
      ref={navRef}
      className={`${styles.nav} ${theme === "light" ? styles.navLight : styles.navDark}`}
    >
      <nav className={styles.inner} aria-label="Navigation principale">
        <Link href="/demo" className={`${styles.logo} ${shared.serif}`}>
          Vistaire
        </Link>

        <div className={styles.links}>
          <div className={styles.dropdownWrap}>
            <button
              type="button"
              className={styles.link}
              aria-expanded={menu === "open"}
              aria-haspopup="true"
              onClick={() => (menu === "open" ? closeMenu() : openMenu())}
            >
              Expériences
              <svg
                className={`${styles.chevron} ${menu === "open" ? styles.chevronOpen : ""}`}
                viewBox="0 0 16 16"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>
            {menu !== "closed" && (
              <div
                className={`${styles.panel} ${menu === "closing" ? styles.panelClosing : ""}`}
                role="menu"
              >
                {EXPERIENCES.map((exp) => (
                  <Link
                    key={exp.name}
                    href={exp.href}
                    role="menuitem"
                    className={styles.panelLink}
                    onClick={closeMenu}
                  >
                    <span className={styles.panelName}>{exp.name}</span>
                    <span className={styles.panelDesc}>{exp.description}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <Link className={styles.link} href="/demo">
            Carte
          </Link>
          <Link className={styles.link} href="/apercu-restaurateur">
            Restaurateurs
          </Link>
          <Link className={styles.link} href="/tarifs-menu-digital-restaurant">
            Tarifs
          </Link>
        </div>

        <div className={styles.actions}>
          <Link className={styles.signin} href="/sign-in">
            Se connecter
          </Link>
          <Link
            className={`${shared.btnPrimary} ${styles.cta}`}
            href="/prendre-rendez-vous"
          >
            Prendre rendez-vous
          </Link>
        </div>
      </nav>
    </header>
  );
}
