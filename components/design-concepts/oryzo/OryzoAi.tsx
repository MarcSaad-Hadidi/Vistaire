"use client";

import Image from "next/image";
import { useState } from "react";
import { OryzoReveal } from "./OryzoReveal";
import styles from "./OryzoAi.module.css";

/**
 * "PENSÉE POUR LE SERVICE*" — mirrors oryzo.ai's "Powered by AI*":
 * centered giant title, orange VISTAIRE-1 tag, aurora viewport halo,
 * central visual with hover invitation, footnote bottom-right.
 */
export function OryzoAi(): React.JSX.Element {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  return (
    <section className={styles.ai} aria-label="Pensée pour le service">
      <div className={styles.aurora} aria-hidden="true" />

      <OryzoReveal className={styles.head}>
        <h2 className={styles.title}>
          Pensée pour
          <br />
          le service<sup className={styles.star}>*</sup>
        </h2>
        <p className={styles.tag}>VISTAIRE-1</p>
      </OryzoReveal>

      <div
        className={styles.visual}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setTilt({
            x: ((e.clientY - r.top) / r.height - 0.5) * -10,
            y: ((e.clientX - r.left) / r.width - 0.5) * 10
          });
        }}
        onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      >
        <div
          className={styles.visualInner}
          style={{
            transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`
          }}
        >
          <Image
            src="/images/demo/dishes/ravioles-chevre-miel-monteregie.png"
            alt="Ravioles dressées avec soin dans une assiette sombre"
            fill
            sizes="(max-width: 900px) 70vw, 420px"
            className={styles.photo}
          />
        </div>
      </div>

      <div className={styles.hoverHint}>
        <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
          <path
            d="M14 22V11a2.5 2.5 0 015 0v9m0-4a2.5 2.5 0 015 0v4m0-1a2.5 2.5 0 015 0v6c0 7-4 12-10 12-4.5 0-7-2.5-9-6l-3.5-6.5c-.8-1.5.5-3 2-2.2L14 22z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className={styles.hoverRule} />
        <p className={styles.hoverText}>ESSAYEZ DE SURVOLER LE PLAT</p>
      </div>

      <OryzoReveal className={styles.side} delay={120}>
        <p className={styles.sideText}>
          LE QR CODE NE FAIT PAS TOUT.
          <br />
          CE QUI COMPTE,
          <br />
          C&rsquo;EST APRÈS LE SCAN.
        </p>
      </OryzoReveal>

      <p className={styles.footnote}>
        <span className={styles.footnoteRule} />* SANS APPLICATION
      </p>
    </section>
  );
}
