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
import type { SeoGeoInternalLink, SeoGeoPageData } from "@/lib/seoGeoPages";

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
    includedTitle: "Ce que Vistaire inclut",
    includedBody:
      "Les nouvelles pages gardent la même direction que les pages Vistaire existantes : mobile-first, food-first, sobre et utile pendant le service.",
    comparison: "Comparaison",
    criterion: "Critère",
    comparisonBody:
      "La différence doit rester concrète : lisibilité, image, informations utiles et performance mobile.",
    faqEyebrow: "FAQ SEO/GEO",
    faqTitle: "Questions fréquentes des restaurateurs",
    faqBody:
      "Des réponses courtes pour les visiteurs, les moteurs de recherche et les assistants IA, sans inventer de promesses.",
    finalEyebrow: "Prochaine étape",
    finalTitle: "Relier cette intention à une expérience Vistaire cohérente.",
    finalBody:
      "Chaque page renvoie vers les guides utiles, le menu exemple ou la prise de rendez-vous, sans créer de cul-de-sac SEO.",
    internalLinks: "Liens internes Vistaire"
  },
  en: {
    actions: "Primary actions",
    direct: "Direct answer",
    context: "Context",
    proof: "Vistaire",
    includedEyebrow: "Included",
    includedTitle: "What Vistaire includes",
    includedBody:
      "These pages follow the same Vistaire direction: mobile-first, food-first, restrained and useful during service.",
    comparison: "Comparison",
    criterion: "Criterion",
    comparisonBody:
      "The difference should stay concrete: readability, image, useful information and mobile performance.",
    faqEyebrow: "SEO/GEO FAQ",
    faqTitle: "Common restaurant questions",
    faqBody:
      "Short answers for visitors, search engines and AI assistants, without inventing promises.",
    finalEyebrow: "Next step",
    finalTitle: "Connect this intent to a coherent Vistaire experience.",
    finalBody:
      "Each page links to useful guides, the sample menu or booking flow, without creating an SEO dead end.",
    internalLinks: "Vistaire internal links"
  }
} as const;

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

  return (
    <main className={styles.page}>
      <Image
        alt=""
        aria-hidden="true"
        className={styles.backgroundImage}
        fill
        priority
        quality={100}
        sizes="100vw"
        src={restaurantBackground}
        unoptimized
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
        <div className={styles.previewFrame}>
          <article className={`${styles.card} ${styles.heroCopy}`}>
            <p className={styles.badge}>{page.eyebrow}</p>
            <h1 id={`${page.slug}-title`}>{page.h1}</h1>
            <p className={styles.heroLead}>{page.directAnswer}</p>
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
                quality={90}
                sizes="(max-width: 920px) calc(100vw - 56px), 20vw"
                src={visuals[0].src}
              />
            </figure>
          </article>

          <section
            className={`${styles.card} ${styles.problemCard}`}
            aria-labelledby={`${page.slug}-direct-answer`}
          >
            <p className={styles.badge}>{copy.direct}</p>
            <h2 id={`${page.slug}-direct-answer`}>{page.productProof.heading}</h2>
            <p>{page.productProof.body}</p>
            <div className={styles.problemList}>
              {page.included.slice(0, 4).map((item) => (
                <section key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </section>
              ))}
            </div>
          </section>

          <section
            className={`${styles.card} ${styles.comparisonCard}`}
            aria-labelledby={`${page.slug}-context-title`}
          >
            <div className={styles.sectionIntro}>
              <p className={styles.badge}>{copy.context}</p>
              <h2 id={`${page.slug}-context-title`}>{page.context.heading}</h2>
              {page.context.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
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
                quality={90}
                sizes="(max-width: 920px) calc(100vw - 56px), 58vw"
                src={visuals[1].src}
              />
            </figure>
            <div className={styles.visualCopy}>
              <p className={styles.badge}>{copy.proof}</p>
              <h2 id={`${page.slug}-proof-title`}>{page.productProof.heading}</h2>
              <p>{page.productProof.body}</p>
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
                quality={90}
                sizes="(max-width: 920px) calc(100vw - 56px), 24vw"
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
                  <th scope="col">{page.comparison.basicLabel}</th>
                  <th scope="col">{page.comparison.vistaireLabel}</th>
                </tr>
              </thead>
              <tbody>
                {page.comparison.rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td data-label={page.comparison.basicLabel}>{row.basic}</td>
                    <td data-label={page.comparison.vistaireLabel}>
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
