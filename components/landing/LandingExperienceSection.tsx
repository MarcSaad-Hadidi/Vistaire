import Image from "next/image";
import type { Locale } from "@/lib/i18n";
import type { LandingCopy } from "@/lib/landing/landingCopy";
import type { LandingExperience } from "@/lib/landing/menuExperiences";
import { LandingPublicMenuLink } from "./LandingPublicMenuLink";
import styles from "./VistaireLanding.module.css";

export function LandingExperienceSection({
  copy,
  experiences,
  locale
}: {
  copy: LandingCopy["experiences"];
  experiences: LandingExperience[];
  locale: Locale;
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
              <LandingPublicMenuLink
                className={styles.experienceCardLink}
                href={experience.publicMenuHref}
                locale={locale}
                newTabLabelClassName={styles.srOnly}
                showArrow={false}
              >
                <Image
                  alt={experience.imageAlt}
                  className={styles.coverImage}
                  fill
                  quality={90}
                  sizes="(max-width: 720px) calc(100vw - 54px), (max-width: 1100px) 46vw, 330px"
                  src={experience.image}
                  style={{ objectPosition: experience.imagePosition }}
                />
                <span aria-hidden="true" className={styles.experienceShade} />
                <div className={styles.experienceCopy}>
                  <span className={styles.experienceLabel}>{experience.label}</span>
                  <h3 className={styles.experienceName}>{experience.name}</h3>
                  <span className={styles.cardLink}>
                    {copy.cta}
                    <span aria-hidden="true" className={styles.linkArrow}>
                      ↗
                    </span>
                  </span>
                </div>
              </LandingPublicMenuLink>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
