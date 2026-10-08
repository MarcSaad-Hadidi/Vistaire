"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { LANDING_COPY } from "@/lib/landing/landingCopy";
import { useScrub } from "./useScrub";
import styles from "./OryzoHorizontal.module.css";

const experiencesCopy = LANDING_COPY.fr.experiences;
const dishesCopy = LANDING_COPY.fr.dishes;
const finalCopy = LANDING_COPY.fr.finalCta;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

type Card = {
  kind: "intro" | "photo" | "outro";
  index: string;
  title: string;
  body: string;
  image?: string;
  alt?: string;
  badge?: string;
  cta?: { href: string; label: string };
};

const CARDS: Array<Card> = [
  {
    kind: "intro",
    index: "01",
    title: "Faites défiler.",
    body: "Le geste vertical devient travelling horizontal — piloté au pixel près par votre défilement, réversible à volonté."
  },
  {
    kind: "photo",
    index: "02",
    title: "Sauge Noire",
    body: "Cuisine d’auteur, carte sombre, zéro compromis.",
    image: "/images/demo/dishes/pave-boeuf-mature-bordelaise.png",
    alt: "Pavé de bœuf maturé, sauce bordelaise",
    badge: "EXP. 01",
    cta: { href: "/demo", label: experiencesCopy.cta }
  },
  {
    kind: "photo",
    index: "03",
    title: dishesCopy.items[0].title,
    body: dishesCopy.items[0].body,
    image: dishesCopy.items[0].image,
    alt: dishesCopy.items[0].alt,
    badge: "SPÉCIMEN 01"
  },
  {
    kind: "photo",
    index: "05",
    title: "Maison Élysée",
    body: "Grande maison, carte claire, service millimétré.",
    image: "/images/demo/dishes/tartare-saumon-label-rouge.png",
    alt: "Tartare de saumon Label Rouge",
    badge: "EXP. 02",
    cta: { href: "/demo", label: experiencesCopy.cta }
  },
  {
    kind: "photo",
    index: "06",
    title: dishesCopy.items[2].title,
    body: dishesCopy.items[2].body,
    image: dishesCopy.items[2].image,
    alt: dishesCopy.items[2].alt,
    badge: "SPÉCIMEN 03"
  },
  {
    kind: "outro",
    index: "07",
    title: finalCopy.title,
    body: finalCopy.body,
    cta: { href: "/prendre-rendez-vous", label: finalCopy.cta }
  }
];

/**
 * Concept Oryzo — pinned horizontal carousel (signature scrub section).
 *
 * 350vh pinned: vertical scroll drives the card track horizontally, scrubbed
 * 1:1 (x: 0 → -(trackWidth - 100vw)). A giant background wordmark drifts at a
 * slower speed for parallax. One card flips in 3D (rotateY 0° → 180°),
 * scrubbed across the window where the card crosses the viewport — fully
 * reversible. Mirrors oryzo.ai's pinned horizontal scroll, adapted to
 * Vistaire's experiences, dish specimens and spec language.
 */
