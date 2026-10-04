import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import restaurantBackground from "@/Framer/PhotoRestoComplet5.png";
import { JsonLd } from "@/components/JsonLd";
import { PreviewFooter, PreviewNav } from "@/components/vistaire-preview/VistairePreviewChrome";
import { buildPageAlternates, LOCALE_LANGUAGE_TAG, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import { getLandingExperiences } from "@/lib/landing/menuExperiences";
import { hasPublicMenu3d } from "@/lib/menu/hasPublicMenu3d";
import { getPublicMenuBySlug } from "@/lib/menu/publicMenu";
import { buildPublicDishPath } from "@/lib/menu/publicMenuCore";
import { absoluteUrl, buildBreadcrumbJsonLd, buildWebPageJsonLd } from "@/lib/seo";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const canonicalPath = "/demo";
const title = "Trois expériences de menu restaurant | Vistaire";
const description =
  "Découvrez Maison Élyse, Trouvable et Sauge Noire : trois identités Vistaire, leurs vraies cartes et leurs fiches plats, avec 3D et AR sur les plats compatibles.";

const experienceCopy = {
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
} as const;

function Arrow() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none">
      <path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: buildPageAlternates(canonicalPath),
  openGraph: {
    url: absoluteUrl(canonicalPath),
    title,
    description,
    locale: LOCALE_OPEN_GRAPH.fr,
    type: "website"
  },
  twitter: {
    card: "summary",
    title,
    description
  }
};

export default async function DemoPage() {
  const locale = "fr";
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
    <>
      <JsonLd
        data={[
          buildWebPageJsonLd({ path: canonicalPath, name: title, description }),
          buildBreadcrumbJsonLd([
            { name: "Accueil", path: "/" },
            { name: "Expériences Vistaire", path: canonicalPath }
          ])
        ]}
      />
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
          <PreviewNav activeSection="menu" currentPath={canonicalPath} />
        </header>
        <main id="carte" className={styles.main}>
          <div className={styles.hero}>
            <p className={styles.eyebrow}>Expériences Vistaire</p>
            <h1>Trois restaurants. <br />Trois identités.</h1>
            <p className={styles.introduction}>
              Une même attention à la carte, trois façons de la vivre.
              Entrez dans les vrais menus et découvrez les plats à votre rythme.
            </p>
          </div>
          <div className={styles.experiences}>
            {experiences.map((experience) => {
              const copy = experienceCopy[experience.id];
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
                      <video
                        aria-label={`Utilisation du menu ${experience.name}`}
                        autoPlay
                        data-demo-video
                        loop
                        muted
                        playsInline
                        poster={`/images/demo-walkthrough/${experience.id}.webp?v=hd2`}
                        preload="metadata"
                        src={`/videos/demo/${experience.id}.mp4?v=hd2`}
                      />
                    </div>
                  </figure>
                  <div className={styles.actions}>
                    <Link className={styles.explore} href={experience.publicMenuHref} prefetch={false}>
                      Explorer {experience.name}<Arrow />
                    </Link>
                    <Link className={styles.dishLink} href={dish.href} prefetch={false}>Découvrir {dish.name}</Link>
                    {experience.id === "sauge-noire" ? (
                      <div className={styles.immersive}>
                        <p>Les plats compatibles se découvrent aussi en 3D et en réalité augmentée, depuis leur fiche.</p>
                        {immersiveHref && immersiveDish ? (
                          <Link
                            aria-label={`Voir ${immersiveDish.name} en 3D`}
                            data-demo-3d-link
                            href={immersiveHref}
                            prefetch={false}
                          >
                            Voir un plat en 3D<Arrow />
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </main>
        <PreviewFooter currentPath={canonicalPath} width="wide" />
      </div>
    </>
  );
}
