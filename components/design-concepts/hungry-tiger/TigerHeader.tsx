import Link from "next/link";
import styles from "./TigerHeader.module.css";

const NAV = [
  { label: "Accueil", href: "#hero" },
  { label: "Expériences", href: "#experiences" },
  { label: "Plats", href: "#plats" },
  { label: "Contact", href: "/contact" }
];

export function TigerHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <nav className={styles.navLeft} aria-label="Navigation principale">
          {NAV.map((item) => (
            <a key={item.href + item.label} href={item.href} className={styles.navPill}>
              {item.label}
            </a>
          ))}
        </nav>
        <a href="#hero" className={styles.logo} aria-label="Vistaire — retour en haut">
          Vist<span className={styles.logoAccent}>a</span>ire
        </a>
        <div className={styles.ctaWrap}>
          <Link href="/prendre-rendez-vous" className={styles.cta}>
            Prendre rendez-vous
          </Link>
        </div>
      </div>
      <hr className={styles.dots} aria-hidden="true" />
    </header>
  );
}