export function OryzoHorizontal(): React.JSX.Element {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const bgRef = useRef<HTMLDivElement | null>(null);
  const flipSlotRef = useRef<HTMLDivElement | null>(null);
  const flipInnerRef = useRef<HTMLDivElement | null>(null);
  const counterRef = useRef<HTMLSpanElement | null>(null);
  const markerRef = useRef<HTMLSpanElement | null>(null);

  const sectionRef = useScrub<HTMLElement>((p) => {
    const vw = window.innerWidth || 1;
    const track = trackRef.current;
    const viewport = viewportRef.current;
    if (track && viewport) {
      const maxX = Math.max(0, track.scrollWidth - viewport.clientWidth);
      track.style.transform = `translate3d(${(-p * maxX).toFixed(1)}px, 0, 0)`;
    }
    if (bgRef.current) {
      bgRef.current.style.transform = `translate3d(${((0.15 - 0.6 * p) * vw).toFixed(1)}px, -50%, 0)`;
    }
    if (flipSlotRef.current && flipInnerRef.current) {
      const rect = flipSlotRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const t = clamp01((vw * 0.85 - centerX) / (vw * 0.7));
      flipInnerRef.current.style.transform = `rotateY(${(t * 180).toFixed(2)}deg)`;
    }
    if (counterRef.current) {
      const n = Math.min(CARDS.length + 1, Math.floor(p * (CARDS.length + 1)) + 1);
      counterRef.current.textContent = `${String(n).padStart(2, "0")} / ${String(CARDS.length + 1).padStart(2, "0")}`;
    }
    if (markerRef.current) {
      markerRef.current.style.left = `${(p * 100).toFixed(2)}%`;
    }
  });

  return (
    <section
      ref={sectionRef}
      className={styles.pin}
      aria-label="La carte en travelling"
    >
      <div className={styles.sticky}>
        <div className={styles.bgText} ref={bgRef} aria-hidden="true">
          VISTAIRE&nbsp;&nbsp;—&nbsp;&nbsp;CARTE&nbsp;DIGITALE&nbsp;&nbsp;—&nbsp;&nbsp;VISTAIRE
        </div>
        <div className={styles.stage}>
          <header className={styles.head}>
            <p className={styles.eyebrow}>TRAVELLING — DÉFILEMENT PILOTÉ</p>
            <h2 className={styles.title}>La carte, en travelling.</h2>
          </header>

          <div ref={viewportRef} className={styles.viewport}>
            <div ref={trackRef} className={styles.track}>
              {CARDS.slice(0, 3).map((card) => (
                <CardView key={card.index} card={card} total={CARDS.length + 1} />
              ))}

              {/* Flip card — index 04: scrubbed rotateY 0° → 180° */}
              <div ref={flipSlotRef} className={styles.flipSlot}>
                <div ref={flipInnerRef} className={styles.flipInner}>
                  <article className={`${styles.card} ${styles.face} ${styles.front}`}>
                    <span className={styles.cardIndex}>04 / 07</span>
                    <div className={styles.cardMedia}>
                      <Image
                        src={dishesCopy.items[1].image}
                        alt={dishesCopy.items[1].alt}
                        fill
                        sizes="(min-width: 1024px) 30vw, 72vw"
                        className={styles.cardImg}
                      />
                    </div>
                    <p className={styles.cardBadge}>SPÉCIMEN 02 — SURVOLEZ EN SCROLLANT</p>
                    <h3 className={styles.cardTitle}>{dishesCopy.items[1].title}</h3>
                    <p className={styles.cardBody}>{dishesCopy.items[1].body}</p>
                  </article>
                  <article
                    className={`${styles.card} ${styles.face} ${styles.back}`}
                    aria-hidden="true"
                  >
                    <span className={styles.cardIndex}>04 / 07 — DOS</span>
                    <p className={styles.backLabel}>FICHE TECHNIQUE</p>
                    <ul className={styles.backSpec}>
                      <li>DÉCLENCHEMENT — PAR INTENTION</li>
                      <li>REPLI — IMAGE HD GARANTIE</li>
                      <li>POIDS — ALLÉGÉ, CHARGEMENT PARESSEUX</li>
                      <li>COMPATIBILITÉ — IOS + ANDROID</li>
                    </ul>
                    <p className={styles.backStamp}>VISTAIRE ✓</p>
                  </article>
                </div>
              </div>

              {CARDS.slice(3).map((card) => (
                <CardView key={card.index} card={card} total={CARDS.length + 1} />
              ))}
            </div>
          </div>

          <div className={styles.progress}>
            <span ref={counterRef} className={styles.counter}>
              01 / 07
            </span>
            <div className={styles.bar} aria-hidden="true">
              <span ref={markerRef} className={styles.marker} />
            </div>
            <span className={styles.hint}>DÉFILEZ ↓</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function CardView({ card, total }: { card: Card; total: number }): React.JSX.Element {
  if (card.kind === "intro") {
    return (
      <article className={`${styles.card} ${styles.introCard}`}>
        <span className={styles.cardIndex}>
          {card.index} / {String(total).padStart(2, "0")}
        </span>
        <p className={styles.introKicker}>SCROLL ↓</p>
        <h3 className={styles.cardTitle}>{card.title}</h3>
        <p className={styles.cardBody}>{card.body}</p>
        <div className={styles.introFrame} aria-hidden="true">
          <span className={styles.introHandle} />
          <span className={styles.introHandle} />
          <span className={styles.introHandle} />
          <span className={styles.introHandle} />
        </div>
      </article>
    );
  }
  if (card.kind === "outro") {
    return (
      <article className={`${styles.card} ${styles.outroCard}`}>
        <span className={styles.cardIndex}>
          {card.index} / {String(total).padStart(2, "0")}
        </span>
        <h3 className={styles.cardTitle}>{card.title}</h3>
        <p className={styles.cardBody}>{card.body}</p>
        {card.cta && (
          <Link href={card.cta.href} className={styles.pill}>
            {card.cta.label}
          </Link>
        )}
      </article>
    );
  }
  return (
    <article className={styles.card}>
      <span className={styles.cardIndex}>
        {card.index} / {String(total).padStart(2, "0")}
      </span>
      {card.image && (
        <div className={styles.cardMedia}>
          <Image
            src={card.image}
            alt={card.alt ?? ""}
            fill
            sizes="(min-width: 1024px) 30vw, 72vw"
            className={styles.cardImg}
          />
        </div>
      )}
      {card.badge && <p className={styles.cardBadge}>{card.badge}</p>}
      <h3 className={styles.cardTitle}>{card.title}</h3>
      <p className={styles.cardBody}>{card.body}</p>
      {card.cta && (
        <Link href={card.cta.href} className={styles.textLink}>
          {card.cta.label}
          <span aria-hidden="true"> →</span>
        </Link>
      )}
    </article>
  );
}
