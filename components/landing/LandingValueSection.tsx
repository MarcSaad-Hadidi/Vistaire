import Image from "next/image";
import type { LandingCopy } from "@/lib/landing/landingCopy";
import styles from "./VistaireLanding.module.css";

const VALUE_LOGOS = [
  "/images/landing/logos/value-navigation.webp",
  "/images/landing/logos/value-dish-pages.webp",
  "/images/landing/logos/value-information.webp",
  "/images/landing/logos/value-photography.webp",
  "/images/landing/logos/value-ar.webp",
  "/images/landing/logos/value-mobile.webp"
] as const;

export function LandingValueSection({
  copy
}: {
  copy: LandingCopy["value"];
}) {
  return (
    <section
      aria-labelledby="landing-value-title"
      className={styles.section}
      id="fonctionnalites"
    >
      <div className={`${styles.sectionPanel} ${styles.valuePanel}`}>
        <header className={styles.sectionIntro}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h2 id="landing-value-title">{copy.title}</h2>
          <p>{copy.body}</p>
        </header>
        <ol className={styles.valueGrid}>
          {copy.items.map((item, index) => (
            <li key={item}>
              <div aria-hidden="true" className={styles.landingLogo}>
                <Image
                  alt=""
                  className={styles.landingLogoImage}
                  fill
                  sizes="(max-width: 620px) calc(100vw - 52px), (max-width: 920px) 70vw, (max-width: 1100px) 35vw, 20vw"
                  src={VALUE_LOGOS[index]}
                />
              </div>
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <p>{item}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
