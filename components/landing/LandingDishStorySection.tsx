import Image from "next/image";
import Link from "next/link";
import type { LandingCopy } from "@/lib/landing/landingCopy";
import type { LandingExperience } from "@/lib/landing/menuExperiences";
import styles from "./VistaireLanding.module.css";

export function LandingDishStorySection({
  copy,
  experiences
}: {
  copy: LandingCopy["dishes"];
  experiences: LandingExperience[];
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
            <article className={styles.dishCard} key={experience.id}>
              <Link
                className={styles.dishCardLink}
                href={experience.featuredDish.href}
                prefetch={false}
              >
                <span className={styles.dishMedia}>
                  <Image
                    alt={experience.featuredDish.imageAlt}
                    className={styles.coverImage}
                    fill
                    quality={84}
                    sizes="(max-width: 720px) calc(100vw - 54px), (max-width: 1100px) 46vw, 350px"
                    src={experience.featuredDish.image}
                    style={{
                      objectPosition: experience.featuredDish.imagePosition
                    }}
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
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
