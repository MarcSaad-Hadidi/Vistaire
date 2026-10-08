import Image from "next/image";
import Link from "next/link";
import { LANDING_COPY } from "@/lib/landing/landingCopy";
import { Parallax, Reveal } from "./TigerMotion";
import shared from "./shared.module.css";
import styles from "./TigerSections.module.css";

/* ------------------------------------------------------------------ */
/* Expériences — mustard chapter, 3 cards                              */
/* ------------------------------------------------------------------ */
const EXPERIENCES = [
  {
    name: "Sauge Noire",
    tag: "Expérience 01",
    blurb: "Une carte sombre et feutrée, pensée pour le service à table.",
    image: "/images/demo/dishes/pave-boeuf-mature-bordelaise.png",
    alt: "Pavé de bœuf maturé, sauce bordelaise"
  },
  {
    name: "Maison Élysée",
    tag: "Expérience 02",
    blurb: "Clarté lumineuse et élégance discrète, fidèle au lieu.",
    image: "/images/demo/dishes/maison-elyse-n1.png",
    alt: "Assiette signature Maison Élysée"
  },
  {
    name: "Trouvable",
    tag: "Expérience 03",
    blurb: "Une troisième direction, un autre ton pour votre carte.",
    image: "/images/demo/dishes/tartare-saumon-label-rouge.png",
    alt: "Tartare de saumon label rouge"
  }
];

export function TigerExperiences() {
  const copy = LANDING_COPY.fr.experiences;
  return (
    <section id="experiences" className={`${styles.mustard} ${shared.dotPatternDark}`} aria-label="Expériences">
      <div className={`${shared.wrap} ${shared.sectionPad}`}>
        <p className={`${shared.eyebrow} ${styles.eyebrowDark}`}>{copy.eyebrow}</p>
        <h2 className={`${shared.giantTitle} ${styles.sectionTitle}`}>
          Trois expériences.
          <br />
          Trois identités.
        </h2>
        <p className={styles.lede}>{copy.body}</p>
        <div className={styles.cards}>
          {EXPERIENCES.map((exp, i) => (
            <Reveal key={exp.name} as="article" className={styles.card} rotate={i % 2 === 0 ? "-1.5deg" : "1.5deg"} delay={i * 120}>
              <div className={styles.cardPhoto}>
                <Image src={exp.image} alt={exp.alt} fill sizes="(max-width: 860px) 100vw, 33vw" style={{ objectFit: "cover" }} />
              </div>
              <div className={styles.cardBody}>
                <span className={styles.cardTag}>{exp.tag}</span>
                <h3 className={styles.cardName}>{exp.name}</h3>
                <p className={styles.cardBlurb}>{exp.blurb}</p>
                <Link href="/demo" className={styles.cardCta}>
                  {copy.cta} →
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Plats — rust chapter, parallax side photos                          */
/* ------------------------------------------------------------------ */
export function TigerDishes() {
  const copy = LANDING_COPY.fr.dishes;
  return (
    <section id="plats" className={`${styles.rust} ${shared.dotPattern}`} aria-label="Mise en valeur des plats">
      <div className={`${shared.wrap} ${shared.sectionPad}`}>
        <p className={`${shared.eyebrow} ${styles.eyebrowLight}`}>{copy.eyebrow}</p>
        <h2 className={`${shared.giantTitle} ${styles.sectionTitle}`}>
          Chaque plat a son histoire.
          <br />
          Montrez-la.
        </h2>
        <p className={styles.ledeLight}>{copy.body}</p>
        <div className={styles.dishRows}>
          {copy.items.map((item, i) => (
            <article key={item.title} className={styles.dishRow}>
              <Reveal className={styles.dishPhotoWrap} rotate={i % 2 === 0 ? "2deg" : "-2deg"}>
                <Parallax
                  src={item.image}
                  alt={item.alt}
                  className={styles.dishPhotoFrame}
                  imgClassName={styles.dishPhotoInner}
                  speed={i % 2 === 0 ? 0.15 : 0.1}
                  sizes="(max-width: 860px) 100vw, 50vw"
                />
              </Reveal>
              <div className={styles.dishText}>
                <span className={shared.pastille} aria-hidden="true">
                  0{i + 1}
                </span>
                <h3 className={styles.dishTitle}>{item.title}</h3>
                <p className={styles.dishBody}>{item.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Valeur — dark panel, icon pastilles list                            */
/* ------------------------------------------------------------------ */
export function TigerValue() {
  const copy = LANDING_COPY.fr.value;
  return (
    <section className={styles.dark} aria-label="Valeur">
      <div className={`${shared.wrap} ${shared.sectionPad} ${styles.split}`}>
        <div className={styles.splitText}>
          <p className={`${shared.eyebrow} ${styles.eyebrowLight}`}>{copy.eyebrow}</p>
          <h2 className={`${shared.giantTitle} ${styles.sectionTitle}`}>
            Ce qu&apos;apporte une carte digitale premium
          </h2>
          <p className={styles.ledeLight}>{copy.body}</p>
        </div>
        <ul className={styles.valueList}>
          {copy.items.map((item, i) => (
            <Reveal as="li" key={item} className={styles.valueItem} delay={Math.min(i * 80, 400)}>
              <span className={`${shared.pastille} ${styles.valuePastille}`} aria-hidden="true">
                {i + 1}
              </span>
              <span className={styles.valueText}>{item}</span>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Restaurateurs — mustard chapter                                      */
/* ------------------------------------------------------------------ */
export function TigerOwner() {
  const copy = LANDING_COPY.fr.owner;
  return (
    <section className={`${styles.mustard} ${shared.dotPatternDark}`} aria-label="Pour les restaurateurs">
      <div className={`${shared.wrap} ${shared.sectionPad}`}>
        <p className={`${shared.eyebrow} ${styles.eyebrowDark}`}>{copy.eyebrow}</p>
        <h2 className={`${shared.giantTitle} ${styles.sectionTitle}`}>
          Gérez votre carte
          <br />
          en toute simplicité.
        </h2>
        <p className={styles.lede}>{copy.body}</p>
        <div className={styles.ownerGrid}>
          {copy.items.map((item, i) => (
            <Reveal key={item.title} className={styles.ownerCard} delay={i * 100}>
              <span className={`${shared.pastille} ${styles.ownerPastille}`} aria-hidden="true">
                {["▦", "✓", "◈", "◉"][i]}
              </span>
              <h3 className={styles.ownerTitle}>{item.title}</h3>
              <p className={styles.ownerBody}>{item.body}</p>
            </Reveal>
          ))}
        </div>
        <Link href="/apercu-restaurateur" className={styles.darkPill}>
          {copy.cta}
        </Link>
      </div>
    </section>
  );
}
