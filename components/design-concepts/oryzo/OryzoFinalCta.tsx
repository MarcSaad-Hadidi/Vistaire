import Image from "next/image";
import Link from "next/link";
import { LANDING_COPY } from "@/lib/landing/landingCopy";
import { OryzoReveal } from "./OryzoReveal";
import styles from "./OryzoFinalCta.module.css";

const copy = LANDING_COPY.fr.finalCta;

/**
 * Concept Oryzo — final call to action.
 * Full-bleed photo band, centered real copy, orange pill CTA.
 */
export function OryzoFinalCta(): React.JSX.Element {
  return (
    <section className={styles.section} aria-label="Prendre rendez-vous">
      <div className={styles.photo} aria-hidden="true">
        <Image
          src="/images/demo/dishes/canette-rotie-figues-epices.png"
          alt=""
          fill
          sizes="100vw"
          className={styles.photoImg}
        />
        <div className={styles.scrim} />
      </div>
      <div className={styles.inner}>
        <OryzoReveal>
          <p className={styles.eyebrow}>Dernière étape avant le service</p>
          <h2 className={styles.title}>{copy.title}</h2>
          <p className={styles.body}>{copy.body}</p>
          <Link href="/prendre-rendez-vous" className={styles.cta}>
            {copy.cta}
          </Link>
          <p className={styles.legend}>
            SANS ENGAGEMENT — JUSTE UNE BONNE CONVERSATION AUTOUR DE VOTRE CARTE.
          </p>
        </OryzoReveal>
      </div>
    </section>
  );
}
