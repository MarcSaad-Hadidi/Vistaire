import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import QRCode from "qrcode";
import restaurantBackground from "@/Framer/PhotoRestoComplet6.png";
import photoQrCode1 from "@/Framer/PhotoQRcode1.png";
import photoQrCode2 from "@/Framer/PhotoQRcode2.png";
import type { Locale } from "@/lib/i18n";
import { absoluteUrl } from "@/lib/seo";
import {
  getVistaireChromeRoutes,
  PreviewFooter,
  PreviewNav,
  type VistaireRouteMode
} from "./VistairePreviewChrome";
import styles from "./VistaireMenuDigitalRestaurantPreview.module.css";

const journeySteps = [
  {
    step: "01",
    title: "Scan discret",
    text: "Le client ouvre la carte en quelques secondes, sans application et sans friction."
  },
  {
    step: "02",
    title: "Lecture mobile",
    text: "Les catégories, les prix et les plats restent lisibles dans la lumière de la salle."
  },
  {
    step: "03",
    title: "Fiche plat",
    text: "Le client passe d'un nom à une vraie présentation : visuel, détails et allergènes."
  },
  {
    step: "04",
    title: "Choix plus sûr",
    text: "La carte aide la décision sans voler la place du service ni du restaurant."
  }
] as const;

const scanPrinciples = [
  "Un QR code sobre, facile à placer sur table ou chevalet.",
  "Une page d'arrivée mobile-first, pas un PDF qui force le zoom.",
  "Un parcours qui met les plats en valeur dès les premières secondes."
] as const;

const comparisonItems = [
  {
    title: "QR code seul",
    points: [
      "Accès rapide, mais expérience variable.",
      "Souvent un PDF ou une liste standard derrière le scan.",
      "Peu de perception premium si la carte ouverte semble utilitaire."
    ]
  },
  {
    title: "QR code Vistaire",
    points: [
      "Entrée discrète vers une carte digitale haut de gamme.",
      "Fiches plats, visuels, prix et allergènes pensés pour le téléphone.",
      "3D / AR sélective seulement quand elle améliore la compréhension du plat."
    ]
  }
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

function QrCodeMark({
  qrSvgMarkup,
  targetUrl
}: {
  qrSvgMarkup: string;
  targetUrl: string;
}) {
  return (
    <div className={styles.qrCodeMark}>
      <span
        aria-label={`QR code Vistaire vers ${targetUrl}`}
        role="img"
        dangerouslySetInnerHTML={{ __html: qrSvgMarkup }}
      />
    </div>
  );
}

async function buildMenuQrSvg(targetUrl: string) {
  return QRCode.toString(targetUrl, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 3,
    width: 232,
    color: {
      dark: "#120906",
      light: "#fff7ea"
    }
  });
}

