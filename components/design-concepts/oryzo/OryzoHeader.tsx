import Link from "next/link";
import styles from "./OryzoHeader.module.css";

const NAV_LINKS = [
  { href: "#experiences", label: "Expériences" },
  { href: "#plats", label: "Plats" },
  { href: "#fiche-produit", label: "Fiche produit" },
  { href: "#restaurateurs", label: "Restaurateurs" }
];

/**
 * Concept Oryzo — fixed top navigation.
 * Wordmark left, links right, dotted underline on the active/hovered item,
 * orange pill CTA. Dark translucent bar over the page.
 */
export function OryzoHeader(): React.JSX.Element {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="#carte" className={styles.logo} aria-label="Vistaire — haut de page">
          VISTAIRE
          <span className={styles.logoDot} aria-hidden="true" />
        </Link>
        <nav className={styles.nav} aria-label="Navigation principale">
          {NAV_LINKS.map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              className={styles.link}
              aria-current={index === 0 ? "true" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Link href="/prendre-rendez-vous" className={styles.cta}>
          Prendre rendez-vous
        </Link>
      </div>
      <div className={styles.dottedRule} aria-hidden="true" />
    </header>
  );
}
