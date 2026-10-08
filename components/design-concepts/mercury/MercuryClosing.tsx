import Link from "next/link";
import shared from "./shared.module.css";
import styles from "./MercuryClosing.module.css";
import { MercuryReveal } from "./MercuryReveal";

/** Final CTA — mirrors "Banking — redesigned from the ground up." */
export function MercuryClosing() {
  return (
    <section className={shared.section} data-mtheme="dark" aria-label="Commencer">
      <div className={`${shared.wrap} ${styles.center}`}>
        <MercuryReveal as="h2" className={`${shared.title} ${shared.titleSerif} ${styles.title}`}>
          Une carte digitale repensée pour votre restaurant.
        </MercuryReveal>
        <MercuryReveal delay={120}>
          <div className={styles.actions}>
            <Link href="/prendre-rendez-vous" className={shared.btnBlue}>
              Prendre rendez-vous
            </Link>
            <Link href="/demo" className={shared.btnGhost}>
              Voir la démo
            </Link>
          </div>
        </MercuryReveal>
      </div>
    </section>
  );
}
