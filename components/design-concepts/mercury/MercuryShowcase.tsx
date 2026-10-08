import Image from "next/image";
import shared from "./shared.module.css";
import styles from "./MercuryShowcase.module.css";
import { MercuryReveal } from "./MercuryReveal";

export type ShowcaseCard = {
  title: string;
  text: string;
  visual: "photo" | "sonar" | "chips" | "toggles";
  image?: string;
  alt?: string;
  wide?: boolean;
};

function Visual({ card }: { card: ShowcaseCard }) {
  if (card.visual === "photo" && card.image) {
    return (
      <div className={styles.visual}>
        <Image
          src={card.image}
          alt={card.alt ?? ""}
          fill
          sizes="(max-width: 900px) 100vw, 50vw"
          style={{ objectFit: "cover" }}
        />
      </div>
    );
  }
  if (card.visual === "sonar") {
    return (
      <div className={`${styles.visual} ${styles.visualDark} ${shared.grain}`}>
        <div className={shared.sonar} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className={styles.sonarCore} aria-hidden="true" />
      </div>
    );
  }
  if (card.visual === "chips") {
    return (
      <div className={`${styles.visual} ${styles.visualLight}`}>
        <div className={`${styles.chip} ${shared.chipFloat}`}>
          <span className={styles.spark} aria-hidden="true">
            ✦
          </span>
          Allergènes affichés
        </div>
        <div className={`${styles.chip} ${styles.chipB} ${shared.chipFloat2}`}>
          <span className={styles.spark} aria-hidden="true">
            ✦
          </span>
          Prix à jour
        </div>
      </div>
    );
  }
  return (
    <div className={`${styles.visual} ${styles.visualLight}`}>
      <div className={styles.toggleRow}>
        <span className={styles.toggleLabel}>Disponible</span>
        <span className={`${styles.toggle} ${styles.toggleOn}`} aria-hidden="true">
          <span className={styles.knob} />
        </span>
      </div>
      <div className={styles.toggleRow}>
        <span className={styles.toggleLabel}>Épuisé</span>
        <span className={styles.toggle} aria-hidden="true">
          <span className={styles.knob} />
        </span>
      </div>
    </div>
  );
}

/**
 * Two-column card grid with hairline divider above and section title —
 * mirrors Mercury's "Banking's been a headache" / "Run your business" blocks.
 */
export function MercuryShowcase({
  theme,
  title,
  cards
}: {
  theme: "dark" | "light";
  title: string;
  cards: ShowcaseCard[];
}) {
  const light = theme === "light";
  return (
    <section
      data-mtheme={theme}
      className={`${shared.section} ${light ? shared.sectionLight : ""} ${light ? styles.light : ""}`}
      aria-label={title}
    >
      <div className={shared.wrap}>
        {light ? null : <div className={styles.rule} aria-hidden="true" />}
        <MercuryReveal as="h2" className={shared.title}>
          {title}
        </MercuryReveal>
        <div className={styles.grid}>
          {cards.map((card, i) => (
            <MercuryReveal
              key={card.title}
              delay={(i % 2) * 100}
              className={card.wide ? styles.wide : ""}
            >
              <article className={styles.card}>
                <Visual card={card} />
                <div className={styles.caption}>
                  <h3 className={styles.cardTitle}>{card.title}</h3>
                  <p className={styles.cardText}>{card.text}</p>
                </div>
              </article>
            </MercuryReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
