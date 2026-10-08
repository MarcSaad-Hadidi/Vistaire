import Image from "next/image";
import restaurantBackground from "@/Framer/PhotoRestoComplet5.png";
import { LOCALE_LANGUAGE_TAG, type Locale } from "@/lib/i18n";
import { getLandingExperiences } from "@/lib/landing/menuExperiences";
import { hasPublicMenu3d } from "@/lib/menu/hasPublicMenu3d";
import { getPublicMenuBySlug } from "@/lib/menu/publicMenu";
import { buildPublicDishPath } from "@/lib/menu/publicMenuCore";
import { DemoWalkthroughVideo } from "./DemoWalkthroughVideo";
import { PreviewFooter, PreviewNav } from "./VistairePreviewChrome";
import styles from "./RestaurantExperiences.module.css";

const pageCopy = {
  fr: {
    eyebrow: "Expériences Vistaire",
    heading: ["Trois expériences.", "Trois identités."],
    introduction: "Explorez trois démonstrations de menus Vistaire et leurs fiches plats, du premier aperçu à l’expérience complète.",
    demoDisclosure: "Maison Élyse est un restaurant fictif de démonstration.",
    explore: "Explorer",
    discover: "Découvrir",
    videoLabel: "Utilisation du menu",
    immersiveDescription: "Les plats compatibles se découvrent aussi en 3D et en réalité augmentée, depuis leur fiche.",
    immersiveLink: "Voir un plat en 3D",
    experiences: {
      "maison-elyse": {
        description: "Une carte gastronomique qui laisse toute la place aux assiettes.",
        features: ["Carte éditoriale", "Fiches plats", "Allergènes"]
      },
      trouvable: {
        description: "Une carte vivante, à parcourir selon vos envies.",
        features: ["Catégories", "Langues et devises", "Clair ou sombre"]
      },
      "sauge-noire": {
        description: "La braise, le végétal, le temps. Une carte à feuilleter.",
        features: ["Menu à feuilleter", "Fiches plats", "Univers botanique"]
      }
    }
  },
  en: {
    eyebrow: "Vistaire experiences",
    heading: ["Three experiences.", "Three identities."],
    introduction: "Explore three Vistaire demonstration menus and their dish details, from a first look to the full experience.",
    demoDisclosure: "Maison Élyse is a fictional demonstration restaurant.",
    explore: "Explore",
    discover: "Discover",
    videoLabel: "Using the menu of",
    immersiveDescription: "Compatible dishes can also be explored in 3D and augmented reality from their detail page.",
    immersiveLink: "View a dish in 3D",
    experiences: {
      "maison-elyse": {
        description: "A fine dining menu that gives every dish room to shine.",
        features: ["Editorial menu", "Dish details", "Allergens"]
      },
      trouvable: {
        description: "A lively menu to explore at your own pace.",
        features: ["Categories", "Languages and currencies", "Light or dark"]
      },
      "sauge-noire": {
        description: "Embers, plants, time. A menu to leaf through.",
        features: ["A menu to leaf through", "Dish details", "Botanical world"]
      }
    }
  }
} as const;

function Arrow() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none">
      <path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export async function RestaurantExperiences({
  currentPath,
  locale
}: {
  currentPath: string;
  locale: Locale;
}) {
  const content = pageCopy[locale];
  const experiences = await getLandingExperiences(locale);
  const saugeExperience = experiences.find((experience) => experience.id === "sauge-noire");
  const saugeMenu = saugeExperience
    ? await getPublicMenuBySlug(saugeExperience.menuSlug, LOCALE_LANGUAGE_TAG[locale])
    : null;
  const immersiveDishes = saugeMenu?.dishes.filter((dish) => dish.available && hasPublicMenu3d(dish));
  const immersiveDish = immersiveDishes?.find((dish) => dish.slug === saugeExperience?.featuredDish.slug)
    ?? immersiveDishes?.[0];
  const immersiveHref = saugeExperience && saugeMenu && immersiveDish
    ? buildPublicDishPath(saugeMenu.slug, immersiveDish.slug, {
        lang: LOCALE_LANGUAGE_TAG[locale],
        ...(saugeExperience.dishView ? { view: saugeExperience.dishView } : {})
      })
    : null;

  return (
    <div className={styles.page}>
      <Image
        alt=""
        aria-hidden="true"
        className={styles.backgroundImage}
        fill
        priority
        quality={75}
        sizes="100vw"
        src={restaurantBackground}
      />
      <div aria-hidden="true" className={styles.backgroundWash} />
      <header className={styles.navShell}>
        <PreviewNav activeSection="menu" currentPath={currentPath} locale={locale} />
      </header>
      <main id="carte" className={styles.main}>
        <div className={styles.hero}>
          <p className={styles.eyebrow}>{content.eyebrow}</p>
          <h1>{content.heading[0]} <br />{content.heading[1]}</h1>
          <p className={styles.introduction}>{content.introduction}</p>
          <p className={styles.introduction}>{content.demoDisclosure}</p>
        </div>
        <div className={styles.experiences}>
          {experiences.map((experience) => {
            const copy = content.experiences[experience.id];
            const dish = experience.featuredDish;

            return (
              <section
                aria-labelledby={`experience-${experience.id}`}
                className={`${styles.experience} ${styles[experience.id]}`}
                data-demo-experience={experience.id}
                key={experience.id}
              >
                <div className={styles.copy}>
                  <p className={styles.label}>{experience.label}</p>
                  <h2 id={`experience-${experience.id}`}>{experience.name}</h2>
                  <p className={styles.description}>{copy.description}</p>
                  <ul className={styles.features}>
                    {copy.features.map((feature) => <li key={feature}>{feature}</li>)}
                  </ul>
                </div>
                <figure className={styles.figure}>
                  <div className={styles.phoneVideo}>
                    <DemoWalkthroughVideo
                      label={`${content.videoLabel} ${experience.name}`}
                      poster={`/images/demo-walkthrough/${experience.id}.webp?v=hd2`}
                      src={`/videos/demo/${experience.id}.mp4?v=hd2`}
                    />
                  </div>
                </figure>
                <div className={styles.actions}>
                  <a className={styles.explore} href={experience.publicMenuHref}>
                    {content.explore} {experience.name}<Arrow />
                  </a>
                  <a className={styles.dishLink} href={dish.href}>{content.discover} {dish.name}</a>
                  {experience.id === "sauge-noire" ? (
                    <div className={styles.immersive}>
                      <p>{content.immersiveDescription}</p>
                      {immersiveHref && immersiveDish ? (
                        <a
                          aria-label={locale === "en" ? `View ${immersiveDish.name} in 3D` : `Voir ${immersiveDish.name} en 3D`}
                          data-demo-3d-link
                          href={immersiveHref}
                        >
                          {content.immersiveLink}<Arrow />
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </main>
      <PreviewFooter currentPath={currentPath} locale={locale} width="wide" />
    </div>
  );
}
