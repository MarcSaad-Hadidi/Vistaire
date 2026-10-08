import Image from "next/image";
import { OryzoReveal } from "./OryzoReveal";
import styles from "./OryzoFeatures.module.css";

/**
 * Full-bleed feature scene — mirrors oryzo.ai's desk feature section:
 * photo fills the viewport, a dark left panel carries the copy,
 * a playful formula note sits bottom-right.
 */
export function OryzoFeatures(): React.JSX.Element {
  return (
    <section id="atouts" className={styles.features} aria-label="Atouts">
      <div className={styles.photo} aria-hidden="true">
        <Image
          src="/images/demo/dishes/canette-rotie-figues-epices.png"
          alt=""
          fill
          sizes="100vw"
          className={styles.photoImg}
        />
      </div>

      <OryzoReveal className={styles.panel}>
        <span className={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 48 48" width="40" height="40">
            <path
              d="M24 40V10m0 0l-9 9m9-9l9 9"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h2 className={styles.kicker}>SUBLIMEZ VOS PLATS</h2>
        <p className={styles.body}>
          Des fiches plats visuelles : nom, prix, récit court, allergènes
          structurés. Vistaire ne montre pas seulement vos plats — elle les
          met en scène, comme ils le méritent.
        </p>
        <hr className={styles.divider} />
        <p className={styles.big}>VALORISEZ VOTRE CUISINE</p>
      </OryzoReveal>

      <div className={styles.formula}>
        <p className={styles.formulaText}>La justesse, par construction</p>
        <p className={styles.formulaGlyph} aria-hidden="true">
          δ ≈ 0
        </p>
      </div>
    </section>
  );
}
