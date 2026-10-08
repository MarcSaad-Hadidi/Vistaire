import Link from "next/link";
import { OryzoReveal } from "./OryzoReveal";
import styles from "./OryzoSota.module.css";

/**
 * SOTA-style section — mirrors oryzo.ai's "OUR SOTA OPEN WEIGHT MODEL":
 * small-caps eyebrow, giant model name, three dark action pills,
 * and an abstract-style paragraph with an orange key term.
 */
export function OryzoSota(): React.JSX.Element {
  return (
    <section className={styles.sota} aria-label="Notre modèle de carte">
      <OryzoReveal>
        <p className={styles.eyebrow}>NOTRE FAÇON DE VOIR LA CARTE</p>
        <h2 className={styles.name}>VISTAIRE-1</h2>
      </OryzoReveal>

      <OryzoReveal delay={120} className={styles.pills}>
        <Link href="/demo" className={styles.pill}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              d="M6 4h9l4 4v12H6z M9 12h7M9 16h7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          APERÇU
        </Link>
        <Link href="/demo" className={styles.pill}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect
              x="4"
              y="3"
              width="16"
              height="18"
              rx="2"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M10 8l5 4-5 4z"
              fill="currentColor"
            />
          </svg>
          DÉMO
        </Link>
        <Link href="/prendre-rendez-vous" className={styles.pill}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect
              x="3"
              y="5"
              width="18"
              height="14"
              rx="2"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path d="M3 7l9 6 9-6" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          RENDEZ-VOUS
        </Link>
      </OryzoReveal>

      <OryzoReveal delay={200} className={styles.abstract}>
        <h3 className={styles.abstractTitle}>En résumé</h3>
        <p className={styles.abstractText}>
          Nous présentons <span className={styles.accent}>Vistaire-1</span>,
          notre façon de voir la carte digitale : claire, visuelle, fidèle à
          l&rsquo;identité du restaurant. Ni application à télécharger, ni PDF
          illisible — une carte qui donne envie, que vous mettez à jour en un
          geste, et que vos convives consultent en un scan.
        </p>
      </OryzoReveal>
    </section>
  );
}
