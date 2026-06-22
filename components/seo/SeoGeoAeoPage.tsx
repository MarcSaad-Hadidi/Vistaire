import Image from "next/image";
import type { StaticImageData } from "next/image";
import Link from "next/link";
import beveragePhoto from "@/Framer/Boisson.png";
import dessertPhoto from "@/Framer/Desert.png";
import pageDigitalPhoto from "@/Framer/PageDigital.png";
import photoPdfCompare from "@/Framer/PhotoComparaisonPDF.png";
import photoDigital2 from "@/Framer/PhotoDigital2.png";
import photoDigital3 from "@/Framer/PhotoDigital3.png";
import photoPdfDetail from "@/Framer/PhotoPDFvsDigitalDetail.png";
import photoQrCode1 from "@/Framer/PhotoQRcode1.png";
import photoQrCode2 from "@/Framer/PhotoQRcode2.png";
import photoResto from "@/Framer/PhotoRestoComplet4.png";
import restaurantBackground from "@/Framer/PhotoRestoComplet5.png";
import photoRestoDining from "@/Framer/PhotoRestoComplet6.png";
import lobsterPlate from "@/Framer/PlatHomard.png";
import { SeoFaq } from "@/components/seo/SeoFaq";
import {
  PreviewFooter,
  PreviewNav
} from "@/components/vistaire-preview/VistairePreviewChrome";
import styles from "@/components/vistaire-preview/VistaireMenuDigitalRestaurantPreview.module.css";
import type {
  SeoGeoInternalLink,
  SeoGeoPageData,
  SeoGeoPageType
} from "@/lib/seoGeoPages";

type PageVisual = {
  alt: string;
  src: StaticImageData | string;
};

const VISUAL_SETS: Record<string, PageVisual[]> = {
  "menu-qr-sans-pdf": [
    {
      src: photoQrCode1,
      alt: "Client ouvrant un menu Vistaire depuis un QR code à table"
    },
    {
      src: photoQrCode2,
      alt: "Menu mobile Vistaire consulté après le scan QR"
    },
    {
      src: pageDigitalPhoto,
      alt: "Fiche plat mobile affichée dans un menu Vistaire"
    }
  ],
  "menu-digital-sans-application": [
    {
      src: pageDigitalPhoto,
      alt: "Menu digital Vistaire ouvert dans le navigateur mobile"
    },
    {
      src: photoDigital3,
      alt: "Client consultant un menu digital à table sans application"
    },
    {
      src: photoDigital2,
      alt: "Expérience mobile Vistaire avec présentation visuelle des plats"
    }
  ],
  "remplacer-menu-pdf-restaurant": [
    {
      src: photoPdfCompare,
      alt: "Comparaison entre menu PDF et menu digital Vistaire"
    },
    {
      src: photoPdfDetail,
      alt: "Détail d'un menu PDF remplacé par une lecture mobile"
    },
    {
      src: pageDigitalPhoto,
      alt: "Menu digital Vistaire utilisé comme alternative au PDF"
    }
  ],
  "alternative-menu-pdf-restaurant": [
    {
      src: photoPdfDetail,
      alt: "Menu PDF transformé en expérience mobile lisible"
    },
    {
      src: photoPdfCompare,
      alt: "Comparaison visuelle entre PDF et carte digitale"
    },
    {
      src: photoDigital3,
      alt: "Client lisant un menu digital plutôt qu'un PDF à table"
    }
  ],
  "fiche-plat-digitale-restaurant": [
    {
      src: lobsterPlate,
      alt: "Plat signature présenté dans une fiche plat digitale"
    },
    {
      src: pageDigitalPhoto,
      alt: "Fiche plat Vistaire avec détails utiles sur mobile"
    },
    {
      src: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
      alt: "Homard présenté comme plat signature dans Vistaire"
    }
  ],
  "menu-restaurant-photos": [
    {
      src: "/images/demo/dishes/tartare-saumon-label-rouge.png",
      alt: "Photo de plat utilisée dans un menu restaurant"
    },
    {
      src: "/images/demo/dishes/risotto-cepes-parmesan.png",
      alt: "Risotto photographié pour une carte digitale"
    },
    {
      src: dessertPhoto,
      alt: "Dessert présenté avec une direction photo premium"
    }
  ],
  "menu-restaurant-allergenes": [
    {
      src: pageDigitalPhoto,
      alt: "Fiche plat mobile avec informations utiles pour le client"
    },
    {
      src: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
      alt: "Plat avec informations de composition dans une fiche digitale"
    },
    {
      src: "/images/demo/dishes/tarte-citron-basilic-pourpre.png",
      alt: "Dessert affiché dans une fiche avec détails et allergènes"
    }
  ],
  "menu-digital-restaurant-montreal": [
    {
      src: photoRestoDining,
      alt: "Ambiance de restaurant à Montréal avec expérience mobile"
    },
    {
      src: photoDigital3,
      alt: "Menu digital consulté à table dans un restaurant montréalais"
    },
    {
      src: "/images/demo/dishes/pave-boeuf-mature-bordelaise.png",
      alt: "Plat signature présenté pour un restaurant à Montréal"
    }
  ],
  "menu-digital-restaurant-laval": [
    {
      src: photoResto,
      alt: "Salle de restaurant avec carte digitale pour Laval"
    },
    {
      src: pageDigitalPhoto,
      alt: "Carte mobile Vistaire pour restaurant à Laval"
    },
    {
      src: "/images/demo/dishes/canette-rotie-figues-epices.png",
      alt: "Plat premium présenté dans un menu digital à Laval"
    }
  ],
  "menu-digital-restaurant-brossard": [
    {
      src: photoRestoDining,
      alt: "Salle de restaurant avec menu digital pour Brossard"
    },
    {
      src: photoQrCode1,
      alt: "QR code de table ouvrant une carte mobile à Brossard"
    },
    {
      src: "/images/demo/dishes/tartare-saumon-label-rouge.png",
      alt: "Plat présenté dans une carte digitale pour Brossard"
    }
  ],
  "menu-digital-restaurant-haut-de-gamme": [
    {
      src: photoResto,
      alt: "Ambiance premium de restaurant haut de gamme"
    },
    {
      src: lobsterPlate,
      alt: "Plat signature mis en scène pour un menu haut de gamme"
    },
    {
      src: beveragePhoto,
      alt: "Boisson signature présentée dans une expérience Vistaire"
    }
  ],
  "menu-digital-restaurant-gastronomique": [
    {
      src: lobsterPlate,
      alt: "Plat gastronomique présenté dans une carte digitale"
    },
    {
      src: "/images/demo/dishes/souffle-chocolat-grand-cru.png",
      alt: "Dessert gastronomique dans un menu digital Vistaire"
    },
    {
      src: photoRestoDining,
      alt: "Salle gastronomique avec expérience mobile premium"
    }
  ]
};

