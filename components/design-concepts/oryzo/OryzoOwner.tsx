import Link from "next/link";
import { LANDING_COPY } from "@/lib/landing/landingCopy";
import { OryzoReveal } from "./OryzoReveal";
import styles from "./OryzoOwner.module.css";

const copy = LANDING_COPY.fr.owner;

/**
 * Concept Oryzo — owner tools.
 * The real owner operations as numbered tool cards — no invented
 * dashboards or metrics, per the source copy.
 */
export function OryzoOwner(): React.JSX.Element {
  return (
    <section
      id="restaurateurs"
      className={styles.section}
      aria-label="Outils pour les restaurateurs"
    >
      <div className={styles.inner}>
        <OryzoReveal>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h2 className={styles.title}>{copy.title}</h2>
          <p className={styles.body}>{copy.body}</p>
        </OryzoReveal>

        <div className={styles.cards}>
          {copy.items.map((item, index) => (
            <OryzoReveal key={item.title} delay={Math.min(index * 80, 240)}>
              <article className={styles.card}>
                <span className={styles.index}>
                  OUTIL {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                <p className={styles.cardBody}>{item.body}</p>
              </article>
            </OryzoReveal>
          ))}
        </div>

        <OryzoReveal>
          <Link
            href="/apercu-restaurateur"
            className={styles.cta}
          >
            {copy.cta}
          </Link>
        </OryzoReveal>
      </div>
    </section>
  );
}
