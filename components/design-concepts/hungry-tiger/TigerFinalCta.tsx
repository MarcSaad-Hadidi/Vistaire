import Link from "next/link";
import { LANDING_COPY } from "@/lib/landing/landingCopy";
import { Sticker, WordReveal } from "./TigerMotion";
import shared from "./shared.module.css";
import styles from "./TigerFinalCta.module.css";

const copy = LANDING_COPY.fr.finalCta;

export function TigerFinalCta() {
  return (
    <section className={styles.final} aria-label="Appel à l'action final">
      <div
        className={styles.bg}
        role="img"
        aria-label="Gros plan d'une canette rôtie aux figues et aux épices"
      />
      <div className={`${shared.wrap} ${styles.inner}`}>
        <Sticker className={shared.sticker} tilt="-6deg" delay={100}>
          À la hauteur de votre restaurant
        </Sticker>
        <WordReveal
          text={copy.title}
          className={`${shared.giantTitle} ${styles.title}`}
          dimClassName={styles.wordDim}
          litClassName={styles.wordLit}
        />
        <p className={styles.body}>{copy.body}</p>
        <Link href="/prendre-rendez-vous" className={shared.pill}>
          {copy.cta}
        </Link>
      </div>
    </section>
  );
}
