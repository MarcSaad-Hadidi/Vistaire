import Link from "next/link";
import shared from "./shared.module.css";
import styles from "./TigerHeader.module.css";

const NAV = [
  { label: "Carte", href: "#carte" },
  { label: "Expériences", href: "#experiences" },
  { label: "Plats", href: "#plats" },
  { label: "Contact", href: "/contact" }
];

export function TigerHeader() {
  return (
    <header className={`${styles.header} ${shared.rustBg}`}>
      <div className={styles.inner}>
        <nav className={styles.left} aria-label="Navigation principale">
          {NAV.map((item) =>
            item.href.startsWith("#") ? (
              <a key={item.label} href={item.href} className={styles.navPill}>
                {item.label}
              </a>
            ) : (
              <Link key={item.label} href={item.href} className={styles.navPill}>
                {item.label}
              </Link>
            )
          )}
        </nav>
        <a href="#hero" className={styles.logo} aria-label="Vistaire — retour en haut">
          <span className={styles.logoTop}>Vistaire</span>
        </a>
        <div className={styles.right}>
          <Link href="/prendre-rendez-vous" className={styles.cta}>
            Prendre rendez-vous
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 8h15l-1.5 9h-12z" strokeLinejoin="round" />
              <path d="M6 8l-1-4H2" strokeLinecap="round" />
              <circle cx="9.5" cy="20" r="1.4" />
              <circle cx="17.5" cy="20" r="1.4" />
            </svg>
          </Link>
        </div>
      </div>
      <hr className={`${shared.dottedLine} ${styles.dots}`} aria-hidden="true" />
    </header>
  );
}
