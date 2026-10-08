import Image from "next/image";
import Link from "next/link";
import { LANDING_COPY } from "@/lib/landing/landingCopy";
import { OryzoReveal } from "./OryzoReveal";
import styles from "./OryzoHero.module.css";

const copy = LANDING_COPY.fr.hero;

/**
 * Concept Oryzo — photographic hero.
 * Full-bleed dish photo, giant overlapping VISTAIRE display type,
 * glass dark panel with the real tagline + two pill CTAs.
 */
export function OryzoHero(): React.JSX.Element {
  return (
    <section id="carte" className={styles.hero} aria-label="Présentation Vistaire">
      <div className={styles.photo} aria-hidden="true">
        <Image
          src="/images/demo/dishes/homard-bleu-bisque-fenouil.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className={styles.photoImg}
        />
        <div className={styles.scrim} />
      </div>

      <div className={styles.content}>
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h1 className={styles.giant} aria-label="Vistaire">
          VISTAIRE
        </h1>

        <OryzoReveal className={styles.panel}>
          <p className={styles.tagline}>{copy.title}</p>
          <p className={styles.body}>{copy.body}</p>
          <div className={styles.ctas}>
            <Link href="/demo" className={`${styles.pill} ${styles.pillSolid}`}>
              {copy.primaryCta}
            </Link>
            <Link href="#experiences" className={`${styles.pill} ${styles.pillGhost}`}>
              {copy.secondaryCta}
            </Link>
          </div>
          <p className={styles.legend}>
            FIG. 00 — SCANNEZ. REGARDEZ. SALIVEZ.
          </p>
        </OryzoReveal>
      </div>
    </section>
  );
}
