import Image from "next/image";
import Link from "next/link";
import { Marquee } from "./TigerMotion";
import shared from "./shared.module.css";
import styles from "./TigerHero.module.css";

const CLAIMS = [
  "Sans application",
  "FR + EN",
  "3D / AR sélective",
  "Fiches plats visuelles",
  "Allergènes structurés",
  "Photos premium"
];

export function TigerHero() {
  return (
    <section id="hero" className={`${styles.hero} ${shared.rustBg} ${shared.grain}`} aria-label="Introduction">
      <div className={styles.top}>
        <p className={`${shared.eyebrow} ${styles.eyebrow}`}>Carte digitale premium</p>
        <h1 className={`${shared.giantTitle} ${styles.title}`} aria-label="Donnez envie">
          Donnez envie
        </h1>
        <hr className={shared.dottedLine} aria-hidden="true" />
        <p className={`${shared.giantTitle} ${styles.subtitle}`} aria-hidden="true">
          Avant la première bouchée
        </p>
        <div className={styles.dishWrap} aria-hidden="true">
          <Image
            src="/images/demo/dishes/homard-bleu-bisque-fenouil.png"
            alt=""
            width={880}
            height={880}
            priority
            className={styles.dish}
          />
        </div>
      </div>
      <div className={styles.bottom}>
        <p className={shared.caps}>
          Vistaire transforme votre QR code en une carte mobile claire,
          visuelle et fidèle à l&rsquo;identité de votre restaurant.
        </p>
        <Link href="/prendre-rendez-vous" className={shared.pill}>
          Prendre rendez-vous
        </Link>
      </div>
      <div className={styles.band}>
        <Marquee duration="30s">
          {CLAIMS.map((c) => (
            <span key={c} className={styles.bandItem}>
              {c}
              <span className={styles.bandDot} aria-hidden="true">•</span>
            </span>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