const VISUAL_ALIASES: Record<string, string> = {
  "qr-menu-without-pdf": "menu-qr-sans-pdf",
  "digital-menu-without-app": "menu-digital-sans-application",
  "replace-restaurant-pdf-menu": "remplacer-menu-pdf-restaurant",
  "restaurant-pdf-menu-alternative": "alternative-menu-pdf-restaurant",
  "digital-dish-page-restaurant": "fiche-plat-digitale-restaurant",
  "restaurant-menu-photos": "menu-restaurant-photos",
  "restaurant-menu-allergens": "menu-restaurant-allergenes",
  "digital-restaurant-menu-montreal": "menu-digital-restaurant-montreal",
  "digital-restaurant-menu-laval": "menu-digital-restaurant-laval",
  "digital-restaurant-menu-brossard": "menu-digital-restaurant-brossard",
  "high-end-restaurant-digital-menu": "menu-digital-restaurant-haut-de-gamme",
  "fine-dining-restaurant-digital-menu":
    "menu-digital-restaurant-gastronomique"
};

const localizedCopy = {
  fr: {
    actions: "Actions principales",
    direct: "Réponse directe",
    context: "Contexte",
    proof: "Vistaire",
    includedEyebrow: "Inclus",
    includedTitle: "Ce que le menu Vistaire inclut",
    includedBody:
      "La présentation garde la même direction que les expériences Vistaire existantes : mobile-first, food-first, sobre et utile pendant le service.",
    comparison: "Comparaison",
    criterion: "Critère",
    comparisonBody:
      "La différence doit rester concrète : lisibilité, image, informations utiles et performance mobile.",
    faqEyebrow: "Questions fréquentes",
    faqTitle: "Questions fréquentes des restaurateurs",
    faqBody:
      "Des réponses courtes pour préparer la carte, rassurer l'équipe et clarifier l'expérience à table.",
    finalEyebrow: "Prochaine étape",
    finalTitle: "Préparer une expérience Vistaire cohérente.",
    finalBody:
      "Le parcours renvoie vers les guides utiles, le menu exemple et la prise de rendez-vous pour aider le restaurateur à avancer clairement.",
    internalLinks: "Guides Vistaire"
  },
  en: {
    actions: "Primary actions",
    direct: "Short answer",
    context: "Restaurant context",
    proof: "With Vistaire",
    includedEyebrow: "Included",
    includedTitle: "What a Vistaire menu includes",
    includedBody:
      "The presentation keeps the same Vistaire direction: mobile-first, food-first, restrained and useful during service.",
    comparison: "Comparison",
    criterion: "Criterion",
    comparisonBody:
      "The difference should stay concrete: readability, image, useful information and mobile performance.",
    faqEyebrow: "Questions",
    faqTitle: "Common restaurant questions",
    faqBody:
      "Short answers to help prepare the menu, align the team and clarify the table experience.",
    finalEyebrow: "Next step",
    finalTitle: "Prepare a coherent Vistaire experience.",
    finalBody:
      "The path points to useful guides, the sample menu and booking flow so restaurants can keep moving clearly.",
    internalLinks: "Vistaire guides"
  }
} as const;

