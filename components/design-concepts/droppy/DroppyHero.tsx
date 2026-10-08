"use client";

import Image from "next/image";
import Link from "next/link";
import shared from "./shared.module.css";
import styles from "./DroppyHero.module.css";
import { DroppyFloat } from "./DroppyMotion";

/**
 * Hero — electric-blue, giant two-tone headline, duotone dish art left/right,
 * floating glass badge, two pill CTAs.
 */
export function DroppyHero() {
  return (
    <section className={styles.hero} data-nav-dark={false} aria-label="Introduction">
      <div className={`${shared.duotone} ${styles.artLeft}`} aria-hidden="true">
        <Image
          src="/images/demo/dishes/homard-bleu-bisque-fenouil.png"
          alt=""
          fill
          priority
          sizes="45vw"
        />
      </div>
      <div className={`${shared.duotone} ${styles.artRight}`} aria-hidden="true">
        <Image
          src="/images/demo/dishes/souffle-chocolat-grand-cru.png"
          alt=""
          fill
          priority
          sizes="45vw"
        />
      </div>
      <div className={styles.scrim} aria-hidden="true" />

      <div className={styles.content}>
        <DroppyFloat className={styles.badgeWrap} style={{ animationDuration: "6.5s" }}>
          <div className={styles.badge} aria-hidden="true">
            <span className={styles.badgeMark}>
              <svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor">
                <path d="M12 2C12 2 5 10.2 5 15a7 7 0 0 0 14 0C19 10.2 12 2 12 2Z" />
                <circle cx="9.4" cy="14.6" r="1.7" fill="#fff" opacity="0.95" />
                <circle cx="14.6" cy="14.6" r="1.7" fill="#fff" opacity="0.95" />
              </svg>
            </span>
          </div>
        </DroppyFloat>

        <p className={styles.eyebrow}>
          <span aria-hidden="true">✦</span> Carte digitale premium — pensée pour la salle
        </p>
        <h1 className={styles.title}>
          <span className={styles.titleDim}>Donnez envie avant</span>
          <br />
          la première bouchée.
        </h1>
        <p className={styles.sub}>
          Un PDF ne fait pas vivre votre menu. Vistaire transforme votre QR code
          en une carte mobile claire, visuelle et fidèle à l’identité de votre
          restaurant.
        </p>
        <div className={styles.ctas}>
          <Link href="/demo" className={`${shared.btn} ${shared.btnWhite}`}>
            Voir la démo
          </Link>
          <Link
            href="/prendre-rendez-vous"
            className={`${shared.btn} ${shared.btnGhost}`}
          >
            Prendre rendez-vous
          </Link>
        </div>
        <p className={styles.fineprint}>
          <Link href="#visuels">
            Sans application. 100&nbsp;% à découvrir. <span aria-hidden="true">↗</span>
          </Link>
        </p>
      </div>
    </section>
  );
}
