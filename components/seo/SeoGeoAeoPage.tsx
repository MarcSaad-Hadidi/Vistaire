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
  altEn: string;
  src: StaticImageData | string;
};

const VISUAL_SETS: Record<string, PageVisual[]> = {
  "menu-qr-sans-pdf": [
    {
      src: photoQrCode1,
      alt: "Illustration du support QR Maison Élyse et de sa fiche plat sur téléphone",
      altEn: "Illustration of a Maison Élyse QR display and dish page on a phone"
    },
    {
      src: photoQrCode2,
      alt: "Exemple de menu mobile Vistaire accessible par QR code",
      altEn: "Example of a Vistaire mobile menu accessed by QR code"
    },
    {
      src: pageDigitalPhoto,
      alt: "Illustration de la fiche dessert Maison Élyse sur téléphone",
      altEn: "Illustration of a Maison Élyse dessert page on a phone"
    }
  ],
  "menu-digital-sans-application": [
    {
      src: pageDigitalPhoto,
      alt: "Exemple de fiche plat Vistaire consultable sans application",
      altEn: "Example of a Vistaire dish page viewed without an app"
    },
    {
      src: photoDigital3,
      alt: "Illustration d’un menu digital consulté à table sans application",
      altEn: "Illustration of a digital menu viewed at the table without an app"
    },
    {
      src: photoDigital2,
      alt: "Exemple de menu mobile Vistaire avec présentation visuelle des plats",
      altEn: "Example of a Vistaire mobile menu with visual dish presentation"
    }
  ],
  "remplacer-menu-pdf-restaurant": [
    {
      src: photoPdfCompare,
      alt: "Illustration comparant un menu PDF et une carte digitale Vistaire",
      altEn: "Illustration comparing a PDF menu with a Vistaire digital menu"
    },
    {
      src: photoPdfDetail,
      alt: "Détail illustré d’un menu PDF et d’une carte adaptée au téléphone",
      altEn: "Illustrated detail of a PDF menu and a menu designed for phones"
    },
    {
      src: pageDigitalPhoto,
      alt: "Exemple de fiche plat Vistaire accessible sans PDF",
      altEn: "Example of a Vistaire dish page accessed without a PDF"
    }
  ],
  "alternative-menu-pdf-restaurant": [
    {
      src: photoPdfDetail,
      alt: "Illustration d’un menu PDF comparé à une carte mobile",
      altEn: "Illustration of a PDF menu compared with a mobile menu"
    },
    {
      src: photoPdfCompare,
      alt: "Comparaison illustrée entre PDF et carte digitale",
      altEn: "Illustrated comparison of a PDF and a digital menu"
    },
    {
      src: photoDigital3,
      alt: "Illustration d’une carte digitale consultée à table",
      altEn: "Illustration of a digital menu viewed at the table"
    }
  ],
  "fiche-plat-digitale-restaurant": [
    {
      src: lobsterPlate,
      alt: "Illustration d’un homard présenté comme plat signature",
      altEn: "Illustration of lobster presented as a signature dish"
    },
    {
      src: pageDigitalPhoto,
      alt: "Exemple de fiche plat Maison Élyse avec détails sur mobile",
      altEn: "Example of a Maison Élyse dish page with details on mobile"
    },
    {
      src: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
      alt: "Homard présenté dans le menu de démonstration Vistaire",
      altEn: "Lobster shown in the Vistaire demonstration menu"
    }
  ],
  "menu-restaurant-photos": [
    {
      src: "/images/demo/dishes/tartare-saumon-label-rouge.png",
      alt: "Tartare de saumon présenté dans un menu de démonstration",
      altEn: "Salmon tartare shown in a demonstration menu"
    },
    {
      src: "/images/demo/dishes/risotto-cepes-parmesan.png",
      alt: "Risotto présenté dans un exemple de carte digitale",
      altEn: "Risotto shown in a sample digital menu"
    },
    {
      src: dessertPhoto,
      alt: "Illustration d’un dessert présenté avec soin",
      altEn: "Illustration of a carefully presented dessert"
    }
  ],
  "menu-restaurant-allergenes": [
    {
      src: pageDigitalPhoto,
      alt: "Exemple de fiche plat mobile avec informations pour le client",
      altEn: "Example of a mobile dish page with useful guest information"
    },
    {
      src: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
      alt: "Ravioles présentées dans un menu de démonstration",
      altEn: "Ravioli shown in a demonstration menu"
    },
    {
      src: "/images/demo/dishes/tarte-citron-basilic-pourpre.png",
      alt: "Dessert présenté dans un exemple de menu Vistaire",
      altEn: "Dessert shown in a sample Vistaire menu"
    }
  ],
  "menu-digital-restaurant-montreal": [
    {
      src: photoRestoDining,
      alt: "Illustration d’une salle de restaurant et du dressage d’un plat",
      altEn: "Illustration of a dining room and a dish being plated"
    },
    {
      src: photoDigital3,
      alt: "Illustration d’un menu digital consulté à table",
      altEn: "Illustration of a digital menu viewed at the table"
    },
    {
      src: "/images/demo/dishes/pave-boeuf-mature-bordelaise.png",
      alt: "Plat de bœuf présenté dans un menu de démonstration Vistaire",
      altEn: "Beef dish shown in a Vistaire demonstration menu"
    }
  ],
  "menu-digital-restaurant-laval": [
    {
      src: photoResto,
      alt: "Illustration d’une salle de restaurant à l’ambiance chaleureuse",
      altEn: "Illustration of a dining room with a warm atmosphere"
    },
    {
      src: pageDigitalPhoto,
      alt: "Exemple de fiche dessert Maison Élyse sur téléphone",
      altEn: "Example of a Maison Élyse dessert page on a phone"
    },
    {
      src: "/images/demo/dishes/canette-rotie-figues-epices.png",
      alt: "Canette rôtie présentée dans un menu de démonstration Vistaire",
      altEn: "Roast duck dish shown in a Vistaire demonstration menu"
    }
  ],
  "menu-digital-restaurant-brossard": [
    {
      src: photoRestoDining,
      alt: "Illustration d’un plat dressé dans une salle de restaurant",
      altEn: "Illustration of a dish being plated in a restaurant dining room"
    },
    {
      src: photoQrCode1,
      alt: "Illustration du support QR et du menu mobile Maison Élyse",
      altEn: "Illustration of the Maison Élyse QR display and mobile menu"
    },
    {
      src: "/images/demo/dishes/tartare-saumon-label-rouge.png",
      alt: "Tartare de saumon présenté dans une carte de démonstration Vistaire",
      altEn: "Salmon tartare shown in a Vistaire demonstration menu"
    }
  ],
  "menu-digital-restaurant-haut-de-gamme": [
    {
      src: photoResto,
      alt: "Illustration d’une salle de restaurant haut de gamme",
      altEn: "Illustration of a high-end restaurant dining room"
    },
    {
      src: lobsterPlate,
      alt: "Illustration d’un homard présenté dans un menu haut de gamme",
      altEn: "Illustration of lobster presented in a high-end menu"
    },
    {
      src: beveragePhoto,
      alt: "Illustration d’une boisson signature dans une présentation Vistaire",
      altEn: "Illustration of a signature drink in a Vistaire presentation"
    }
  ],
  "menu-digital-restaurant-gastronomique": [
    {
      src: lobsterPlate,
      alt: "Illustration d’un plat gastronomique présenté dans une carte digitale",
      altEn: "Illustration of a fine dining dish presented in a digital menu"
    },
    {
      src: "/images/demo/dishes/souffle-chocolat-grand-cru.png",
      alt: "Soufflé au chocolat présenté dans un menu de démonstration Vistaire",
      altEn: "Chocolate soufflé shown in a Vistaire demonstration menu"
    },
    {
      src: photoRestoDining,
      alt: "Illustration d’un dressage de plat dans une salle gastronomique",
      altEn: "Illustration of a dish being plated in a fine dining room"
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
    direct: "L’essentiel",
    context: "Votre restaurant",
    proof: "Vistaire",
    includedEyebrow: "Inclus",
    includedTitle: "Ce que l’offre Vistaire inclut",
    includedBody:
      "Une carte personnalisée, des photos de vos plats et des supports QR physiques, préparés avec vous pour la mise en ligne.",
    comparison: "Comparaison",
    criterion: "Critère",
    comparisonBody:
      "Comparez l’accès au menu, la lecture sur téléphone et la présentation des plats pendant le service.",
    faqEyebrow: "Questions fréquentes",
    faqTitle: "Questions fréquentes des restaurateurs",
    faqBody:
      "Les informations utiles pour préparer votre carte et comprendre le fonctionnement du service.",
    finalEyebrow: "Prochaine étape",
    finalTitle: "Parlons du menu de votre restaurant.",
    finalBody:
      "Découvrez les démonstrations, consultez les tarifs ou présentez-nous votre projet. Nous définirons avec vous la carte et les supports adaptés à votre salle.",
    internalLinks: "Guides Vistaire"
  },
  en: {
    actions: "Primary actions",
    direct: "At a glance",
    context: "Your restaurant",
    proof: "With Vistaire",
    includedEyebrow: "Included",
    includedTitle: "What the Vistaire service includes",
    includedBody:
      "A custom menu, photographs of your food and physical QR displays, prepared with you before launch.",
    comparison: "Comparison",
    criterion: "Criterion",
    comparisonBody:
      "Compare menu access, reading on a phone and the way dishes are presented during service.",
    faqEyebrow: "Questions",
    faqTitle: "Common restaurant questions",
    faqBody:
      "Practical answers to help you prepare your menu and understand the service.",
    finalEyebrow: "Next step",
    finalTitle: "Let’s talk about your restaurant’s menu.",
    finalBody:
      "Explore the demonstrations, review pricing or tell us about your project. We’ll help you choose the menu presentation and displays that suit your dining room.",
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
  const visuals = VISUAL_SETS[visualKey]?.map((visual) => ({
    src: visual.src,
    alt: locale === "en" ? visual.altEn : visual.alt
  })) ?? [page.visualImage, page.visualImage, page.visualImage];
  const finalLinks = uniqueLinks([
    ...page.relatedLinks,
    page.primaryCta,
    page.secondaryCta
  ]);

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
            <p className={styles.badge}>{page.eyebrow}</p>
            <h1 id={`${page.slug}-title`}>{page.h1}</h1>
            <p className={styles.heroLead}>
              {page.directAnswer}
            </p>
            <div className={styles.heroActions} aria-label={copy.actions}>
              <Link
                className={styles.primaryButton}
                href={page.primaryCta.href}
                prefetch={false}
              >
                {page.primaryCta.label}
                <ArrowIcon />
              </Link>
              <Link
                className={styles.secondaryButton}
                href={page.secondaryCta.href}
                prefetch={false}
              >
                {page.secondaryCta.label}
              </Link>
            </div>
            <figure className={`${styles.visualFigure} ${styles.heroVisual}`}>
              <Image
                alt={visuals[0].alt}
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
              {page.context.heading}
            </h2>
            {page.context.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {page.context.points ? (
              <div className={styles.problemList}>
                {page.context.points.map((point) => (
                  <section key={point}>
                    <h3>{point}</h3>
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
                alt={visuals[1].alt}
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
                {page.productProof.heading}
              </h2>
              <p>{page.productProof.body}</p>
              {page.productProof.points.length > 0 ? (
                <ul className={styles.proofPoints}>
                  {page.productProof.points.map((point) => (
                    <li key={point}>{point}</li>
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
                    <h3>{item.title}</h3>
                    <p className="mt-3 text-[13px] font-medium leading-[1.45] text-[#f4e5cd]/72">
                      {item.text}
                    </p>
                  </article>
                ))}
              </div>
            </div>
            <figure className={`${styles.visualFigure} ${styles.premiumVisual}`}>
              <Image
                alt={visuals[2].alt}
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
                {page.comparison.heading}
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
                    {page.comparison.basicLabel}
                  </th>
                  <th scope="col">
                    {page.comparison.vistaireLabel}
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.comparison.rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td
                      data-label={page.comparison.basicLabel}
                    >
                      {row.basic}
                    </td>
                    <td
                      data-label={page.comparison.vistaireLabel}
                    >
                      {row.vistaire}
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
              <SeoFaq faqs={page.faq} layout="stack" locale={locale} />
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
                {page.primaryCta.label}
                <ArrowIcon />
              </Link>
              <Link
                className={styles.secondaryButton}
                href={page.secondaryCta.href}
                prefetch={false}
              >
                {page.secondaryCta.label}
              </Link>
            </div>
            <nav className={styles.internalLinks} aria-label={copy.internalLinks}>
              {finalLinks.map((link) => (
                <Link href={link.href} key={`${link.href}-${link.label}`} prefetch={false}>
                  {link.label}
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
