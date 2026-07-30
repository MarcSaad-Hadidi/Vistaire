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
              <Link
                className={styles.experienceCardLink}
                href={experience.menuHref}
                prefetch={false}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Image
                  alt={experience.imageAlt}
                  className={styles.coverImage}
                  fill
                  quality={88}
                  sizes="(max-width: 720px) calc(100vw - 54px), (max-width: 1100px) 46vw, 330px"
                  src={experience.image}
                  style={{ objectPosition: experience.imagePosition }}
                />
                <span aria-hidden="true" className={styles.experienceShade} />
                <div className={styles.experienceCopy}>
                  <span className={styles.experienceLabel}>{experience.label}</span>
                  <h3 className={styles.experienceName}>{experience.name}</h3>
                  <span className={styles.cardLink}>{copy.cta}</span>
                  <span className={styles.srOnly}> {copy.newTabLabel}</span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
