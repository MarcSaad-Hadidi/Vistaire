import Link from "next/link";
import { OryzoReveal } from "./OryzoReveal";
import styles from "./OryzoFinalCta.module.css";

/**
 * Final CTA — mirrors oryzo.ai's closing beat: geometric L-mark,
 * giant right-aligned statement, single brown pill button.
 */
export function OryzoFinalCta(): React.JSX.Element {
  return (
    <section className={styles.cta} aria-label="Prendre rendez-vous">
      <div className={styles.mark} aria-hidden="true">
        <span className={styles.markV} />
        <span className={styles.markH} />
      </div>

      <OryzoReveal>
        <h2 className={styles.title}>
          VOUS AVEZ REMARQUÉ LE SOIN DU DÉTAIL.
          <br />
          IMAGINEZ CE QU&rsquo;ON PEUT FAIRE POUR VOTRE RESTAURANT.
        </h2>
      </OryzoReveal>

      <OryzoReveal delay={140}>
        <Link href="/prendre-rendez-vous" className={styles.pill}>
          PRENDRE RENDEZ-VOUS
        </Link>
      </OryzoReveal>
    </section>
  );
}
