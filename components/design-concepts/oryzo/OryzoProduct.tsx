"use client";

import Image from "next/image";
import { useState } from "react";
import { OryzoReveal } from "./OryzoReveal";
import styles from "./OryzoProduct.module.css";

const VARIANTS = [
  {
    id: "essentiel",
    pill: "VISTAIRE",
    name: "VISTAIRE",
    photo: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
    photoAlt: "Homard bleu, bisque et fenouil",
    desc: "L'originale. Affinée jusqu'à l'évidence. Une carte claire, visuelle et fidèle à votre identité — mise à jour en un geste.",
    specs: [
      "Fiches plats visuelles",
      "QR code élégant",
      "Mise à jour en un geste"
    ],
    columns: [
      {
        title: "VISTAIRE",
        text: "Une carte. Un scan. Servie avec soin."
      },
      {
        title: "VISTAIRE Pro",
        text: "Deux fois plus de détails. Toujours aussi fluide."
      },
      {
        title: "VISTAIRE Pro Max",
        text: "Trois dimensions d'immersion. Pour les tables qui osent."
      }
    ]
  },
  {
    id: "pro",
    pill: "VISTAIRE PRO",
    name: "VISTAIRE PRO",
    photo: "/images/demo/dishes/bar-de-ligne-artichaut-citron.png",
    photoAlt: "Bar de ligne, artichaut et citron",
    desc: "La version enrichie : accords mets et vins, récits de plats, badges et traductions — pour les maisons qui racontent leur cuisine.",
    specs: [
      "Accords et récits de plats",
      "Multilingue",
      "Badges et disponibilités"
    ],
    columns: [
      {
        title: "VISTAIRE",
        text: "Une carte. Un scan. Servie avec soin."
      },
      {
        title: "VISTAIRE Pro",
        text: "Deux fois plus de détails. Toujours aussi fluide."
      },
      {
        title: "VISTAIRE Pro Max",
        text: "Trois dimensions d'immersion. Pour les tables qui osent."
      }
    ]
  },
  {
    id: "promax",
    pill: "VISTAIRE PRO MAX",
    name: "VISTAIRE PRO MAX",
    photo: "/images/demo/dishes/maison-elyse-n1.png",
    photoAlt: "Plat signature de la maison",
    desc: "L'expérience totale : 3D et réalité augmentée sélectives sur vos plats signatures, pour un moment que les convives n'oublient pas.",
    specs: [
      "3D / AR sur plats signatures",
      "Aperçu des signaux anonymes",
      "Plusieurs établissements"
    ],
    columns: [
      {
        title: "VISTAIRE",
        text: "Une carte. Un scan. Servie avec soin."
      },
      {
        title: "VISTAIRE Pro",
        text: "Deux fois plus de détails. Toujours aussi fluide."
      },
      {
        title: "VISTAIRE Pro Max",
        text: "Trois dimensions d'immersion. Pour les tables qui osent."
      }
    ]
  }
] as const;

/**
 * Product section — mirrors oryzo.ai's "CHOOSE YOU OWN":
 * selector pills, giant brand title over the product photo,
 * name + description left, spec rows right, comparison rows below.
 */
export function OryzoProduct(): React.JSX.Element {
  const [index, setIndex] = useState(0);
  const variant = VARIANTS[index];

  return (
    <section id="produit" className={styles.product} aria-label="Produit">
      <OryzoReveal>
        <p className={styles.kicker}>CHOISISSEZ LA VÔTRE</p>
        <h2 className={styles.giant} aria-hidden="true">
          <span className={styles.giantPhoto}>
            <Image
              src={variant.photo}
              alt=""
              fill
              sizes="40vw"
              className={styles.giantImg}
            />
          </span>
          VISTAIRE
        </h2>
      </OryzoReveal>

      <div
        className={styles.pills}
        role="tablist"
        aria-label="Choisir une version"
      >
        {VARIANTS.map((v, i) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            onClick={() => setIndex(i)}
            className={`${styles.pill} ${i === index ? styles.pillActive : ""}`}
          >
            {v.pill}
          </button>
        ))}
      </div>

      <div className={styles.detail}>
        <div className={styles.left}>
          <h3 className={styles.name}>{variant.name}</h3>
          <p className={styles.desc}>{variant.desc}</p>
        </div>
        <div className={styles.center}>
          <Image
            key={variant.id}
            src={variant.photo}
            alt={variant.photoAlt}
            fill
            sizes="(max-width: 900px) 80vw, 460px"
            className={`${styles.centerPhoto} ${styles.fadeIn}`}
          />
        </div>
        <ul className={styles.specs}>
          {variant.specs.map((spec) => (
            <li key={spec} className={styles.spec}>
              <span className={styles.specDot} aria-hidden="true" />
              {spec}
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.columns}>
        {variant.columns.map((col) => (
          <div key={col.title} className={styles.column}>
            <p className={styles.columnNew}>Nouveau</p>
            <h4 className={styles.columnTitle}>{col.title}</h4>
            <p className={styles.columnText}>{col.text}</p>
          </div>
        ))}
      </div>

      <div className={styles.compare}>
        <div className={styles.compareRow}>
          <p className={styles.compareLabel}>MISES À JOUR :</p>
          <p className={styles.compareValue}>INSTANTANÉES</p>
        </div>
        <div className={styles.compareRow}>
          <p className={styles.compareLabel}>IDÉAL POUR :</p>
          <p className={styles.compareValue}>
            LES TABLES QUI VEULENT PLUS QU&rsquo;UN PDF
          </p>
        </div>
      </div>
    </section>
  );
}