const layoutClasses: Record<SeoGeoPageType, string> = {
  aeo: styles.layoutAeo,
  local: styles.layoutLocal,
  vertical: styles.layoutVertical
};

const heroImageSizes: Record<SeoGeoPageType, string> = {
  aeo: "(max-width: 920px) calc(100vw - 56px), (max-width: 1400px) 32vw, 460px",
  local:
    "(max-width: 920px) calc(100vw - 56px), (max-width: 1400px) 38vw, 520px",
  vertical:
    "(max-width: 920px) calc(100vw - 56px), (max-width: 1400px) 64vw, 780px"
};

const publicTextReplacements = {
  fr: [
    [
      /Vistaire regroupe les intentions Vieux-Montréal, Griffintown, Plateau, Outremont, Westmount et Saint-Laurent dans une page forte tant que des pages de quartier vraiment uniques ne sont pas justifiées\./g,
      "Vistaire rassemble les besoins des restaurants de Vieux-Montréal, Griffintown, Plateau, Outremont, Westmount et Saint-Laurent dans un guide commun tant qu'un contenu de quartier vraiment utile n'est pas justifié."
    ],
    [/après intention du client/gi, "après action du client"],
    [/intention du client/gi, "action du client"],
    [/\bintentions?\b/gi, "besoin"],
    [/moteurs de recherche/gi, "visiteurs"],
    [/assistants IA/gi, "équipes en salle"],
    [/cul-de-sac SEO/gi, "rupture dans le parcours"],
    [/FAQ SEO\/GEO/gi, "Questions fréquentes"],
    [/SEO\/GEO/gi, "restaurant"],
    [/\b(?:SEO|GEO|AEO)\b/g, "restaurant"],
    [/nouvelles pages/gi, "nouveaux guides"],
    [/pages nouvelles/gi, "nouveaux guides"]
  ],
  en: [
    [/guest shows intent/gi, "guest actively opens it"],
    [/after intent/gi, "after a guest action"],
    [/\bintentional\b/gi, "deliberate"],
    [/\bintentionally\b/gi, "deliberately"],
    [/\bintent\b/gi, "need"],
    [/search engines/gi, "restaurant visitors"],
    [/AI assistants/gi, "service teams"],
    [/SEO dead end/gi, "drop-off in the guest journey"],
    [/SEO\/GEO FAQ/gi, "Common restaurant questions"],
    [/SEO\/GEO/gi, "restaurant"],
    [/\b(?:SEO|GEO|AEO)\b/g, "restaurant"],
    [/new pages/gi, "new guides"]
  ]
} satisfies Record<
  NonNullable<SeoGeoPageData["locale"]>,
  Array<[RegExp, string]>
>;

