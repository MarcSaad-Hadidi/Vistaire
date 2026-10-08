"use client";

import Image from "next/image";
import { useRef } from "react";
import { useScrub } from "./useScrub";
import styles from "./OryzoWearable.module.css";

const CARDS = [
  {
    src: "/images/demo/dishes/risotto-cepes-parmesan.png",
    alt: "Risotto aux cèpes servi avec élégance",
    caption: "FICHE PLAT",
    title: "RISOTTO CÈPES",
    meta: "PARMESAN · 32 €",
    chat: null
  },
  {
    src: "/images/demo/dishes/tartare-saumon-label-rouge.png",
    alt: "Tartare de saumon label rouge, dressage raffiné",
    caption: "FICHE PLAT",
    title: "TARTARE SAUMON",
    meta: "LABEL ROUGE · 28 €",
    chat: null
  },
  {
    src: "/images/demo/dishes/pave-boeuf-mature-bordelaise.png",
    alt: "Pavé de bœuf maturé, sauce bordelaise",
    caption: "FICHE PLAT",
    title: "PAVÉ DE BŒUF",
    meta: "MATURÉ · 46 €",
    chat: {
      question: "VISTAIRE, AFFICHER LES ALLERGÈNES ?",
      cta: "ENVOYER"
    }
  },
  {
    src: "/images/demo/dishes/tarte-citron-basilic-pourpre.png",
    alt: "Tarte au citron et basilic pourpre",
    caption: "FICHE PLAT",
    title: "TARTE CITRON",
    meta: "BASILIC POURPRE · 14 €",
    chat: null
  },
  {
    src: "/images/demo/dishes/canette-rotie-figues-epices.png",
    alt: "Canette rôtie aux figues et épices",
    caption: "FICHE PLAT",
    title: "CANETTE RÔTIE",
    meta: "FIGUES · 42 €",
    chat: null
  },
  {
    src: "/images/demo/dishes/elixir-bergamote-earl-grey.png",
    alt: "Élixir à la bergamote et earl grey",
    caption: "FICHE PLAT",
    title: "ÉLIXIR BERGAMOTE",
    meta: "EARL GREY · 12 €",
    chat: null
  }
] as const;

/**
 * Pinned 350vh horizontal carousel — "c'est instantané".
 * Left text panel fixed; cards translateX scrubbed 1:1; the card nearest
 * the viewport center grows to full size inside a dotted selection frame;
 * a giant kinetic title drifts behind at a slower rate.
 */
export function OryzoWearable(): React.JSX.Element {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const bigRef = useRef<HTMLHeadingElement | null>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);

  const sectionRef = useScrub((p) => {
    const track = trackRef.current;
    if (track) {
      const max = Math.max(0, track.scrollWidth - window.innerWidth);
      track.style.transform = `translate3d(${(-p * max).toFixed(1)}px, 0, 0)`;
    }
    if (bigRef.current) {
      bigRef.current.style.transform = `translate3d(${(-p * window.innerWidth * 0.55).toFixed(1)}px, 0, 0)`;
    }
    // Enlarge the card closest to the viewport center
    const vw = window.innerWidth;
    let best = 0;
    let bestDist = Infinity;
    cardRefs.current.forEach((card) => {
      if (!card) return;
      const r = card.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - vw / 2);
      if (d < bestDist) {
        bestDist = d;
        best = cardRefs.current.indexOf(card);
      }
    });
    cardRefs.current.forEach((card, i) => {
      if (!card) return;
      const active = i === best;
      card.classList.toggle(styles.cardActive, active);
    });
  });

  return (
    <section
      ref={sectionRef as React.RefObject<HTMLElement>}
      className={styles.pin}
      aria-label="C'est instantané"
    >
      <div className={styles.stage}>
        <h2 ref={bigRef} className={styles.big} aria-hidden="true">
          c&rsquo;est instantané
        </h2>

        <div className={styles.left}>
          <p className={styles.kicker}>SANS APPLICATION,</p>
          <p className={styles.sub}>c&rsquo;est instantané</p>
        </div>

        <div ref={trackRef} className={styles.track}>
          {CARDS.map((card, i) => (
            <div
              key={card.title}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className={styles.card}
            >
              <div className={styles.frame}>
                <span className={`${styles.handle} ${styles.hTl}`} />
                <span className={`${styles.handle} ${styles.hTr}`} />
                <span className={`${styles.handle} ${styles.hBl}`} />
                <span className={`${styles.handle} ${styles.hBr}`} />
                <Image
                  src={card.src}
                  alt={card.alt}
                  fill
                  sizes="(max-width: 900px) 70vw, 420px"
                  className={styles.photo}
                />
                <div className={styles.cardInfo}>
                  <p className={styles.cardCaption}>{card.caption}</p>
                  <p className={styles.cardTitle}>{card.title}</p>
                  <p className={styles.cardMeta}>{card.meta}</p>
                </div>
                {card.chat && (
                  <div className={styles.chat}>
                    <p className={styles.chatQ}>
                      <span className={styles.chatBrand}>VISTAIRE,</span>{" "}
                      AFFICHER LES ALLERGÈNES ?
                    </p>
                    <button type="button" className={styles.chatCta}>
                      {card.chat.cta}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <a href="#atouts" className={styles.scrollCue}>
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
      </div>
    </section>
  );
}
