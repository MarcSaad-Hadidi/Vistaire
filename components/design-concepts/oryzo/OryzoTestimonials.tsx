import { OryzoReveal } from "./OryzoReveal";
import styles from "./OryzoTestimonials.module.css";

const QUOTES = [
  {
    quote: "J’ai scanné par curiosité. J’ai commandé deux desserts.",
    author: "Un habitué du samedi soir"
  },
  {
    quote: "Enfin une carte où je vois vraiment ce que je vais manger.",
    author: "Une cliente pressée, entre deux rendez-vous"
  },
  {
    quote: "On a passé plus de temps sur les plats que sur nos téléphones.",
    author: "Une table de quatre, service de 20 h"
  }
];

/**
 * Concept Oryzo — testimonials.
 * Playful diner voices in the satirical spirit of the reference.
 * Clearly marked as illustrative ("reconstitution dramatique") —
 * these are concept microcopy, not real reviews.
 */
export function OryzoTestimonials(): React.JSX.Element {
  return (
    <section className={styles.section} aria-label="Témoignages">
      <div className={styles.inner}>
        <OryzoReveal>
          <p className={styles.eyebrow}>Témoignages*</p>
          <h2 className={styles.title}>Ils scannent. Ils restent.</h2>
        </OryzoReveal>

        <div className={styles.cards}>
          {QUOTES.map((item, index) => (
            <OryzoReveal key={item.author} delay={Math.min(index * 90, 180)}>
              <figure className={styles.card}>
                <span className={styles.mark} aria-hidden="true">
                  “
                </span>
                <blockquote className={styles.quote}>{item.quote}</blockquote>
                <figcaption className={styles.author}>
                  — {item.author}
                </figcaption>
              </figure>
            </OryzoReveal>
          ))}
        </div>

        <p className={styles.footnote}>*Reconstitution dramatique.</p>
      </div>
    </section>
  );
}
