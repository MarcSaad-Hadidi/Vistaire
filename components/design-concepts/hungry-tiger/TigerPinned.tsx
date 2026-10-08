"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { useScrub, WordReveal } from "./TigerMotion";
import shared from "./shared.module.css";
import styles from "./TigerPinned.module.css";

const DISH = "/images/demo/dishes/homard-bleu-bisque-fenouil.png";

/* Pinned cinematic scroll sequence — mirrors the reference's jar sequence:
   the product visual rotates (scrub 1:1) while giant statements crossfade. */
export function TigerPinned() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const progress = useScrub(wrapRef);
  const rotY = progress * 360;
  const stage = Math.min(2, Math.floor(progress * 3));

  return (
    <div ref={wrapRef} className={styles.pinWrap} aria-label="Séquence produit">
      <div className={`${styles.stage} ${shared.rustBg} ${shared.grain}`}>
        <div className={styles.dishOrbit} aria-hidden="true">
          <div
            className={styles.dishSpin}
            style={{ transform: `rotateY(${rotY.toFixed(1)}deg)` }}
          >
            <Image
              src={DISH}
              alt=""
              width={760}
              height={760}
              className={styles.dish}
              priority
            />
          </div>
        </div>

        {/* Stage 1 — statement left, badges + paragraph bottom-left */}
        <div className={`${styles.panel} ${stage === 0 ? styles.panelOn : ""}`}>
          <WordReveal
            text="UNE NOUVELLE FAÇON DE VOIR"
            className={`${shared.giantTitle} ${styles.statement}`}
            dimClassName={styles.dim}
            litClassName={styles.lit}
          />
          <div className={styles.badges}>
            {[DISH,
              "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
              "/images/demo/dishes/souffle-chocolat-grand-cru.png"
            ].map((src) => (
              <span key={src} className={shared.badge}>
                <Image src={src} alt="" width={64} height={64} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
              </span>
            ))}
          </div>
          <p className={shared.caps}>
            Scannez. Découvrez. Donnez envie — avant même la première bouchée.
          </p>
        </div>

        {/* Stage 2 — jungle-texture statement, paragraph + CTA right */}
        <div className={`${styles.panel} ${styles.panelRight} ${stage === 1 ? styles.panelOn : ""}`}>
          <h2 className={`${shared.giantTitle} ${styles.statement} ${styles.jungle}`} aria-label="Révélez l'expérience">
            Révélez
            <br />
            l&rsquo;expérience
          </h2>
          <p className={shared.caps}>
            Des fiches plats visuelles, des prix clairs, une identité fidèle au lieu.
          </p>
          <Link href="/prendre-rendez-vous" className={shared.pill}>
            Prendre rendez-vous
          </Link>
        </div>

        {/* Stage 3 — statement left */}
        <div className={`${styles.panel} ${stage === 2 ? styles.panelOn : ""}`}>
          <WordReveal
            text="UN NOUVEAU REGARD SUR LA CARTE"
            className={`${shared.giantTitle} ${styles.statement}`}
            dimClassName={styles.dim}
            litClassName={styles.lit}
          />
          <p className={shared.caps}>
            Le QR code n&rsquo;est pas le problème. Ce qui compte, c&rsquo;est ce
            que le client découvre après le scan.
          </p>
        </div>
      </div>
    </div>
  );
}
