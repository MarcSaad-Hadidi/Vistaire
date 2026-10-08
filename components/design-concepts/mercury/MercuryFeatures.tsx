import shared from "./shared.module.css";
import styles from "./MercuryFeatures.module.css";
import { InView, Reveal } from "./MercuryReveal";

function SonarVisual() {
  return (
    <div className={styles.stage} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`${styles.ring} ${styles.loop}`}
          style={{ animationDelay: `${(i * 0.66).toFixed(2)}s` }}
        />
      ))}
      <span className={styles.core} />
    </div>
  );
}

function ChipsVisual() {
  const chips = ["Sans application", "FR + EN", "QR → carte"];
  return (
    <div className={styles.stage} aria-hidden="true">
      {chips.map((label, i) => (
        <span
          key={label}
          className={`${styles.chip} ${styles.loop} ${styles[`chip${i}`] ?? ""}`}
          style={{ animationDelay: `${(i * 0.9).toFixed(1)}s` }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function DotsVisual() {
  return (
    <div className={styles.stage} aria-hidden="true">
      <span className={styles.line} />
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`${styles.dot} ${styles.loop}`}
          style={{ animationDelay: `${(i * 0.875).toFixed(3)}s` }}
        />
      ))}
    </div>
  );
}

function BarsVisual() {
  return (
    <div className={`${styles.stage} ${styles.barsStage}`} aria-hidden="true">
      <div className={styles.barRow}>
        <span className={styles.barLabel}>Carte Vistaire</span>
        <div className={styles.barTrack}>
          <span className={`${styles.barFill} ${styles.barFillA}`} />
        </div>
      </div>
      <div className={styles.barRow}>
        <span className={styles.barLabel}>Menu PDF</span>
        <div className={styles.barTrack}>
          <span className={`${styles.barFill} ${styles.barFillB}`} />
        </div>
      </div>
      <span className={styles.barCaption}>Illustration — mise en valeur des plats</span>
    </div>
  );
}

const CARDS = [
  {
    title: "Fiches plats visuelles",
    body: "Ingrédients, description, prix et allergènes réunis dans une lecture claire.",
    visual: <SonarVisual />
  },
  {
    title: "3D / AR sélective",
    body: "Déclenchée par intention sur les plats pertinents, avec une image de repli.",
    visual: <ChipsVisual />
  },
  {
    title: "Disponibilités en un geste",
    body: "Mettez à jour le contenu et la disponibilité de la carte.",
    visual: <DotsVisual />
  },
  {
    title: "Photos premium qui donnent envie",
    body: "Des photos qui présentent la cuisine avec justesse et cohérence.",
    visual: <BarsVisual />
  }
] as const;

/**
 * 4 feature cards (dark). Each visual loops gently once in viewport:
 * sonar rings / floating chips / traveling dots / growing bars.
 */
export function MercuryFeatures() {
  return (
    <section
      data-mercury-theme="dark"
      className={styles.section}
      aria-labelledby="mercury-features-title"
    >
      <div className={styles.inner}>
        <Reveal>
          <p className={`${shared.eyebrow} ${styles.eyebrow}`}>Détails</p>
        </Reveal>
        <Reveal delay={100}>
          <h2
            id="mercury-features-title"
            className={`${shared.serif} ${styles.title}`}
          >
            Chaque détail compte.
          </h2>
        </Reveal>

        <div className={styles.grid}>
          {CARDS.map((card, i) => (
            <Reveal key={card.title} delay={(i % 2) * 100}>
              <InView className={styles.card} visibleClass={styles.inView}>
                {card.visual}
                <h3 className={styles.cardTitle}>{card.title}</h3>
                <p className={styles.cardBody}>{card.body}</p>
              </InView>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
