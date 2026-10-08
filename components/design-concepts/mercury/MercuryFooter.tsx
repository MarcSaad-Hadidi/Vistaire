import Link from "next/link";
import shared from "./shared.module.css";
import styles from "./MercuryFooter.module.css";

const COLS: { links: { label: string; href: string }[] }[] = [
  {
    links: [
      { label: "Gastronomique", href: "/demo" },
      { label: "Bistronomique", href: "/demo" },
      { label: "Brasserie", href: "/demo" },
      { label: "Italienne", href: "/demo" },
      { label: "Japonaise", href: "/demo" },
      { label: "Café de spécialité", href: "/demo" }
    ]
  },
  {
    links: [
      { label: "Prendre rendez-vous", href: "/prendre-rendez-vous" },
      { label: "Voir la démo", href: "/demo" },
      { label: "Contact", href: "/contact" }
    ]
  },
  {
    links: [
      { label: "À propos", href: "/a-propos" },
      { label: "Mentions légales", href: "/contact" },
      { label: "Confidentialité", href: "/contact" }
    ]
  },
  {
    links: [
      { label: "Instagram", href: "/contact" },
      { label: "LinkedIn", href: "/contact" },
      { label: "X", href: "/contact" }
    ]
  }
];

export function MercuryFooter() {
  return (
    <footer className={styles.footer} data-mtheme="dark">
      <div className={shared.wrap}>
        <nav className={styles.cols} aria-label="Pied de page">
          {COLS.map((col, i) => (
            <ul key={i} className={styles.col}>
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className={styles.link}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </nav>

        <div className={styles.rule} aria-hidden="true" />

        <div className={styles.legal}>
          <div className={styles.legalLabel}>Mentions légales</div>
          <p className={styles.legalText}>
            © 2026 Vistaire. Page concept — exploration design, non
            contractuelle. Vistaire conçoit des cartes digitales premium pour
            restaurants haut de gamme : QR code vers une carte mobile claire
            et visuelle, sans application à télécharger.
          </p>
        </div>
      </div>
    </footer>
  );
}
