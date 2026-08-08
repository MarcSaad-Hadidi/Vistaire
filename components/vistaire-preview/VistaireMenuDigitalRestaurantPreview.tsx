import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import restaurantBackground from "@/Framer/PhotoRestoComplet5.png";
import pageDigitalPhoto from "@/Framer/PageDigital.png";
import photoDigital2 from "@/Framer/PhotoDigital2.png";
import photoDigital3 from "@/Framer/PhotoDigital3.png";
import type { Locale } from "@/lib/i18n";
import {
  getVistaireChromeRoutes,
  PreviewFooter,
  PreviewNav,
  type VistaireRouteMode
} from "./VistairePreviewChrome";
import styles from "./VistaireMenuDigitalRestaurantPreview.module.css";

const pdfProblems = [
  {
    title: "Zoom forcé",
    text:
      "Le client agrandit, recadre et perd le fil au lieu de parcourir la carte naturellement."
  },
  {
    title: "Plats peu désirables",
    text:
      "Une page fixe laisse peu de place aux visuels, aux détails utiles et aux signatures de la maison."
  },
  {
    title: "Mobile secondaire",
    text:
      "Le PDF reproduit l'imprimé. Vistaire pense d'abord l'écran que le client tient à table."
  },
  {
    title: "Image moins premium",
    text:
      "Un fichier statique peut donner une impression pratique, mais rarement une vraie expérience de restaurant."
  }
] as const;

const comparisonRows = [
  {
    label: "Lisibilité mobile",
    pdf: "Zoom, page fixe et lecture dense.",
    standard: "Liste plus lisible, souvent générique.",
    vistaire: "Navigation claire, catégories et fiches adaptées au téléphone."
  },
  {
    label: "Qualité visuelle",
    pdf: "Peu d'espace pour la mise en scène.",
    standard: "Visuels possibles, mais rarement premium.",
    vistaire: "Food-first, surfaces sombres et accents champagne."
  },
  {
    label: "Envie de choisir",
    pdf: "Le client cherche une ligne.",
    standard: "Le client consulte une liste.",
    vistaire: "Le client découvre des plats, des prix lisibles et des détails utiles."
  },
  {
    label: "Fiches plats",
    pdf: "Détails limités par la mise en page.",
    standard: "Descriptions possibles, souvent uniformes.",
    vistaire: "Fiches visuelles avec prix, allergènes, badges et récit court."
  },
  {
    label: "Mise à jour",
    pdf: "Nouveau fichier et risque d'ancienne version.",
    standard: "Plus rapide, selon l'outil.",
    vistaire: "Carte digitale plus simple à faire évoluer."
  },
  {
    label: "3D / AR",
    pdf: "Impossible dans le fichier.",
    standard: "Souvent gadget si tout est traité pareil.",
    vistaire: "Sélective, réservée aux plats qui gagnent à être vus en volume."
  }
] as const;

const premiumPoints = [
  "Une présentation sobre qui respecte l'identité du lieu.",
  "Des fiches plats visuelles sans transformer la carte en application froide.",
  "Une 3D / AR sélective, utile seulement quand elle rend le plat plus clair."
] as const;

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

