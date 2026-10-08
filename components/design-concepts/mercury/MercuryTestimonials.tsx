"use client";

import Image from "next/image";
import { useState } from "react";
import shared from "./shared.module.css";
import styles from "./MercuryTestimonials.module.css";
import { MercuryReveal } from "./MercuryReveal";

const QUOTES = [
  {
    quote:
      "« La carte donne envie avant même d'avoir commandé. Nos clients photographient les plats avant de les recevoir. »",
    name: "Convive, table de quatre",
    detail: "Reconstitution illustrative — avis fictif",
    image: "/images/landing/maison-elyse-experience.jpg",
    alt: "Salle de restaurant chaleureuse"
  },
  {
    quote:
      "« Fini le PDF flou. Le QR ouvre une carte claire, dans la langue de chacun, avec les allergènes en évidence. »",
    name: "Restauratrice fictive",
    detail: "Reconstitution illustrative — avis fictif",
    image: "/images/landing/sauge-noire-experience.jpg",
    alt: "Intérieur de restaurant à la tombée du jour"
  },
  {
    quote:
      "« Je choisis en confiance, sans devoir appeler le serveur pour chaque allergène. C'est apaisant. »",
    name: "Cliente cœliaque",
    detail: "Reconstitution illustrative — avis fictif",
    image: "/images/landing/trouvable-experience.jpg",
    alt: "Table dressée dans un restaurant"
  }
];

/**
 * Testimonial carousel: 3 progress-bar tabs, manual click,
 * crossfade image + text (~400ms). No auto-rotation.
 */
export function MercuryTestimonials() {
  const [active, setActive] = useState(0);

  return (
    <section className={shared.section} data-mtheme="dark" aria-label="Témoignages">
      <div className={shared.wrap}>
        <MercuryReveal>
          <div className={styles.stage}>
            {QUOTES.map((q, i) => (
              <figure
                key={q.name}
                className={`${styles.card} ${i === active ? styles.cardActive : ""}`}
                aria-hidden={i !== active}
              >
                <Image
                  src={q.image}
                  alt={i === active ? q.alt : ""}
                  fill
                  sizes="(max-width: 900px) 100vw, 1336px"
                  style={{ objectFit: "cover" }}
                  priority={i === 0}
                />
                <div className={styles.scrim} aria-hidden="true" />
                <figcaption className={styles.caption}>
                  <blockquote className={styles.quote}>{q.quote}</blockquote>
                  <div className={styles.name}>{q.name}</div>
                  <div className={styles.detail}>{q.detail}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </MercuryReveal>

        <div className={styles.tabs} role="tablist" aria-label="Choisir un témoignage">
          {QUOTES.map((q, i) => (
            <button
              key={q.name}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Témoignage ${i + 1}`}
              className={`${styles.tab} ${i === active ? styles.tabActive : ""}`}
              onClick={() => setActive(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
