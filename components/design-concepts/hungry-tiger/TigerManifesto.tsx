import { LANDING_COPY } from "@/lib/landing/landingCopy";
import { WordReveal } from "./TigerMotion";
import shared from "./shared.module.css";
import styles from "./TigerManifesto.module.css";

const copy = LANDING_COPY.fr.comparison;

export function TigerManifesto() {
  return (
    <section className={styles.manifesto} aria-label="Manifeste">
      <div className={`${shared.wrap}`}>
        <p className={`${shared.eyebrow} ${styles.eyebrow}`}>{copy.eyebrow}</p>
        <WordReveal
          text={copy.title.toUpperCase()}
          className={`${shared.giantTitle} ${styles.title}`}
          dimClassName={styles.wordDim}
          litClassName={styles.wordLit}
        />
        <hr className={styles.dots} aria-hidden="true" />
        <p className={styles.body}>{copy.body}</p>
      </div>
    </section>
  );
}
