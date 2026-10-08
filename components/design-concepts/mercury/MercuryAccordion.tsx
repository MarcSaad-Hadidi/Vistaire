"use client";

import { useState } from "react";
import Image from "next/image";
import shared from "./shared.module.css";
import styles from "./MercuryAccordion.module.css";
import { Reveal } from "./MercuryReveal";

const ITEMS = [
  {
    title: "Fiches plats riches",
    body: "Ingrédients, description, prix et allergènes réunis dans une lecture claire.",
    image: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
    alt: "Homard dressé dans une assiette gastronomique"
  },
  {
    title: "3D / AR sélective",
    body: "Déclenchée par intention sur les plats pertinents, avec une image de repli.",
    image: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
    alt: "Ravioles dressées avec soin dans une assiette sombre"
  },
  {
    title: "Disponibilités en un geste",
    body: "Mettez à jour le contenu et la disponibilité de la carte.",
    image: "/images/demo/dishes/canette-rotie-figues-epices.png",
    alt: "Canette rôtie aux figues et aux épices"
  },
  {
    title: "FR + EN, sans application",
    body: "Une carte facile à faire évoluer et agréable à découvrir, sans application.",
    image: "/images/demo/dishes/souffle-chocolat-grand-cru.png",
    alt: "Soufflé au chocolat présenté dans une vaisselle sombre"
  }
] as const;

/**
 * Product accordion + sticky visual: left items expand on click
 * (400ms ease-out, others collapse); right sticky visual crossfades
 * (400ms fade + slight scale) to the matching dish photo.
 */
export function MercuryAccordion() {
  const [open, setOpen] = useState(0);

  return (
    <section
      data-mercury-theme="light"
      className={styles.section}
      aria-labelledby="mercury-accordion-title"
    >
      <div className={styles.inner}>
        <Reveal>
          <p className={`${shared.eyebrow} ${styles.eyebrow}`}>La carte</p>
        </Reveal>
        <Reveal delay={100}>
          <h2
            id="mercury-accordion-title"
            className={`${shared.serif} ${styles.title}`}
          >
            Tout ce que fait votre carte.
            <br />
            Au même endroit.
          </h2>
        </Reveal>

        <div className={styles.grid}>
          <div className={styles.accordion}>
            {ITEMS.map((item, i) => {
              const isOpen = open === i;
              return (
                <Reveal key={item.title} delay={i * 100}>
                  <div
                    className={styles.item}
                    data-open={isOpen ? "true" : "false"}
                  >
                    <button
                      type="button"
                      className={styles.header}
                      aria-expanded={isOpen}
                      onClick={() => setOpen(i)}
                    >
                      <span className={styles.itemTitle}>{item.title}</span>
                      <span
                        className={`${styles.plus} ${isOpen ? styles.plusOpen : ""}`}
                        aria-hidden="true"
                      >
                        <svg
                          viewBox="0 0 16 16"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        >
                          <path d="M8 3v10M3 8h10" />
                        </svg>
                      </span>
                    </button>
                    <div className={styles.body}>
                      <div className={styles.bodyInner}>
                        <p className={styles.itemBody}>{item.body}</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>

          <div className={styles.visualCol}>
            <div className={styles.visualSticky}>
              {ITEMS.map((item, i) => (
                <div
                  key={item.title}
                  className={`${styles.visual} ${open === i ? styles.visualActive : ""}`}
                  aria-hidden={open !== i}
                >
                  <Image
                    src={item.image}
                    alt={item.alt}
                    fill
                    sizes="(max-width: 900px) 100vw, 44vw"
                    style={{ objectFit: "cover" }}
                    priority={i === 0}
                  />
                </div>
              ))}
              <div className={shared.grain} aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