function publicText(
  text: string,
  locale: NonNullable<SeoGeoPageData["locale"]>
) {
  return publicTextReplacements[locale].reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    text
  );
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className={styles.buttonIcon}
      fill="none"
      viewBox="0 0 12 12"
    >
      <path
        d="M3.1 8.9 8.7 3.3m0 0H4.1m4.6 0v4.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function uniqueLinks(links: SeoGeoInternalLink[]) {
  const seen = new Set<string>();

  return links.filter((link) => {
    const key = `${link.href}-${link.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function SeoGeoAeoPage({ page }: { page: SeoGeoPageData }) {
  const locale = page.locale ?? "fr";
  const copy = localizedCopy[locale];
  const visualKey = VISUAL_ALIASES[page.slug] ?? page.slug;
  const visuals = VISUAL_SETS[visualKey] ?? [
    page.visualImage,
    page.visualImage,
    page.visualImage
  ];
  const finalLinks = uniqueLinks([
    ...page.relatedLinks,
    page.primaryCta,
    page.secondaryCta
  ]);
  const displayFaq = page.faq.map((item) => ({
    question: publicText(item.question, locale),
    answer: publicText(item.answer, locale)
  }));

  return (
    <main className={styles.page}>
      <Image
        alt=""
        aria-hidden="true"
        className={styles.backgroundImage}
        fill
        quality={72}
        sizes="100vw"
        src={restaurantBackground}
      />

      <div className={styles.topNav}>
        <PreviewNav
          currentPath={page.path}
          locale={locale}
          routeMode="production"
        />
      </div>

      <section
        aria-labelledby={`${page.slug}-title`}
        className={styles.hero}
        id="accueil"
      >
        <div className={`${styles.previewFrame} ${layoutClasses[page.type]}`}>
          <article className={`${styles.card} ${styles.heroCopy}`}>
            <p className={styles.badge}>{publicText(page.eyebrow, locale)}</p>
            <h1 id={`${page.slug}-title`}>{publicText(page.h1, locale)}</h1>
            <p className={styles.heroLead}>
              {publicText(page.directAnswer, locale)}
            </p>
            <div className={styles.heroActions} aria-label={copy.actions}>
              <Link
                className={styles.primaryButton}
                href={page.primaryCta.href}
                prefetch={false}
              >
                {publicText(page.primaryCta.label, locale)}
                <ArrowIcon />
              </Link>
              <Link
                className={styles.secondaryButton}
                href={page.secondaryCta.href}
                prefetch={false}
              >
                {publicText(page.secondaryCta.label, locale)}
              </Link>
            </div>
            <figure className={`${styles.visualFigure} ${styles.heroVisual}`}>
              <Image
                alt={publicText(visuals[0].alt, locale)}
                className={styles.visualImage}
                fill
                priority
                quality={84}
                sizes={heroImageSizes[page.type]}
                src={visuals[0].src}
              />
            </figure>
          </article>

          <section
            className={`${styles.card} ${styles.problemCard}`}
            aria-labelledby={`${page.slug}-context-title`}
          >
            <p className={styles.badge}>{copy.context}</p>
            <h2 id={`${page.slug}-context-title`}>
              {publicText(page.context.heading, locale)}
            </h2>
            {page.context.body.map((paragraph) => (
              <p key={paragraph}>{publicText(paragraph, locale)}</p>
            ))}
            {page.context.points ? (
              <div className={styles.problemList}>
                {page.context.points.map((point) => (
                  <section key={point}>
                    <h3>{publicText(point, locale)}</h3>
                  </section>
                ))}
              </div>
            ) : null}
          </section>

          <section
            className={`${styles.card} ${styles.mobileProofCard}`}
            aria-labelledby={`${page.slug}-proof-title`}
          >
            <figure className={styles.visualFigure}>
              <Image
                alt={publicText(visuals[1].alt, locale)}
                className={styles.visualImage}
                fill
                quality={80}
                sizes="(max-width: 920px) calc(100vw - 56px), (max-width: 1400px) 58vw, 880px"
                src={visuals[1].src}
              />
            </figure>
            <div className={styles.visualCopy}>
              <p className={styles.badge}>{copy.proof}</p>
              <h2 id={`${page.slug}-proof-title`}>
                {publicText(page.productProof.heading, locale)}
              </h2>
              <p>{publicText(page.productProof.body, locale)}</p>
              {page.productProof.points.length > 0 ? (
                <ul className={styles.proofPoints}>
                  {page.productProof.points.map((point) => (
                    <li key={point}>{publicText(point, locale)}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>

          <section
            className={`${styles.card} ${styles.premiumPanel}`}
            aria-labelledby={`${page.slug}-included-title`}
          >
            <div className={styles.premiumContent}>
              <div className={styles.sectionIntro}>
                <p className={styles.badge}>{copy.includedEyebrow}</p>
                <h2 id={`${page.slug}-included-title`}>
                  {copy.includedTitle}
                </h2>
                <p>{copy.includedBody}</p>
              </div>
              <div className={styles.benefitGrid}>
                {page.included.slice(0, 6).map((item) => (
                  <article className={styles.benefitItem} key={item.title}>
                    <h3>{publicText(item.title, locale)}</h3>
                    <p className="mt-3 text-[13px] font-medium leading-[1.45] text-[#f4e5cd]/72">
                      {publicText(item.text, locale)}
                    </p>
                  </article>
                ))}
              </div>
            </div>
            <figure className={`${styles.visualFigure} ${styles.premiumVisual}`}>
              <Image
                alt={publicText(visuals[2].alt, locale)}
                className={styles.visualImage}
                fill
                quality={80}
                sizes="(max-width: 920px) calc(100vw - 56px), (max-width: 1400px) 34vw, 500px"
                src={visuals[2].src}
              />
            </figure>
          </section>

          <section
            className={`${styles.card} ${styles.comparisonCard}`}
            aria-labelledby={`${page.slug}-comparison-title`}
          >
            <div className={styles.sectionIntro}>
              <p className={styles.badge}>{copy.comparison}</p>
              <h2 id={`${page.slug}-comparison-title`}>
                {publicText(page.comparison.heading, locale)}
              </h2>
              <p>
                {copy.comparisonBody}
              </p>
            </div>
            <table className={styles.comparisonTable}>
              <thead>
                <tr>
                  <th scope="col">{copy.criterion}</th>
                  <th scope="col">
                    {publicText(page.comparison.basicLabel, locale)}
                  </th>
                  <th scope="col">
                    {publicText(page.comparison.vistaireLabel, locale)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.comparison.rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{publicText(row.label, locale)}</th>
                    <td
                      data-label={publicText(
                        page.comparison.basicLabel,
                        locale
                      )}
                    >
                      {publicText(row.basic, locale)}
                    </td>
                    <td
                      data-label={publicText(
                        page.comparison.vistaireLabel,
                        locale
                      )}
                    >
                      {publicText(row.vistaire, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section
            className={`${styles.card} ${styles.comparisonCard}`}
            aria-labelledby={`${page.slug}-faq-title`}
          >
            <div className={styles.sectionIntro}>
              <p className={styles.badge}>{copy.faqEyebrow}</p>
              <h2 id={`${page.slug}-faq-title`}>
                {copy.faqTitle}
              </h2>
              <p>{copy.faqBody}</p>
            </div>
            <div className="mt-8">
              <SeoFaq faqs={displayFaq} layout="stack" locale={locale} />
            </div>
          </section>

          <section
            className={`${styles.card} ${styles.finalCta}`}
            aria-labelledby={`${page.slug}-final-title`}
          >
            <div>
              <p className={styles.badge}>{copy.finalEyebrow}</p>
              <h2 id={`${page.slug}-final-title`}>
                {copy.finalTitle}
              </h2>
              <p>{copy.finalBody}</p>
            </div>
            <div className={styles.finalActions}>
              <Link
                className={styles.primaryButton}
                href={page.primaryCta.href}
                prefetch={false}
              >
                {publicText(page.primaryCta.label, locale)}
                <ArrowIcon />
              </Link>
              <Link
                className={styles.secondaryButton}
                href={page.secondaryCta.href}
                prefetch={false}
              >
                {publicText(page.secondaryCta.label, locale)}
              </Link>
            </div>
            <nav className={styles.internalLinks} aria-label={copy.internalLinks}>
              {finalLinks.map((link) => (
                <Link href={link.href} key={`${link.href}-${link.label}`} prefetch={false}>
                  {publicText(link.label, locale)}
                </Link>
              ))}
            </nav>
          </section>
        </div>
      </section>

      <PreviewFooter currentPath={page.path} locale={locale} routeMode="production" width="wide" />
    </main>
  );
}
