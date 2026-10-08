"use client";

import { useRef } from "react";
import Image from "next/image";
import { LANDING_COPY } from "@/lib/landing/landingCopy";
import { useScrub } from "./useScrub";
import styles from "./OryzoManifesto.module.css";

const copy = LANDING_COPY.fr.value;

function pad(index: number): string {
  return String(index + 1).padStart(2, "0");
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Concept Oryzo — pinned manifesto (signature scrub section).
 *
 * 300vh pinned: a sticky 100vh stage where the framed dish visual rotates in
 * 3D (rotateX 25° → 205°, near-profile at the ~80–90° midpoint, scale 1 → 1.4)
 * scrubbed 1:1 to the scroll position, while the side texts fade in with an
 * opacity stagger. Mirrors oryzo.ai's scroll-driven 3D rotation, adapted to
 * Vistaire content (the "coaster" becomes a framed signature dish; its back
 * face carries a playful spec sheet).
 */
export function OryzoManifesto(): React.JSX.Element {
  const flipRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLParagraphElement | null>(null);
  const specRefs = useRef<Array<HTMLLIElement | null>>([]);

  const sectionRef = useScrub<HTMLElement>((p) => {
    const smallScreen = window.innerWidth < 640;
    const amplitude = smallScreen ? 140 : 180;
    if (flipRef.current) {
      flipRef.current.style.transform =
        `rotateX(${(25 + amplitude * p).toFixed(2)}deg) ` +
        `scale(${(1 + 0.4 * p).toFixed(3)})`;
    }
    if (headRef.current) {
      const t = clamp01(p / 0.25);
      headRef.current.style.opacity = t.toFixed(3);
      headRef.current.style.transform = `translateY(${((1 - t) * 28).toFixed(1)}px)`;
    }
    if (bodyRef.current) {
      const t = clamp01((p - 0.15) / 0.25);
      bodyRef.current.style.opacity = t.toFixed(3);
      bodyRef.current.style.transform = `translateY(${((1 - t) * 20).toFixed(1)}px)`;
    }
    specRefs.current.forEach((li, index) => {
      if (!li) return;
      const t = clamp01((p - (0.3 + index * 0.1)) / 0.25);
      li.style.opacity = t.toFixed(3);
      li.style.transform = `translateY(${((1 - t) * 18).toFixed(1)}px)`;
    });
  });

  return (
    <section ref={sectionRef} className={styles.pin} aria-label="Manifeste">
      <div className={styles.sticky}>
        <div className={styles.stage}>
          <div ref={headRef} className={styles.head}>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h2 className={styles.title}>{copy.title}</h2>
          </div>
          <p ref={bodyRef} className={styles.body}>
            {copy.body}
          </p>

          <div className={styles.visualZone}>
            <div ref={flipRef} className={styles.flip}>
              <figure className={`${styles.face} ${styles.front}`}>
                <span
                  className={`${styles.handle} ${styles.tl}`}
                  aria-hidden="true"
                />
                <span
                  className={`${styles.handle} ${styles.tr}`}
                  aria-hidden="true"
                />
                <span
                  className={`${styles.handle} ${styles.bl}`}
                  aria-hidden="true"
                />
                <span
                  className={`${styles.handle} ${styles.br}`}
                  aria-hidden="true"
                />
                <div className={styles.frameMedia}>
                  <Image
                    src="/images/demo/dishes/souffle-chocolat-grand-cru.png"
                    alt="Soufflé au chocolat présenté dans une vaisselle sombre"
                    fill
                    sizes="(min-width: 1024px) 30vw, 68vw"
                    className={styles.frameImg}
                  />
                </div>
                <figcaption className={styles.caption}>
                  FIG. 01 — SOUFFLÉ CHOCOLAT GRAND CRU
                </figcaption>
              </figure>
              <div
                className={`${styles.face} ${styles.back}`}
                aria-hidden="true"
              >
                <p className={styles.backLabel}>DOS — FICHE TECHNIQUE</p>
                <p className={styles.backSpec}>
                  PLAT_SIGNATURE.PSD
                  <br />
                  CALQUE 04 — 300 DPI
                  <br />
                  PRÊT POUR LE MENU
                </p>
                <p className={styles.backStamp}>VISTAIRE ✓</p>
              </div>
            </div>
          </div>

          <ol className={styles.specList}>
            {copy.items.map((item, index) => (
              <li
                key={item}
                ref={(el) => {
                  specRefs.current[index] = el;
                }}
                className={styles.specRow}
              >
                <span className={styles.specIndex}>{pad(index)}</span>
                <span className={styles.specText}>{item}</span>
              </li>
            ))}
          </ol>
          <p className={styles.footnote}>
            * AUCUN PDF N’A ÉTÉ MALTRAITÉ PENDANT LA CONCEPTION DE CETTE CARTE.
          </p>
        </div>
      </div>
    </section>
  );
}
