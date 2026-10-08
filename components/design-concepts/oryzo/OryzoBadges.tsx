import Image from "next/image";
import { OryzoReveal } from "./OryzoReveal";
import styles from "./OryzoBadges.module.css";

const BADGES = [
  {
    src: "/images/demo/dishes/souffle-chocolat-grand-cru.png",
    alt: "Soufflé au chocolat servi en salle",
    tint: "rgba(90, 90, 30, 0.35)",
    topLeft: "EN SALLE",
    topMid: "SERVICE : MIDI ET SOIR",
    topRight: "DÉGÂTS : AUCUN ;)",
    title: "Testée en salle"
  },
  {
    src: "/images/demo/dishes/tartare-saumon-label-rouge.png",
    alt: "Tartare de saumon photographié pour la carte",
    tint: "rgba(120, 40, 20, 0.3)",
    topLeft: "STUDIO",
    topMid: "PHOTOS : APPÉTISSANTES",
    topRight: "FILTRE : AUCUN",
    title: "Photos premium"
  },
  {
    src: "/images/demo/dishes/negroni-vieilli-fut.png",
    alt: "Negroni vieilli en fût, sans application requise",
    tint: "rgba(150, 40, 15, 0.35)",
    topLeft: "NAVIGATEUR",
    topMid: "APPLICATION : AUCUNE",
    topRight: "DEPUIS : TOUJOURS",
    title: "Zéro application"
  }
] as const;

/**
 * Full-bleed badge strip — mirrors oryzo.ai's "Drop-Tested" cards:
 * wide photo cards with small-caps meta labels and a giant title
 * overlapping the imagery.
 */
export function OryzoBadges(): React.JSX.Element {
  return (
    <section className={styles.badges} aria-label="Preuves">
      <div className={styles.strip}>
        {BADGES.map((badge) => (
          <OryzoReveal key={badge.title} className={styles.card}>
            <div className={styles.photo}>
              <Image
                src={badge.src}
                alt={badge.alt}
                fill
                sizes="(max-width: 900px) 100vw, 34vw"
                className={styles.photoImg}
              />
              <div
                className={styles.tint}
                style={{ background: badge.tint }}
                aria-hidden="true"
              />
              <div className={styles.meta}>
                <span>{badge.topLeft}</span>
                <span>{badge.topMid}</span>
                <span>{badge.topRight}</span>
              </div>
              <h3 className={styles.title}>{badge.title}</h3>
            </div>
          </OryzoReveal>
        ))}
      </div>
    </section>
  );
}
