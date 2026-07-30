import Image from "next/image";
import type { LandingCopy } from "@/lib/landing/landingCopy";
import styles from "./VistaireLanding.module.css";

export function LandingDishStorySection({
  copy
}: {
  copy: LandingCopy["dishes"];
}) {
  return (
    <section
      aria-labelledby="landing-dishes-title"
      className={styles.section}
      id="plats"
    >
      <div className={`${styles.sectionPanel} ${styles.dishPanel}`}>
        <header className={styles.sectionIntro}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h2 id="landing-dishes-title">{copy.title}</h2>
          <p>{copy.body}</p>
        </header>
        <div className={styles.dishGrid}>
          {copy.items.map((item) => (
            <article className={styles.dishCard} key={item.title}>
              <div className={styles.dishMedia}>
                <Image
                  alt={item.alt}
                  className={styles.coverImage}
                  fill
                  quality={84}
                  sizes="(max-width: 720px) calc(100vw - 54px), (max-width: 1100px) 46vw, 350px"
                  src={item.image}
                />
              </div>
              <div className={styles.dishCopy}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
