import Image from "next/image";
import { LANDING_COPY } from "@/lib/landing/landingCopy";
import { OryzoReveal } from "./OryzoReveal";
import styles from "./OryzoDishes.module.css";

const copy = LANDING_COPY.fr.dishes;

/**
 * Concept Oryzo — dish storytelling.
 * Three "specimen" cards, each dish isolated in a dotted selection frame
 * with handles, like assets on a designer's artboard.
 */
export function OryzoDishes(): React.JSX.Element {
  return (
    <section id="plats" className={styles.section} aria-label="Mise en valeur des plats">
      <div className={styles.inner}>
        <OryzoReveal>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h2 className={styles.title}>{copy.title}</h2>
          <p className={styles.body}>{copy.body}</p>
        </OryzoReveal>

        <div className={styles.cards}>
          {copy.items.map((item, index) => (
            <OryzoReveal key={item.title} delay={Math.min(index * 90, 180)}>
              <article className={styles.card}>
                <div className={styles.frame}>
                  <span className={`${styles.handle} ${styles.tl}`} aria-hidden="true" />
                  <span className={`${styles.handle} ${styles.tr}`} aria-hidden="true" />
                  <span className={`${styles.handle} ${styles.bl}`} aria-hidden="true" />
                  <span className={`${styles.handle} ${styles.br}`} aria-hidden="true" />
                  <div className={styles.media}>
                    <Image
                      src={item.image}
                      alt={item.alt}
                      fill
                      sizes="(min-width: 1024px) 28vw, 100vw"
                      className={styles.img}
                    />
                  </div>
                </div>
                <p className={styles.specimen}>
                  SPÉCIMEN {String(index + 1).padStart(2, "0")} — 1:1, SÉLECTIONNÉ
                </p>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                <p className={styles.cardBody}>{item.body}</p>
              </article>
            </OryzoReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
