import Image from "next/image";
import Link from "next/link";
import type { LandingCopy } from "@/lib/landing/landingCopy";
import type { LandingExperience } from "@/lib/landing/menuExperiences";
import styles from "./VistaireLanding.module.css";

export function LandingExperienceSection({
  copy,
  experiences
}: {
  copy: LandingCopy["experiences"];
  experiences: LandingExperience[];
}) {
  return (
    <section
      aria-labelledby="landing-experiences-title"
      className={styles.section}
      data-testid="landing-experiences"
      id="experiences"
    >
      <div className={`${styles.sectionPanel} ${styles.experiencePanel}`}>
        <header className={styles.sectionIntro}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h2 id="landing-experiences-title">{copy.title}</h2>
          <p>{copy.body}</p>
        </header>
        <div className={styles.experienceGrid}>
          {experiences.map((experience) => (
            <article className={styles.experienceCard} key={experience.id}>
              <Image
                alt={experience.imageAlt}
                className={styles.coverImage}
                fill
                quality={88}
                sizes="(max-width: 720px) calc(100vw - 54px), (max-width: 1100px) 46vw, 330px"
                src={experience.image}
                style={{ objectPosition: experience.imagePosition }}
              />
              <div aria-hidden="true" className={styles.experienceShade} />
              <div className={styles.experienceCopy}>
                <p>{experience.label}</p>
                <h3>{experience.name}</h3>
                <Link
                  aria-label={`${copy.cta} — ${experience.name}`}
                  className={styles.cardLink}
                  href={experience.href}
                  prefetch={false}
                >
                  {copy.cta}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
