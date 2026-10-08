import Image from "next/image";
import Link from "next/link";
import { LANDING_COPY } from "@/lib/landing/landingCopy";
import { Sticker } from "./TigerMotion";
import shared from "./shared.module.css";
import styles from "./TigerHero.module.css";

const copy = LANDING_COPY.fr.hero;

export function TigerHero() {
  return (
    <section id="hero" className={`${styles.hero} ${shared.dotPattern}`}>
      {/* Tilted sticker labels — signature fly-in, 0.1s stagger */}
      <Sticker className={`${shared.sticker} ${styles.sticker1}`} tilt="-7deg" delay={100}>
        Sans application
      </Sticker>
      <Sticker className={`${shared.sticker} ${styles.sticker2}`} tilt="8deg" delay={200}>
        Scan → carte
      </Sticker>

      <div className={styles.center}>
        <p className={shared.eyebrow}>{copy.eyebrow}</p>
        <h1 className={`${shared.giantTitle} ${styles.title}`}>
          Donnez envie
          <br />
          avant la première
          <br />
          bouchée<span className={styles.dot}>.</span>
        </h1>

        {/* Dish photo in front of the typography, for depth */}
        <div className={styles.dish} aria-hidden="false">
          <Image
            src="/images/demo/dishes/homard-bleu-bisque-fenouil.png"
            alt="Homard dressé dans une assiette gastronomique"
            fill
            sizes="(max-width: 768px) 62vw, 34vw"
            priority
            style={{ objectFit: "cover" }}
          />
        </div>

        <hr className={styles.dots} aria-hidden="true" />
        <p className={styles.kicker}>Votre menu, sublimé.</p>
      </div>

      <div className={styles.bottom}>
        <p className={styles.body}>{copy.body}</p>
        <div className={styles.ctas}>
          <Link href="/prendre-rendez-vous" className={shared.pill}>
            Prendre rendez-vous
          </Link>
          <a href="#experiences" className={shared.pillGhost}>
            Découvrir les expériences
          </a>
        </div>
      </div>
    </section>
  );
}
