import shared from "./shared.module.css";
import styles from "./MercuryStats.module.css";
import { MercuryReveal } from "./MercuryReveal";

const STATS = [
  { value: "0", label: "application à télécharger" },
  { value: "2", label: "langues : français et anglais" },
  { value: "1", label: "scan suffit pour ouvrir la carte" },
  { value: "3D", label: "et AR, seulement sur les plats signatures" }
];

/** Static stats row — no count-up, per the reference. */
export function MercuryStats() {
  return (
    <section className={shared.section} data-mtheme="dark" aria-label="Vistaire en bref">
      <div className={shared.wrap}>
        <div className={styles.grid}>
          {STATS.map((s, i) => (
            <MercuryReveal key={s.label} delay={i * 100}>
              <div className={styles.stat}>
                <div className={styles.value}>{s.value}</div>
                <div className={styles.label}>{s.label}</div>
              </div>
            </MercuryReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
