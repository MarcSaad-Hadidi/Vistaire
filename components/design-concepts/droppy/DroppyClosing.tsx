"use client";

import Link from "next/link";
import shared from "./shared.module.css";
import styles from "./DroppyClosing.module.css";
import { DroppyReveal } from "./DroppyMotion";

const MENU = [
  { href: "#top", label: "Accueil" },
  { href: "#fiches", label: "Fiches" },
  { href: "#visuels", label: "Visuels" },
  { href: "#outils", label: "Outils" },
  { href: "#faq", label: "FAQ" },
  { href: "#tarifs", label: "Tarifs" },
  { href: "/prendre-rendez-vous", label: "Contact" }
];

const NAV = [
  { href: "#fiches", label: "Fiches plats" },
  { href: "#visuels", label: "Photos premium" },
  { href: "#outils", label: "Outils restaurateur" },
  { href: "#tarifs", label: "Offre" },
  { href: "/demo", label: "Démo" },
  { href: "#faq", label: "Questions fréquentes" },
  { href: "/prendre-rendez-vous", label: "Prendre rendez-vous" }
];

const CONNECT = [
  { href: "/prendre-rendez-vous", label: "Prendre rendez-vous" },
  { href: "/demo", label: "Voir la démo" },
  { href: "https://vistaire.ca", label: "vistaire.ca" }
];

/**
 * Final CTA ("Ready…" → Vistaire) + blue footer with cloud divider
 * and giant watermark.
 */
export function DroppyClosing() {
  return (
    <>
      <section className={`${shared.section} ${styles.final}`} data-nav-dark aria-label="Commencer">
        <div className={shared.wrap}>
          <DroppyReveal className={styles.finalBadgeWrap}>
            <div className={styles.finalBadge} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="44" height="44" fill="#fff">
                <path d="M12 2C12 2 5 10.2 5 15a7 7 0 0 0 14 0C19 10.2 12 2 12 2Z" />
                <circle cx="9.4" cy="14.6" r="1.7" fill="#1200ff" />
                <circle cx="14.6" cy="14.6" r="1.7" fill="#1200ff" />
              </svg>
            </div>
          </DroppyReveal>
          <DroppyReveal>
            <h2 className={shared.title}>Prêt à ranger vos cartes papier ?</h2>
            <p className={shared.sub}>
              Des fiches visuelles, des photos premium, une 3D sélective. Essayez
              la démo, adoptez-la en un rendez-vous.
            </p>
            <div className={styles.finalCtas}>
              <Link href="/demo" className={`${shared.btn} ${shared.btnBlue}`}>
                Voir la démo
              </Link>
              <Link href="/prendre-rendez-vous" className={`${shared.btn} ${shared.btnPale}`}>
                Prendre rendez-vous
              </Link>
            </div>
          </DroppyReveal>
        </div>
      </section>

      <div className={styles.cloudTop} aria-hidden="true">
        <div className={`${shared.cloudDivider} ${styles.clouds}`} />
      </div>
      <footer className={styles.footer} data-nav-dark={false}>
        <div className={`${shared.wrap} ${styles.footerGrid}`}>
          <div className={styles.brandCol}>
            <p className={styles.brandRow}>
              <span className={styles.brandBadge} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="#fff">
                  <path d="M12 2C12 2 5 10.2 5 15a7 7 0 0 0 14 0C19 10.2 12 2 12 2Z" />
                  <circle cx="9.4" cy="14.6" r="1.7" fill="#1200ff" />
                  <circle cx="14.6" cy="14.6" r="1.7" fill="#1200ff" />
                </svg>
              </span>
              <strong>Vistaire</strong>
            </p>
            <p className={styles.tagline}>
              Pas une carte comme les autres,
              <br />
              vraiment au niveau.
            </p>
            <p className={styles.brandDesc}>
              Des fiches visuelles, des photos premium et une 3D sélective. Une
              carte mobile claire, sans application.
            </p>
            <Link href="/prendre-rendez-vous" className={`${shared.btn} ${shared.btnWhite} ${styles.footerCta}`}>
              Prendre rendez-vous
            </Link>
            <p className={styles.copy}>© 2026 Vistaire — Tous droits réservés</p>
            <p className={styles.made}>Concept design, page de test non indexée.</p>
          </div>
          <nav className={styles.col} aria-label="Menu">
            <p className={styles.colTitle}>Menu</p>
            {MENU.map((l) => (
              <Link key={l.label} href={l.href}>{l.label}</Link>
            ))}
          </nav>
          <nav className={styles.col} aria-label="Navigation">
            <p className={styles.colTitle}>Navigation</p>
            {NAV.map((l) => (
              <Link key={l.label} href={l.href}>{l.label}</Link>
            ))}
          </nav>
          <nav className={styles.col} aria-label="Contact">
            <p className={styles.colTitle}>Contact</p>
            {CONNECT.map((l) => (
              <Link key={l.label} href={l.href}>{l.label}</Link>
            ))}
          </nav>
        </div>
        <div className={styles.watermark} aria-hidden="true">
          Vistaire
        </div>
      </footer>
    </>
  );
}
