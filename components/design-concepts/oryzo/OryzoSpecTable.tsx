import { OryzoReveal } from "./OryzoReveal";
import styles from "./OryzoSpecTable.module.css";

const SPEC_SHEET: Array<[string, string]> = [
  ["Produit", "Carte digitale Vistaire"],
  ["Scan", "QR code"],
  ["Application", "Aucune — rien à télécharger"],
  ["Mise à jour", "Instantanée"],
  ["Langues", "FR + EN"]
];

const COMPARISON: Array<{ label: string; pdf: string; vistaire: string }> = [
  {
    label: "Mise à jour",
    pdf: "Réimpression complète",
    vistaire: "Instantanée, depuis votre téléphone"
  },
  {
    label: "Application requise",
    pdf: "Lecteur PDF",
    vistaire: "Aucune"
  },
  {
    label: "Allergènes",
    pdf: "En petits caractères",
    vistaire: "Structurés et clairs"
  },
  {
    label: "Visuels",
    pdf: "Aucun",
    vistaire: "Photos premium de chaque plat"
  },
  {
    label: "Langues",
    pdf: "Une seule",
    vistaire: "Français + anglais"
  },
  {
    label: "Plat épuisé",
    pdf: "Raturé au stylo",
    vistaire: "Retiré en un geste"
  },
  {
    label: "3D / AR",
    pdf: "—",
    vistaire: "Sélective, plats signatures"
  }
];

/**
 * Concept Oryzo — playful-technical spec section.
 * A parody-style product spec sheet followed by a PDF vs Vistaire
 * comparison table, all in dotted technical-document styling.
 */
export function OryzoSpecTable(): React.JSX.Element {
  return (
    <section
      id="fiche-produit"
      className={styles.section}
      aria-label="Fiche produit et comparaison"
    >
      <div className={styles.inner}>
        <OryzoReveal>
          <p className={styles.eyebrow}>Fiche produit</p>
          <h2 className={styles.title}>
            Spécifications techniques. Résultats délicieux.
          </h2>
        </OryzoReveal>

        <OryzoReveal>
          <dl className={styles.specSheet}>
            {SPEC_SHEET.map(([term, value]) => (
              <div key={term} className={styles.specRow}>
                <dt className={styles.specTerm}>{term}</dt>
                <dd className={styles.specValue}>{value}</dd>
              </div>
            ))}
          </dl>
        </OryzoReveal>

        <OryzoReveal>
          <h3 className={styles.tableTitle}>
            Carte PDF <span className={styles.vs}>vs</span> Carte Vistaire
          </h3>
          <p className={styles.tableHint}>
            Le QR code n’est pas le problème. Ce qui compte, c’est ce que le
            client découvre après le scan.
          </p>
        </OryzoReveal>

        <OryzoReveal>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.caption}>
                Comparaison entre un menu PDF classique et une carte digitale
                Vistaire.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={styles.thLabel}>
                    Critère
                  </th>
                  <th scope="col">Carte PDF</th>
                  <th scope="col" className={styles.thVistaire}>
                    Carte Vistaire
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className={styles.rowLabel}>
                      {row.label}
                    </th>
                    <td className={styles.cellPdf}>{row.pdf}</td>
                    <td className={styles.cellVistaire}>{row.vistaire}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </OryzoReveal>

        <p className={styles.footnote}>
          TESTÉ EN CONDITIONS RÉELLES : SERVICE DU VENDREDI SOIR, 19 H 42.
        </p>
      </div>
    </section>
  );
}
