import Image from "next/image";
import Link from "next/link";
import { LANDING_COPY } from "@/lib/landing/landingCopy";
import { OryzoReveal } from "./OryzoReveal";
import styles from "./OryzoExperiences.module.css";

const copy = LANDING_COPY.fr.experiences;

const EXPERIENCES = [
  {
    id: "01",
    name: "Sauge Noire",
    tagline: "Cuisine d’auteur, carte sombre, zéro compromis.",
    image: "/images/demo/dishes/pave-boeuf-mature-bordelaise.png",
    alt: "Pavé de bœuf maturé, sauce bordelaise"
  },
  {
    id: "02",
    name: "Maison Élysée",
    tagline: "Grande maison, carte claire, service millimétré.",
    image: "/images/demo/dishes/tartare-saumon-label-rouge.png",
    alt: "Tartare de saumon Label Rouge"
  },
  {
    id: "03",
    name: "Votre établissement",
    tagline: "Votre identité, votre menu, votre univers.",
    image: "/images/demo/dishes/risotto-cepes-parmesan.png",
    alt: "Risotto aux cèpes et parmesan"
  }
];

/**
 * Concept Oryzo — three identities.
 * "Trois expériences. Trois identités." — two real Vistaire directions
 * plus an open slot for the viewer's own restaurant.
 */
export function OryzoExperiences(): React.JSX.Element {
  return (
    <section
      id="experiences"
      className={styles.section}
      aria-label="Expériences Vistaire"
    >
      <div className={styles.inner}>
        <OryzoReveal>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h2 className={styles.title}>{copy.title}</h2>
          <p className={styles.body}>{copy.body}</p>
        </OryzoReveal>

        <div className={styles.cards}>
          {EXPERIENCES.map((experience, index) => (
            <OryzoReveal key={experience.name} delay={Math.min(index * 90, 180)}>
              <article className={styles.card}>
                <div className={styles.media}>
                  <Image
                    src={experience.image}
                    alt={experience.alt}
                    fill
                    sizes="(min-width: 1024px) 28vw, 100vw"
                    className={styles.img}
                  />
                  <span className={styles.badge}>EXP. {experience.id}</span>
                </div>
                <h3 className={styles.name}>{experience.name}</h3>
                <p className={styles.tagline}>{experience.tagline}</p>
                <Link href="/demo" className={styles.link}>
                  {copy.cta}
                  <span aria-hidden="true"> →</span>
                </Link>
              </article>
            </OryzoReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