export function VistaireMenuDigitalRestaurantPreview({
  h1,
  locale = "fr",
  routeMode = "production",
  seoAppendix,
  interactiveShowcase
}: {
  h1?: string;
  locale?: Locale;
  routeMode?: VistaireRouteMode;
  seoAppendix?: ReactNode;
  interactiveShowcase?: ReactNode;
}) {
  const routes = getVistaireChromeRoutes(routeMode, locale);
  const copy =
    locale === "en"
      ? {
          defaultTitle:
            "Digital restaurant menu: a premium menu designed for mobile",
          badge: "Restaurant guide",
          lead:
            "Vistaire turns a restaurant QR code into an elegant, fast and visual digital menu: clear categories, desirable dish pages, readable prices, allergens and selective 3D / AR when it brings real value.",
          viewMenu: "View the menu",
          appointment: "Book a call",
          pdfBadge: "PDF menu",
          pdfTitle: "Why a PDF menu is no longer enough",
          pdfBody:
            "The PDF remains practical for printing a menu, but it behaves poorly in the real context of service: table, low light, phone in one hand and quick decisions.",
          revealEyebrow: "PDF to Vistaire",
          revealTitle: "From PDF menu to Vistaire experience",
          revealDesktop: "Hover to reveal Vistaire.",
          revealMobile: "Slide on the card to reveal Vistaire.",
          comparisonBadge: "Comparison",
          comparisonTitle: "PDF, standard digital menu or Vistaire",
          comparisonBody:
            "The difference is not only the QR code. It is what the guest discovers after the scan: a file to endure, a standard interface, or a Vistaire experience.",
          criterion: "Criterion",
          pdf: "PDF menu",
          standard: "Standard digital menu",
          mobileBadge: "Mobile menu in context",
          mobileTitle: "A menu designed for the table",
          mobileBody:
            "Vistaire stays readable in the real restaurant context: low light, one-handed phone use, quick decisions and dishes that must remain desirable.",
          premiumBadge: "High-end restaurant",
          premiumTitle: "Designed for high-end restaurants",
          premiumBody:
            "Digital should extend the restaurant experience, not replace it. Vistaire keeps the room, the dishes and the rhythm of service at the center.",
          finalBadge: "Next step",
          finalTitle: "Your menu deserves better than a PDF",
          finalBody:
            "Let's talk about your menu, signature dishes and the level of presentation your guests should feel on mobile.",
          comparePdf: "Compare with a PDF",
          talk: "Talk to Vistaire",
          internalLabel: "Vistaire internal links",
          pdfProblems: [
            {
              title: "Forced zoom",
              text:
                "The guest enlarges, reframes and loses the thread instead of browsing the menu naturally."
            },
            {
              title: "Dishes feel less desirable",
              text:
                "A fixed page leaves little room for visuals, useful details and house signatures."
            },
            {
              title: "Mobile comes second",
              text:
                "The PDF reproduces print. Vistaire starts from the screen the guest holds at the table."
            },
            {
              title: "Less premium image",
              text:
                "A static file can feel practical, but rarely like a true restaurant experience."
            }
          ],
          comparisonRows: [
            {
              label: "Mobile readability",
              pdf: "Zoom, fixed page and dense reading.",
              standard: "More readable list, often generic.",
              vistaire:
                "Clear navigation, categories and dish pages adapted to the phone."
            },
            {
              label: "Visual quality",
              pdf: "Little room for presentation.",
              standard: "Visuals possible, rarely premium.",
              vistaire: "Food-first visuals, warm dark surfaces and champagne accents."
            },
            {
              label: "Desire to choose",
              pdf: "The guest searches for a line.",
              standard: "The guest reads a list.",
              vistaire:
                "The guest discovers dishes, readable prices and useful details."
            },
            {
              label: "Dish pages",
              pdf: "Details limited by the layout.",
              standard: "Descriptions possible, often uniform.",
              vistaire:
                "Visual pages with prices, allergens, badges and short story."
            },
            {
              label: "Updates",
              pdf: "New file and risk of an old version.",
              standard: "Faster, depending on the tool.",
              vistaire: "A digital menu that is simpler to evolve."
            },
            {
              label: "3D / AR",
              pdf: "Impossible in the file.",
              standard: "Often gimmicky if everything is treated the same.",
              vistaire:
                "Selective, reserved for dishes that benefit from volume."
            }
          ],
          premiumPoints: [
            "A calm presentation that respects the identity of the place.",
            "Visual dish pages without turning the menu into a cold app.",
            "Selective 3D / AR, useful only when it makes the dish clearer."
          ]
        }
      : {
          defaultTitle:
            "Menu digital restaurant : une carte premium pensée pour le mobile",
          badge: "Guide restaurateur",
          lead:
            "Vistaire transforme le QR code d'un restaurant en carte digitale élégante, rapide et visuelle : catégories claires, fiches plats désirables, prix lisibles, allergènes et 3D / AR sélective quand elle apporte une vraie valeur.",
          viewMenu: "Voir la carte",
          appointment: "Prendre rendez-vous",
          pdfBadge: "Menu PDF",
          pdfTitle: "Pourquoi un menu PDF ne suffit plus",
          pdfBody:
            "Le PDF reste pratique pour imprimer une carte, mais il se comporte mal dans le contexte réel du service : table, lumière, téléphone tenu d'une main et décision rapide.",
          revealEyebrow: "PDF vers Vistaire",
          revealTitle: "Du menu PDF à l'expérience Vistaire",
          revealDesktop: "Survolez pour révéler Vistaire.",
          revealMobile: "Glissez le doigt sur la carte pour révéler Vistaire.",
          comparisonBadge: "Comparaison",
          comparisonTitle: "PDF, menu digital standard ou Vistaire",
          comparisonBody:
            "La différence ne tient pas seulement au QR code. Elle tient à ce que le client découvre après le scan : un fichier à subir, une interface standard, ou une expérience Vistaire.",
          criterion: "Critère",
          pdf: "Menu PDF",
          standard: "Menu digital standard",
          mobileBadge: "Carte mobile en situation",
          mobileTitle: "Une carte pensée pour la table",
          mobileBody:
            "Vistaire reste lisible dans le vrai contexte du restaurant : lumière basse, téléphone tenu d'une main, décision rapide et plats qui doivent rester désirables.",
          premiumBadge: "Restaurant haut de gamme",
          premiumTitle: "Pensé pour les restaurants haut de gamme",
          premiumBody:
            "Le digital doit prolonger l'expérience du restaurant, pas la remplacer. Vistaire garde la salle, les plats et le rythme du service au centre.",
          finalBadge: "Prochaine étape",
          finalTitle: "Votre carte mérite mieux qu'un PDF",
          finalBody:
            "Parlons de votre carte, de vos plats signatures et du niveau de présentation que vos clients doivent ressentir sur mobile.",
          comparePdf: "Comparer avec un PDF",
          talk: "Parler à Vistaire",
          internalLabel: "Liens internes Vistaire",
          pdfProblems,
          comparisonRows,
          premiumPoints
        };
  const pageTitle =
    h1 ?? copy.defaultTitle;
  const pageInternalLinks = [
          { label: copy.viewMenu, href: routes.menu },
          { label: copy.comparePdf, href: routes.pdfVsDigital },
          { label: copy.talk, href: routes.contact }
        ];
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
          currentPath={routes.menuDigital}
          locale={locale}
          routeMode={routeMode}
        />
      </div>

      <section
        aria-labelledby="menu-digital-restaurant-preview-title"
        className={styles.hero}
      >
        <div className={styles.previewFrame}>
          <article className={`${styles.card} ${styles.heroCopy}`}>
            <p className={styles.badge}>{copy.badge}</p>
            <h1
              aria-label={pageTitle}
              id="menu-digital-restaurant-preview-title"
            >
              {pageTitle}
            </h1>
            <p className={styles.heroLead}>
              {copy.lead}
            </p>
            <div className={styles.heroActions} aria-label="Actions principales">
              <Link className={styles.primaryButton} href={routes.menu} prefetch={false}>
                {copy.viewMenu}
                <ArrowIcon />
              </Link>
              <Link
                className={styles.secondaryButton}
                href={routes.appointment}
                prefetch={false}
              >
                {copy.appointment}
              </Link>
            </div>
            <figure className={`${styles.visualFigure} ${styles.heroVisual}`}>
              <Image
                alt="Dessert signature avec fiche plat Vistaire affichée sur téléphone"
                className={styles.visualImage}
                fill
                quality={100}
                sizes="(max-width: 920px) calc(100vw - 56px), 20vw"
                src={pageDigitalPhoto}
                unoptimized
              />
            </figure>
          </article>

          <article
            className={`${styles.card} ${styles.problemCard}`}
            aria-labelledby="pdf-problem-title"
          >
            <p className={styles.badge}>{copy.pdfBadge}</p>
            <h2 id="pdf-problem-title">{copy.pdfTitle}</h2>
            <p>{copy.pdfBody}</p>
            <div className={styles.problemList}>
              {copy.pdfProblems.map((problem) => (
                <section key={problem.title}>
                  <h3>{problem.title}</h3>
                  <p>{problem.text}</p>
                </section>
              ))}
            </div>
          </article>

          <article
            className={`${styles.card} ${styles.revealCard}`}
            id="carte"
            aria-labelledby="hover-reveal-title"
          >
            <div className={styles.revealIntro}>
              <p>{copy.revealEyebrow}</p>
              <h2 id="hover-reveal-title">{copy.revealTitle}</h2>
              <span className={styles.desktopInstruction}>
                {copy.revealDesktop}
              </span>
              <span className={styles.mobileInstruction}>
                {copy.revealMobile}
              </span>
            </div>
            <div className={styles.revealPreviewWrap}>
              {interactiveShowcase}
            </div>
          </article>

          <section
            className={`${styles.card} ${styles.comparisonCard}`}
            aria-labelledby="comparison-title"
          >
            <div className={styles.sectionIntro}>
              <p className={styles.badge}>{copy.comparisonBadge}</p>
              <h2 id="comparison-title">{copy.comparisonTitle}</h2>
              <p>{copy.comparisonBody}</p>
            </div>
            <table className={styles.comparisonTable}>
              <thead>
                <tr>
                  <th scope="col">{copy.criterion}</th>
                  <th scope="col">{copy.pdf}</th>
                  <th scope="col">{copy.standard}</th>
                  <th scope="col">Vistaire</th>
                </tr>
              </thead>
              <tbody>
                {copy.comparisonRows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td data-label={copy.pdf}>{row.pdf}</td>
                    <td data-label={copy.standard}>{row.standard}</td>
                    <td data-label="Vistaire">{row.vistaire}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section
            className={`${styles.card} ${styles.mobileProofCard}`}
            aria-labelledby="mobile-proof-title"
          >
            <figure className={styles.visualFigure}>
              <Image
                alt="Cliente consultant une carte digitale Vistaire sur téléphone pendant le service"
                className={styles.visualImage}
                fill
                quality={100}
                sizes="(max-width: 920px) calc(100vw - 56px), 58vw"
                src={photoDigital3}
                unoptimized
              />
            </figure>
            <div className={styles.visualCopy}>
              <p className={styles.badge}>{copy.mobileBadge}</p>
              <h2 id="mobile-proof-title">{copy.mobileTitle}</h2>
              <p>{copy.mobileBody}</p>
            </div>
          </section>

          <section
            className={`${styles.card} ${styles.premiumPanel}`}
            aria-labelledby="premium-title"
          >
            <div className={styles.premiumContent}>
              <div className={styles.sectionIntro}>
                <p className={styles.badge}>{copy.premiumBadge}</p>
                <h2 id="premium-title">{copy.premiumTitle}</h2>
                <p>{copy.premiumBody}</p>
              </div>
              <div className={styles.benefitGrid}>
                {copy.premiumPoints.map((point) => (
                  <article className={styles.benefitItem} key={point}>
                    <h3>{point}</h3>
                  </article>
                ))}
              </div>
            </div>
            <figure className={`${styles.visualFigure} ${styles.premiumVisual}`}>
              <Image
                alt="Vue 3D et réalité augmentée Vistaire présentées sur téléphone à table"
                className={styles.visualImage}
                fill
                quality={100}
                sizes="(max-width: 920px) calc(100vw - 56px), 24vw"
                src={photoDigital2}
                unoptimized
              />
            </figure>
          </section>

          <section
            className={`${styles.card} ${styles.finalCta}`}
            aria-labelledby="final-cta-title"
          >
            <div>
              <p className={styles.badge}>{copy.finalBadge}</p>
              <h2 id="final-cta-title">{copy.finalTitle}</h2>
              <p>{copy.finalBody}</p>
            </div>
            <div className={styles.finalActions}>
              <Link className={styles.primaryButton} href={routes.appointment} prefetch={false}>
                {copy.appointment}
                <ArrowIcon />
              </Link>
              <Link className={styles.secondaryButton} href={routes.menu} prefetch={false}>
                {copy.viewMenu}
              </Link>
            </div>
            <nav className={styles.internalLinks} aria-label={copy.internalLabel}>
              {pageInternalLinks.map((item) => (
                <Link href={item.href} key={item.href} prefetch={false}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </section>

          {seoAppendix}
        </div>
      </section>

      <PreviewFooter
        currentPath={routes.menuDigital}
        locale={locale}
        routeMode={routeMode}
        width="wide"
      />
    </main>
  );
}
