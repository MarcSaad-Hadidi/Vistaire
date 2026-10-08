import shared from "./shared.module.css";
import styles from "./TigerFooter.module.css";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Carte",
    links: [
      { label: "Expériences", href: "#experiences" },
      { label: "Plats", href: "#plats" },
      { label: "Démo", href: "/demo" }
    ]
  },
  {
    title: "Vistaire",
    links: [
      { label: "Prendre rendez-vous", href: "/prendre-rendez-vous" },
      { label: "Aperçu restaurateur", href: "/apercu-restaurateur" },
      { label: "Contact", href: "/contact" }
    ]
  }
];

export function TigerFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${shared.wrap} ${styles.inner}`}>
        <p className={styles.giant} aria-label="Vistaire">
          Vistaire
        </p>
        <div className={styles.columns}>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className={styles.colTitle}>{col.title}</h3>
              <ul className={styles.colList}>
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className={styles.colLink}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div>
            <h3 className={styles.colTitle}>Montréal</h3>
            <p className={styles.colText}>
              Cartes digitales premium
              <br />
              pour restaurants haut de gamme.
            </p>
          </div>
        </div>
        <hr className={styles.dots} aria-hidden="true" />
        <div className={styles.legal}>
          <span>© 2026 Vistaire — Concept de design (page de test)</span>
          <span>Style inspiré d&apos;eathungrytiger.com</span>
        </div>
      </div>
    </footer>
  );
}
