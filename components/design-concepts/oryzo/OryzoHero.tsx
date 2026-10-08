import Image from "next/image";
import Link from "next/link";
import styles from "./OryzoHero.module.css";

export function OryzoHero(): React.JSX.Element {
  return (
    <section id="intro" className={styles.hero} aria-label="Introduction">
      <div className={styles.photo} aria-hidden="true">
        <Image
          src="/images/demo/dishes/homard-bleu-bisque-fenouil.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className={styles.photoImg}
        />
        <div className={styles.photoShade} />
      </div>

      <p className={styles.kicker}>PENSÉE POUR LES TABLES. CONÇUE POUR LES CHEFS.</p>

      <h1 className={styles.title}>VISTAIRE</h1>

      <aside className={styles.panel}>
        <p className={styles.panelTop}>
          CONÇUE PAR VISTAIRE,
          <br />
          POUR LES RESTAURANTS EXIGEANTS.
        </p>
        <hr className={styles.panelDivider} />
        <p className={styles.panelBottom}>
          La carte digitale qui donne envie avant la première bouchée.
        </p>
      </aside>

      <Link href="/demo" className={styles.play} aria-label="Voir la démo">
        <span className={styles.playThumb}>
          <Image
            src="/images/demo/dishes/ravioles-chevre-miel-monteregie.png"
            alt=""
            fill
            sizes="160px"
            className={styles.playImg}
          />
          <span className={styles.playWord}>VISTAIRE</span>
          <span className={styles.playLabel}>VOIR</span>
        </span>
      </Link>

      <a href="#coaster" className={styles.scrollCue}>
        <span className={styles.scrollDot}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="M6 9l6 6 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        DÉFILER POUR CONTINUER
      </a>
    </section>
  );
}