export async function VistaireMenuQrCodeRestaurantPreview({
  h1,
  locale = "fr",
  routeMode = "production",
  seoAppendix
}: {
  h1?: string;
  locale?: Locale;
  routeMode?: VistaireRouteMode;
  seoAppendix?: ReactNode;
}) {
  const routes = getVistaireChromeRoutes(routeMode, locale);
  const qrTargetUrl = absoluteUrl(routes.menu);
  const qrSvgMarkup = await buildMenuQrSvg(qrTargetUrl);
  const copy =
    locale === "en"
      ? {
          defaultTitle:
            "QR code restaurant menu: the scan should open an experience",
          badge: "Restaurant QR code",
          lead:
            "The QR code is not the menu. It is the first gesture. Vistaire turns that scan into a premium mobile menu: readable, visual, fast and faithful to the atmosphere of the room.",
          viewMenu: "View the menu",
          appointment: "Book a call",
          afterScan: "After the scan",
          scanTitle: "The QR code is only the entrance",
          scanBody:
            "A printed code can remain discreet and premium. The difference is mostly what opens afterward: a clear, beautiful menu that is usable during service.",
          journeyBadge: "Guest journey",
          journeyTitle: "From scan to decision",
          journeyBody:
            "The QR page should reassure quickly: immediate access, natural reading, useful dish page and desire to order.",
          mobileBadge: "Premium mobile menu",
          mobileTitle: "The scan should lead to something desirable",
          mobileBody:
            "Vistaire avoids the gimmick effect: the QR code opens a menu that creates desire, then dish pages and selective 3D / AR when it truly helps the choice.",
          comparisonBadge: "Comparison",
          comparisonTitle: "QR code alone or Vistaire QR code",
          finalBadge: "Next step",
          finalTitle: "Your QR code deserves better than a PDF",
          finalBody:
            "Let's talk about the first impression your guests discover after the scan, and how Vistaire can extend your dining room on mobile.",
          comparePdf: "Compare with a PDF",
          digitalMenu: "Digital restaurant menu",
          talk: "Talk to Vistaire",
          internalLabel: "Vistaire internal links",
          journeySteps: [
            {
              step: "01",
              title: "Discreet scan",
              text: "The guest opens the menu in seconds, without an app and without friction."
            },
            {
              step: "02",
              title: "Mobile reading",
              text: "Categories, prices and dishes remain readable in the room's light."
            },
            {
              step: "03",
              title: "Dish page",
              text: "The guest moves from a name to a real presentation: visual, details and allergens."
            },
            {
              step: "04",
              title: "Safer choice",
              text: "The menu supports the decision without stealing attention from service or the restaurant."
            }
          ],
          scanPrinciples: [
            "A restrained QR code, easy to place on a table or stand.",
            "A mobile-first landing page, not a PDF that forces zoom.",
            "A journey that highlights dishes in the first seconds."
          ],
          comparisonItems: [
            {
              title: "QR code alone",
              points: [
                "Fast access, but variable experience.",
                "Often a PDF or standard list behind the scan.",
                "Little premium perception if the opened menu feels utilitarian."
              ]
            },
            {
              title: "Vistaire QR code",
              points: [
                "Discreet entrance to a high-end digital menu.",
                "Dish pages, visuals, prices and allergens designed for the phone.",
                "Selective 3D / AR only when it improves understanding of the dish."
              ]
            }
          ]
        }
      : {
          defaultTitle:
            "Menu QR code restaurant : le scan doit ouvrir une expérience",
          badge: "QR code restaurant",
          lead:
            "Le QR code n'est pas la carte. C'est le premier geste. Vistaire transforme ce scan en carte mobile premium : lisible, visuelle, rapide et fidèle à l'ambiance de la salle.",
          viewMenu: "Voir la carte",
          appointment: "Prendre rendez-vous",
          afterScan: "Après le scan",
          scanTitle: "Le QR code n'est qu'une porte d'entrée",
          scanBody:
            "Un code imprimé peut rester discret et premium. La différence se joue surtout sur ce qui s'ouvre ensuite : une carte claire, belle et utilisable pendant le service.",
          journeyBadge: "Parcours client",
          journeyTitle: "Du scan à la décision",
          journeyBody:
            "La page QR code doit rassurer vite : accès immédiat, lecture naturelle, fiche plat utile et envie de commander.",
          mobileBadge: "Carte mobile premium",
          mobileTitle: "Le scan doit mener à quelque chose de désirable",
          mobileBody:
            "Vistaire évite l'effet gadget : le QR code ouvre une carte qui donne envie, puis des fiches plats et une 3D / AR sélective quand cela aide vraiment le choix.",
          comparisonBadge: "Comparaison",
          comparisonTitle: "QR code seul ou QR code Vistaire",
          finalBadge: "Prochaine étape",
          finalTitle: "Votre QR code mérite mieux qu'un PDF",
          finalBody:
            "Parlons de la première impression que vos clients découvrent après le scan, et de la façon dont Vistaire peut prolonger votre salle sur mobile.",
          comparePdf: "Comparer avec un PDF",
          digitalMenu: "Menu digital restaurant",
          talk: "Parler à Vistaire",
          internalLabel: "Liens internes Vistaire",
          journeySteps,
          scanPrinciples,
          comparisonItems
        };
  const pageTitle =
    h1 ?? copy.defaultTitle;
  const pageInternalLinks = [
          { label: copy.viewMenu, href: routes.menu },
          { label: copy.comparePdf, href: routes.pdfVsDigital },
          { label: copy.digitalMenu, href: routes.menuDigital },
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
          activeSection="home"
          currentPath={routes.menuQrCode}
          locale={locale}
          routeMode={routeMode}
        />
      </div>

      <section
        aria-labelledby="menu-qr-code-restaurant-preview-title"
        className={styles.hero}
        id="accueil"
      >
        <div className={styles.previewFrame}>
          <section
            className={`${styles.card} ${styles.qrHeroPanel}`}
            aria-labelledby="menu-qr-code-restaurant-preview-title"
          >
            <div className={styles.qrHeroText}>
              <p className={styles.badge}>{copy.badge}</p>
              <h1 id="menu-qr-code-restaurant-preview-title">
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
            </div>
            <figure className={`${styles.visualFigure} ${styles.qrHeroVisual}`}>
              <Image
                alt="Cliente consultant une carte Vistaire ouverte après scan QR à table"
                className={styles.visualImage}
                fill
                priority
                quality={100}
                sizes="(max-width: 920px) calc(100vw - 56px), 42vw"
                src={photoQrCode1}
                unoptimized
              />
            </figure>
          </section>

          <section
            className={`${styles.card} ${styles.qrScanPanel}`}
            aria-labelledby="scan-title"
          >
            <div className={styles.qrMarkWrap}>
              <QrCodeMark qrSvgMarkup={qrSvgMarkup} targetUrl={qrTargetUrl} />
            </div>
            <div className={styles.qrScanCopy}>
              <p className={styles.badge}>{copy.afterScan}</p>
              <h2 id="scan-title">{copy.scanTitle}</h2>
              <p>{copy.scanBody}</p>
              <div className={styles.qrPrinciples}>
                {copy.scanPrinciples.map((principle) => (
                  <article key={principle}>
                    <h3>{principle}</h3>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section
            className={`${styles.card} ${styles.qrJourneyPanel}`}
            aria-labelledby="journey-title"
          >
            <div className={styles.sectionIntro}>
              <p className={styles.badge}>{copy.journeyBadge}</p>
              <h2 id="journey-title">{copy.journeyTitle}</h2>
              <p>{copy.journeyBody}</p>
            </div>
            <ol className={styles.qrJourneyList}>
              {copy.journeySteps.map((item) => (
                <li key={item.step}>
                  <span>{item.step}</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section
            className={`${styles.card} ${styles.qrExperiencePanel}`}
            aria-labelledby="experience-title"
          >
            <figure className={styles.visualFigure}>
              <Image
                alt="Vue 3D et réalité augmentée Vistaire sur téléphone après ouverture du menu QR"
                className={styles.visualImage}
                fill
                quality={100}
                sizes="(max-width: 920px) calc(100vw - 56px), 38vw"
                src={photoQrCode2}
                unoptimized
              />
            </figure>
            <div className={styles.visualCopy}>
              <p className={styles.badge}>{copy.mobileBadge}</p>
              <h2 id="experience-title">{copy.mobileTitle}</h2>
              <p>{copy.mobileBody}</p>
            </div>
          </section>

          <section
            className={`${styles.card} ${styles.qrComparisonPanel}`}
            aria-labelledby="qr-comparison-title"
          >
            <div className={styles.sectionIntro}>
              <p className={styles.badge}>{copy.comparisonBadge}</p>
              <h2 id="qr-comparison-title">{copy.comparisonTitle}</h2>
            </div>
            <div className={styles.qrComparisonGrid}>
              {copy.comparisonItems.map((item) => (
                <article key={item.title}>
                  <h3>{item.title}</h3>
                  <ul>
                    {item.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section
            className={`${styles.card} ${styles.finalCta}`}
            aria-labelledby="qr-final-cta-title"
          >
            <div>
              <p className={styles.badge}>{copy.finalBadge}</p>
              <h2 id="qr-final-cta-title">{copy.finalTitle}</h2>
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
        currentPath={routes.menuQrCode}
        locale={locale}
        routeMode={routeMode}
        width="wide"
      />
    </main>
  );
}
