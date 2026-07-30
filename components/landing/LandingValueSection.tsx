import type { LandingCopy } from "@/lib/landing/landingCopy";
import styles from "./VistaireLanding.module.css";

export function LandingValueSection({
  copy
}: {
  copy: LandingCopy["value"];
}) {
  return (
    <section
      aria-labelledby="landing-value-title"
      className={`${styles.section} ${styles.valueSection}`}
      id="fonctionnalites"
    >
      <div className={`${styles.sectionPanel} ${styles.valuePanel}`}>
        <header className={styles.sectionIntro}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h2 id="landing-value-title">{copy.title}</h2>
          <p>{copy.body}</p>
        </header>
        <ol className={styles.valueGrid}>
          {copy.items.map((item, index) => (
            <li key={item}>
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <p>{item}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
