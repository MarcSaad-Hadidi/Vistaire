import { PublicDishImage } from "@/components/public-menu/PublicDishImage";
import { LOCALE_LANGUAGE_TAG, type Locale } from "@/lib/i18n";
import type { LandingCopy } from "@/lib/landing/landingCopy";
import type { LandingExperience } from "@/lib/landing/menuExperiences";
import { LandingPublicMenuLink } from "./LandingPublicMenuLink";
import styles from "./VistaireLanding.module.css";

export function LandingDishStorySection({
  copy,
  experiences,
  locale
}: {
  copy: LandingCopy["dishes"];
  experiences: LandingExperience[];
  locale: Locale;
}) {
  return (
    <section
      aria-labelledby="landing-dishes-title"
      className={styles.section}
      data-testid="landing-dishes"
      id="plats"
    >
      <div className={`${styles.sectionPanel} ${styles.dishPanel}`}>
        <header className={styles.sectionIntro}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h2 id="landing-dishes-title">{copy.title}</h2>
          <p>{copy.body}</p>
        </header>
        <div className={styles.dishGrid}>
          {experiences.map((experience) => (
            <article
              className={styles.dishCard}
              data-dish-id={experience.featuredDish.id}
              data-dish-slug={experience.featuredDish.slug}
              data-image-source={experience.featuredDish.imageSource}
              data-menu-slug={experience.menuSlug}
              key={experience.id}
              lang={LOCALE_LANGUAGE_TAG[locale]}
            >
              <LandingPublicMenuLink
                className={styles.dishCardLink}
                href={experience.featuredDish.href}
                locale={locale}
                newTabLabelClassName={styles.srOnly}
              >
                <span className={styles.dishMedia}>
                  <PublicDishImage
                    alt={experience.featuredDish.imageAlt}
                    className={styles.coverImage}
                    objectPosition={experience.featuredDish.imagePosition}
                    quality={90}
                    sizes="(max-width: 720px) calc(100vw - 54px), (max-width: 1100px) 46vw, 350px"
                    src={experience.featuredDish.image}
                  />
                </span>
                <div className={styles.dishCopy}>
                  <span className={styles.dishRestaurant}>{experience.name}</span>
                  <h3 className={styles.dishName}>
                    {experience.featuredDish.name}
                  </h3>
                  <span className={styles.dishDescription}>
                    {experience.featuredDish.description}
                  </span>
                  {experience.featuredDish.price ? (
                    <span className={styles.dishPrice}>
                      {experience.featuredDish.price}
                    </span>
                  ) : null}
                </div>
              </LandingPublicMenuLink>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
