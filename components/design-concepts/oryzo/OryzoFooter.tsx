import Link from "next/link";
import styles from "./OryzoFooter.module.css";

const NAV = [
  { href: "#experiences", label: "Expériences" },
  { href: "#plats", label: "Plats" },
  { href: "#fiche-produit", label: "Fiche produit" },
  { href: "#restaurateurs", label: "Restaurateurs" },
  { href: "/demo", label: "Démo" },
  { href: "/prendre-rendez-vous", label: "Prendre rendez-vous" }
];

/**
 * Concept Oryzo — three-column footer with a giant outline wordmark.
 * Real routes only; playful "concept" legal line.
 */
export function OryzoFooter(): React.JSX.Element {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.cols}>
          <div className={styles.col}>
            <p className={styles.wordmark}>VISTAIRE</p>
            <p className={styles.baseline}>
              La carte digitale premium des restaurants qui donnent envie
              avant la première bouchée.
            </p>
          </div>
          <nav className={styles.col} aria-label="Navigation de pied de page">
            <p className={styles.colTitle}>Navigation</p>
            <ul className={styles.list}>
              {NAV.map((item) => (
                <li key={item.href + item.label}>
                  <Link href={item.href} className={styles.link}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className={styles.col}>
            <p className={styles.colTitle}>Contact</p>
            <ul className={styles.list}>
              <li>
                <Link href="/prendre-rendez-vous" className={styles.link}>
                  Prendre rendez-vous
                </Link>
              </li>
              <li>
                <a href="tel:+15147152421" className={styles.link}>
                  +1 514 715-2421
                </a>
              </li>
              <li className={styles.plain}>Montréal, QC</li>
            </ul>
          </div>
        </div>

        <p className={styles.giant} aria-hidden="true">
          VISTAIRE
        </p>

        <div className={styles.bottomBar}>
          <p>© 2026 Vistaire — Page concept, non contractuelle.</p>
          <p>Design exploratoire inspiré d’oryzo.ai</p>
        </div>
      </div>
    </footer>
  );
}
