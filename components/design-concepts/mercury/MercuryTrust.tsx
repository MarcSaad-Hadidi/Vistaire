import Link from "next/link";
import shared from "./shared.module.css";
import styles from "./MercuryTrust.module.css";
import { MercuryReveal } from "./MercuryReveal";

const SECURITY = [
  {
    title: "Toujours à jour",
    text: "La carte affichée est toujours la bonne : chaque modification est publiée instantanément, dans toute la salle.",
    visual: "bar" as const
  },
  {
    title: "Vos photos, votre identité",
    text: "Vos visuels, vos textes, votre ton : rien de générique, tout est à l'image du lieu.",
    visual: "rings" as const
  },
  {
    title: "Le contrôle en main",
    text: "Plats, prix, allergènes, langues : vous décidez de tout, en un geste, sans intermédiaire.",
    visual: "toggles" as const
  }
];

const HIGHLIGHTS = [
  {
    mark: "QR",
    title: "Un scan suffit. Aucune application à télécharger.",
    href: "/demo"
  },
  {
    mark: "FR·EN",
    title: "Chaque convive lit la carte dans sa langue.",
    href: "/demo"
  },
  {
    mark: "3D",
    title: "L'immersion, seulement là où elle apporte un vrai plus.",
    href: "/demo"
  }
];

/**
 * "Standard protection stops short" block: 3 animated trust cards,
 * then 3 honest highlight cards in the press-card slot (no fake press).
 */
export function MercuryTrust() {
  return (
    <>
      <section className={shared.section} data-mtheme="dark" aria-label="Une carte sur laquelle compter">
        <div className={shared.wrap}>
          <MercuryReveal as="h2" className={shared.title}>
            Une carte sur laquelle on peut compter.
          </MercuryReveal>
          <div className={styles.grid}>
            {SECURITY.map((c, i) => (
              <MercuryReveal key={c.title} delay={i * 100}>
                <article className={styles.card}>
                  <div className={`${styles.visual} ${shared.grain}`} aria-hidden="true">
                    {c.visual === "bar" && (
                      <div className={styles.barWrap}>
                        <div className={styles.barLabel}>Carte à jour</div>
                        <div className={styles.barTrack}>
                          <div className={styles.barFill} />
                        </div>
                        <div className={styles.barLabelDim}>Ancienne carte</div>
                        <div className={styles.barTrack}>
                          <div className={`${styles.barFill} ${styles.barFillDim}`} />
                        </div>
                      </div>
                    )}
                    {c.visual === "rings" && (
                      <div className={shared.sonar}>
                        <span />
                        <span />
                        <span />
                      </div>
                    )}
                    {c.visual === "toggles" && (
                      <div className={styles.toggles}>
                        <span className={`${styles.tg} ${styles.tgOn}`}>
                          <span className={styles.knob} />
                        </span>
                        <span className={styles.tg}>
                          <span className={styles.knob} />
                        </span>
                        <span className={`${styles.tg} ${styles.tgOn}`}>
                          <span className={styles.knob} />
                        </span>
                      </div>
                    )}
                  </div>
                  <h3 className={styles.cardTitle}>{c.title}</h3>
                  <p className={styles.cardText}>{c.text}</p>
                </article>
              </MercuryReveal>
            ))}
          </div>
        </div>
      </section>

      <section className={shared.section} data-mtheme="dark" aria-label="Vistaire en bref">
        <div className={shared.wrap}>
          <div className={styles.grid}>
            {HIGHLIGHTS.map((c, i) => (
              <MercuryReveal key={c.mark} delay={i * 100}>
                <Link href={c.href} className={styles.pressCard}>
                  <div className={styles.pressMark}>{c.mark}</div>
                  <h3 className={styles.pressTitle}>{c.title}</h3>
                  <span className={styles.arrow} aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </Link>
              </MercuryReveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
