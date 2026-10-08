"use client";

import { useEffect, useState } from "react";
import styles from "./OryzoHeader.module.css";

const LINKS = [
  { label: "INTRO", href: "#intro" },
  { label: "ATOUTS", href: "#atouts" },
  { label: "PRODUIT", href: "#produit" },
  { label: "CONTACT", href: "#contact" }
] as const;

export function OryzoHeader(): React.JSX.Element {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string>("#intro");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.7);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = LINKS.map((l) =>
      document.querySelector<HTMLElement>(l.href)
    ).filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(`#${entry.target.id}`);
        }
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  return (
    <>
      <header className={styles.header}>
        <a
          href="#intro"
          className={`${styles.logo} ${scrolled ? styles.logoVisible : ""}`}
          aria-label="Vistaire — retour en haut"
        >
          VISTAIRE
        </a>
        <nav className={styles.nav} aria-label="Navigation principale">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`${styles.link} ${active === link.href ? styles.linkActive : ""}`}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </header>
      <div className={styles.sideTab} aria-hidden="true">
        <span className={styles.sideTabDot} />
        VISTAIRE · MODÈLE
      </div>
    </>
  );
}
