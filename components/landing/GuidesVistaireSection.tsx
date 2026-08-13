import Link from "next/link";
import { getEditorialGuides } from "@/lib/editorialGuides";
import type { Locale } from "@/lib/i18n";
import styles from "./VistaireLanding.module.css";

const copy = {
  fr: {
    eyebrow: "Guides Vistaire",
    title: "Mieux décider avant de numériser la carte.",
    description:
      "Trois ressources éditoriales pour structurer le menu, préparer le parcours QR à table et choisir la 3D pour les bonnes raisons.",
    read: "Lire le guide",
    pillarLabel: "Explorer aussi les fondamentaux du menu digital",
    pillarHref: "/menu-digital-restaurant"
  },
  en: {
    eyebrow: "Vistaire guides",
    title: "Make better decisions before digitizing the menu.",
    description:
      "Three editorial resources for structuring the menu, preparing the table-side QR journey and choosing 3D for the right reasons.",
    read: "Read the guide",
    pillarLabel: "Explore the digital-menu fundamentals",
    pillarHref: "/en/digital-restaurant-menu"
  }
} as const;

export function GuidesVistaireSection({ locale = "fr" }: { locale?: Locale }) {
  const sectionCopy = copy[locale];
  const guides = getEditorialGuides(locale);

  return (
    <section
      id="guides"
      aria-labelledby="guides-title"
      className={styles.guidesSection}
    >
      <div aria-hidden="true" className={styles.guidesBackdrop} />
      <div className={styles.guidesPanel}>
        <div className={styles.guidesIntro}>
          <p className={styles.eyebrow}>
            {sectionCopy.eyebrow}
          </p>
          <h2 id="guides-title">{sectionCopy.title}</h2>
          <p>{sectionCopy.description}</p>
        </div>

        <div className={styles.guidesGrid}>
          {guides.map((guide, index) => (
            <Link
              key={guide.path}
              href={guide.path}
              prefetch={false}
              className={styles.guideCard}
            >
              <p className={styles.guideIndex}>
                {String(index + 1).padStart(2, "0")} · {guide.eyebrow}
              </p>
              <h3>{guide.cardTitle}</h3>
              <p className={styles.guideDescription}>
                {guide.cardDescription}
              </p>
              <span className={styles.guideLink}>
                {sectionCopy.read}{" "}
                <span aria-hidden="true" className={styles.guideArrow}>
                  ↗
                </span>
              </span>
            </Link>
          ))}
        </div>

        <Link
          className={styles.guidesPillarLink}
          href={sectionCopy.pillarHref}
          prefetch={false}
        >
          {sectionCopy.pillarLabel}
        </Link>
      </div>
    </section>
  );
}
