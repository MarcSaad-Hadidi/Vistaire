import Link from "next/link";
import shared from "./shared.module.css";
import styles from "./MercuryConcept.module.css";
import { MercuryNavbar } from "./MercuryNavbar";
import { MercuryHero } from "./MercuryHero";
import { MercuryAccordion } from "./MercuryAccordion";
import { MercuryMarquee } from "./MercuryMarquee";
import { MercuryTestimonials } from "./MercuryTestimonials";
import { MercuryFeatures } from "./MercuryFeatures";
import { MercuryClosing } from "./MercuryClosing";

/**
 * Mercury design concept: dark #171721 dominant, beige #f6f5f2 light chapters,
 * periwinkle #5266eb primary, Tiempos-like serif giant titles, pill buttons,
 * generous spacing, alternating dark -> light -> dark chapters.
 * Animation fidelity is the priority (see individual components).
 */
export function MercuryConcept() {
  return (
    <div className={`${shared.page} ${styles.page}`}>
      <div data-mercury-theme="light" className={styles.announce}>
        <p className={styles.announceText}>
          Nouveau — la carte digitale Sauge Noire est en ligne.{" "}
          <Link href="/demo" className={styles.announceLink}>
            Explorer la démo
          </Link>
        </p>
      </div>

      <MercuryNavbar />

      <main>
        <MercuryHero />
        <MercuryAccordion />
        <MercuryMarquee />
        <MercuryTestimonials />
        <MercuryFeatures />
        <MercuryClosing />
      </main>
    </div>
  );
}
