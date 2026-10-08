"use client";

import Image from "next/image";
import { useRef } from "react";
import { useScrub } from "./useScrub";
import styles from "./OryzoCoaster.module.css";

/**
 * Pinned 300vh scrub section — "CE N'EST PAS QU'UNE CARTE."
 * The framed dish visual rotates rotateX 25°→205° + scale 1→1.4,
 * scrubbed 1:1 with scroll (reversible), like oryzo.ai's coaster.
 */
export function OryzoCoaster(): React.JSX.Element {
  const visualRef = useRef<HTMLDivElement | null>(null);
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);

  const sectionRef = useScrub((p) => {
    if (visualRef.current) {
      const rot = 25 + p * 180;
      const scale = 1 + p * 0.4;
      visualRef.current.style.transform = `rotateX(${rot.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    }
    if (leftRef.current) {
      const o = 0.35 + Math.min(1, p * 4) * 0.65;
      leftRef.current.style.opacity = o.toFixed(3);
    }
    if (rightRef.current) {
      const o = 0.3 + Math.min(1, Math.max(0, (p - 0.15) * 3)) * 0.7;
      rightRef.current.style.opacity = o.toFixed(3);
    }
  });

  return (
    <section
      id="coaster"
      ref={sectionRef as React.RefObject<HTMLElement>}
      className={styles.pin}
      aria-label="Ce n'est pas qu'une carte"
    >
      <div className={styles.stage}>
        <div ref={leftRef} className={styles.left}>
          <h2 className={styles.title}>
            CE N&rsquo;EST PAS
            <br />
            QU&rsquo;UNE CARTE.
          </h2>
        </div>

        <div className={styles.center}>
          <div className={styles.tilt}>
            <div ref={visualRef} className={styles.visual}>
              <div className={`${styles.face} ${styles.front}`}>
                <div className={styles.frame}>
                  <span className={`${styles.handle} ${styles.hTl}`} />
                  <span className={`${styles.handle} ${styles.hTr}`} />
                  <span className={`${styles.handle} ${styles.hBl}`} />
                  <span className={`${styles.handle} ${styles.hBr}`} />
                  <Image
                    src="/images/demo/dishes/souffle-chocolat-grand-cru.png"
                    alt="Soufflé au chocolat présenté dans une vaisselle sombre"
                    fill
                    sizes="(max-width: 900px) 80vw, 560px"
                    className={styles.photo}
                  />
                </div>
              </div>
              <div className={`${styles.face} ${styles.back}`}>
                <div className={styles.frame}>
                  <span className={`${styles.handle} ${styles.hTl}`} />
                  <span className={`${styles.handle} ${styles.hTr}`} />
                  <span className={`${styles.handle} ${styles.hBl}`} />
                  <span className={`${styles.handle} ${styles.hBr}`} />
                  <div className={styles.backCard}>
                    <p className={styles.backKicker}>FICHE PLAT</p>
                    <p className={styles.backTitle}>SOUFFLÉ CHOCOLAT</p>
                    <p className={styles.backMeta}>GRAND CRU · 18 €</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div ref={rightRef} className={styles.right}>
          <p className={styles.body}>
            Vistaire n&rsquo;est pas qu&rsquo;une carte. C&rsquo;est le soin du
            détail, du goût et du service — dans la poche de vos convives.
          </p>
        </div>

        <p className={styles.footnote}>
          <span className={styles.footnoteRule} />
          * SANS APPLICATION
        </p>
      </div>
    </section>
  );
}
