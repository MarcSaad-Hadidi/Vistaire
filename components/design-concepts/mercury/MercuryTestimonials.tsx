"use client";

import { useState } from "react";
import Image from "next/image";
import shared from "./shared.module.css";
import styles from "./MercuryTestimonials.module.css";
import { Reveal } from "./MercuryReveal";

const QUOTES = [
  {
    text: "La carte donne envie avant même d'avoir commandé. Nos clients la montrent à leurs amis.",
    name: "Claire D.",
    role: "Convive",
    image: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
    alt: "Homard dressé dans une assiette gastronomique"
  },
  {
    text: "On a retiré un plat épuisé entre deux services, en quelques secondes.",
    name: "Mehdi R.",
    role: "Restaurateur",
    image: "/images/demo/dishes/pave-boeuf-mature-bordelaise.png",
    alt: "Pavé de bœuf maturé, sauce bordelaise"
  },
  {
    text: "Enfin un QR code qui ne mène pas à un PDF flou.",
    name: "Sofia L.",
    role: "Convive",
    image: "/images/demo/dishes/tarte-citron-basilic-pourpre.png",
    alt: "Tarte au citron et basilic pourpre"
  }
] as const;

/**
 * Testimonial carousel: 3 tabs as horizontal progress bars
 * (active white, inactive dimmed); manual click crossfades image + text
 * (400ms). No auto-rotation.
 */
export function MercuryTestimonials() {
  const [active, setActive] = useState(0);
  const quote = QUOTES[active];

  return (
    <section
      data-mercury-theme="dark"
      className={styles.section}
      aria-labelledby="mercury-quotes-title"
    >
      <div className={styles.inner}>
        <Reveal>
          <p className={`${shared.eyebrow} ${styles.eyebrow}`}>Ils en parlent</p>
        </Reveal>
        <Reveal delay={100}>
          <h2
            id="mercury-quotes-title"
            className={`${shared.serif} ${styles.title}`}
          >
            Des cartes qui marquent les esprits.
          </h2>
        </Reveal>

        <Reveal delay={200}>
          <div
            className={styles.tabs}
            role="tablist"
            aria-label="Témoignages"
          >
            {QUOTES.map((q, i) => (
              <button
                key={q.name}
                type="button"
                role="tab"
                aria-selected={active === i}
                className={`${styles.tab} ${active === i ? styles.tabActive : ""}`}
                onClick={() => setActive(i)}
              >
                <span className={styles.tabLabel}>{q.name}</span>
              </button>
            ))}
          </div>
        </Reveal>

        <div
          key={active}
          className={styles.panel}
          role="tabpanel"
          aria-live="polite"
        >
          <div className={styles.photo}>
            <Image
              src={quote.image}
              alt={quote.alt}
              fill
              sizes="(max-width: 900px) 100vw, 40vw"
              style={{ objectFit: "cover" }}
            />
            <div className={shared.grain} aria-hidden="true" />
          </div>
          <div className={styles.copy}>
            <blockquote className={`${shared.serif} ${styles.quote}`}>
              «&nbsp;{quote.text}&nbsp;»
            </blockquote>
            <p className={styles.author}>
              {quote.name} <span className={styles.role}>— {quote.role}</span>
            </p>
            <p className={styles.disclaimer}>Reconstitution illustrative</p>
          </div>
        </div>
      </div>
    </section>
  );
}
