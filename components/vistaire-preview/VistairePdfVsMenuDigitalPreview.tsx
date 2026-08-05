import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import comparisonPhoto from "@/Framer/PhotoComparaisonPDF.png";
import detailComparisonPhoto from "@/Framer/PhotoPDFvsDigitalDetail.png";
import restaurantBackground from "@/Framer/PhotoRestoComplet3.png";
import type { Locale } from "@/lib/i18n";
import {
  getVistaireChromeRoutes,
  PreviewFooter,
  PreviewNav,
  type VistaireRouteMode
} from "./VistairePreviewChrome";
import styles from "./VistairePdfVsMenuDigitalPreview.module.css";

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

export function VistairePdfVsMenuDigitalPreview({
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
            "PDF vs digital menu: why high-end restaurants should evolve",
          badge: "Restaurant guide",
          lead:
            "A PDF menu reproduces a paper menu on a screen. Vistaire turns the menu into a premium mobile experience: clear, visual, fast and designed to create desire.",
          viewMenu: "View the menu",
          appointment: "Book a call",
          sliderEyebrow: "PDF or Vistaire",
          sliderTitle: "The difference is visible on mobile.",
          pdfBadge: "PDF menu",
          pdfTitle: "The problem with PDF menus",
          digitalBadge: "Premium digital menu",
          digitalTitle: "What a premium digital menu adds",
          digitalBody:
            "A good mobile menu does not replace the dining room. It extends the restaurant's attention to detail, clarifies choice and gives dishes the space they deserve.",
          comparisonBadge: "Comparison",
          comparisonTitle: "PDF menu vs digital menu",
          comparisonBody:
            "The QR code is not the problem. What matters is what the guest discovers after the scan: a file to endure, a standard interface, or a Vistaire experience.",
          criterion: "Criterion",
          pdf: "PDF menu",
          standard: "Standard digital menu",
          restaurantBadge: "High-end restaurant",
          restaurantTitle:
            "A digital menu should not turn the restaurant into a cold app",
          restaurantBody:
            "Vistaire keeps the dish, the room and the restaurant image at the center. 3D / AR stays selective, useful and reserved for creations that truly benefit from visualization. Digital supports the guest decision without taking the place of hospitality, service and the kitchen.",
          finalBadge: "Next step",
          finalTitle: "Your menu deserves better than a PDF",
          finalBody:
            "Let's talk about your menu, signature dishes, service constraints and the level of presentation your guests should feel on mobile.",
          understand: "Understand Vistaire",
          talk: "Talk to Vistaire",
          internalLabel: "Vistaire internal links",
          pdfProblems: [
            {
              title: "Difficult reading",
              text:
                "On mobile, the guest pinches the screen, searches categories and loses the flow of the menu instead of looking at dishes."
            },
            {
              title: "Static presentation",
              text:
                "A PDF remains a fixed page. Signature dishes, allergens and prices exist, but without a clear path or presentation."
            },
            {
              title: "Heavy updates",
              text:
                "Changing a PDF menu often means regenerating a file, checking the link and hoping the old version no longer circulates."
            }
          ],
          digitalBenefits: [
            "Readable category navigation",
            "Visual dish pages and short text",
            "Clearer prices, allergens and useful badges",
            "Premium photos that create desire",
            "Selective 3D / AR only when it helps choice",
            "Fluid mobile experience, no app download"
          ],
          comparisonRows: [
            {
              label: "Mobile readability",
              pdf: "Zoom, horizontal movement and dense reading.",
              standard: "More readable text, often less elegant.",
              vistaire: "Menu designed for the phone, with clear hierarchy."
            },
            {
              label: "High-end image",
              pdf: "The file can feel utilitarian.",
              standard: "Functional interface, sometimes generic.",
              vistaire: "Warm dark surfaces, food-first visuals and premium tone."
            },
            {
              label: "Dish pages",
              pdf: "Details limited by the layout.",
              standard: "Descriptions possible, often uniform.",
              vistaire:
                "Visual pages with prices, allergens, badges and short story."
            },
            {
              label: "Navigation",
              pdf: "The guest searches through a full page.",
              standard: "Simple categories.",
              vistaire: "Guided mobile path, useful during service."
            },
            {
              label: "Updates",
              pdf: "New file and old-version risks.",
              standard: "Faster, depending on the tool.",
              vistaire: "A digital menu that is simpler to evolve."
            },
            {
              label: "Desire",
              pdf: "Little room for photo and intention.",
              standard: "Visuals possible but rarely memorable.",
              vistaire: "Dish presentation at the center of the experience."
            },
            {
              label: "3D / AR",
              pdf: "No useful immersive experience.",
              standard: "Often gimmicky if it is everywhere.",
              vistaire: "Selective 3D / AR for dishes that deserve it."
            },
            {
              label: "Guest experience",
              pdf: "Forced reading after the QR code.",
              standard: "Correct consultation.",
              vistaire: "Clear, visual experience coherent with the room."
            }
          ]
        }
      : {
          defaultTitle:
            "PDF vs menu digital : pourquoi les restaurants haut de gamme doivent évoluer",
          badge: "Guide restaurateur",
          lead:
            "Un menu PDF reproduit une carte papier sur un écran. Vistaire transforme la carte en expérience mobile premium : claire, visuelle, rapide et pensée pour donner envie.",
          viewMenu: "Voir la carte",
          appointment: "Prendre rendez-vous",
          sliderEyebrow: "PDF ou Vistaire",
          sliderTitle: "La différence se voit sur mobile.",
          pdfBadge: "Menu PDF",
          pdfTitle: "Le problème du menu PDF",
          digitalBadge: "Carte digitale premium",
          digitalTitle: "Ce qu'apporte une carte digitale premium",
          digitalBody:
            "Une bonne carte mobile ne remplace pas la salle. Elle prolonge le niveau d'attention du restaurant, clarifie le choix et donne aux plats l'espace qu'ils méritent.",
          comparisonBadge: "Comparaison",
          comparisonTitle: "Menu PDF vs menu digital",
          comparisonBody:
            "Le QR code n'est pas le problème. Ce qui compte, c'est ce que le client découvre après le scan : un fichier à subir, une interface standard, ou une expérience Vistaire.",
          criterion: "Critère",
          pdf: "Menu PDF",
          standard: "Menu digital standard",
          restaurantBadge: "Restaurant haut de gamme",
          restaurantTitle:
            "Un menu digital ne doit pas transformer le restaurant en application froide",
          restaurantBody:
            "Vistaire garde le plat, la salle et l'image du restaurant au centre. La 3D / AR reste sélective, utile et réservée aux créations qui gagnent vraiment à être visualisées. Le digital sert la décision du client sans voler la place de l'accueil, du service et de la cuisine.",
          finalBadge: "Prochaine étape",
          finalTitle: "Votre carte mérite mieux qu'un PDF",
          finalBody:
            "Parlons de votre carte, de vos plats signatures, de vos contraintes de service et du niveau de présentation que vos clients doivent ressentir sur mobile.",
          understand: "Comprendre Vistaire",
          talk: "Parler à Vistaire",
          internalLabel: "Liens internes Vistaire",
          pdfProblems: [
            {
              title: "Lecture difficile",
              text:
                "Sur mobile, le client pince l'écran, cherche les catégories et perd le fil de la carte au lieu de regarder les plats."
            },
            {
              title: "Présentation statique",
              text:
                "Un PDF reste une page fixe. Les plats signatures, les allergènes et les prix existent, mais sans parcours clair ni mise en scène."
            },
            {
              title: "Mise à jour lourde",
              text:
                "Modifier une carte PDF demande souvent de régénérer un fichier, vérifier le lien et espérer que l'ancienne version ne circule plus."
            }
          ],
          digitalBenefits: [
            "Navigation par catégories lisibles",
            "Fiches plats visuelles et textes courts",
            "Prix, allergènes et badges utiles plus clairs",
            "Photos premium qui donnent envie",
            "3D / AR sélective seulement quand elle aide le choix",
            "Expérience mobile fluide, sans application à télécharger"
          ],
          comparisonRows: [
            {
              label: "Lisibilité mobile",
              pdf: "Zoom, déplacement latéral et lecture dense.",
              standard: "Texte plus lisible, mais souvent peu élégant.",
              vistaire: "Carte pensée pour le téléphone, avec hiérarchie claire."
            },
            {
              label: "Image haut de gamme",
              pdf: "Le fichier peut paraître utilitaire.",
              standard: "Interface fonctionnelle, parfois générique.",
              vistaire: "Surfaces sombres, visuels food-first et ton premium."
            },
            {
              label: "Fiches plats",
              pdf: "Détails limités par la mise en page.",
              standard: "Descriptions possibles, souvent uniformes.",
              vistaire:
                "Fiches visuelles avec prix, allergènes, badges et récit court."
            },
            {
              label: "Navigation",
              pdf: "Le client cherche dans une page complète.",
              standard: "Catégories simples.",
              vistaire: "Parcours mobile guidé, utile pendant le service."
            },
            {
              label: "Mise à jour",
              pdf: "Nouveau fichier et risques d'ancienne version.",
              standard: "Plus rapide, selon l'outil.",
              vistaire: "Carte digitale plus simple à faire évoluer."
            },
            {
              label: "Capacité à donner envie",
              pdf: "Peu d'espace pour la photo et l'intention.",
              standard: "Visuels possibles mais rarement mémorables.",
              vistaire: "Présentation des plats au centre de l'expérience."
            },
            {
              label: "3D / AR",
              pdf: "Aucune expérience immersive utile.",
              standard: "Option souvent gadget si elle est partout.",
              vistaire: "3D / AR sélective pour les plats qui le méritent."
            },
            {
              label: "Expérience client",
              pdf: "Lecture subie après le QR code.",
              standard: "Consultation correcte.",
              vistaire:
                "Expérience claire, visuelle et cohérente avec la salle."
            }
          ]
        };
  const pageTitle = h1 ?? copy.defaultTitle;
  const pageInternalLinks = [
          { label: copy.viewMenu, href: routes.menu },
          { label: copy.understand, href: routes.about },
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
          currentPath={routes.pdfVsDigital}
          locale={locale}
          routeMode={routeMode}
        />
      </div>

      <section
        aria-labelledby="pdf-vs-menu-digital-preview-title"
        className={styles.hero}
      >
        <div className={styles.previewFrame}>
          <article className={`${styles.card} ${styles.heroCopy}`}>
            <p className={styles.badge}>{copy.badge}</p>
            <h1 id="pdf-vs-menu-digital-preview-title">{pageTitle}</h1>
            <p className={styles.heroLead}>{copy.lead}</p>
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
          </article>

          <article className={`${styles.card} ${styles.sliderCard}`}>
            <div className={styles.sliderIntro}>
              <p>{copy.sliderEyebrow}</p>
              <h2>{copy.sliderTitle}</h2>
            </div>
            {interactiveShowcase}
          </article>

          <article className={`${styles.card} ${styles.problemCard}`}>
            <p className={styles.badge}>{copy.pdfBadge}</p>
            <h2>{copy.pdfTitle}</h2>
            <div className={styles.problemList}>
              {copy.pdfProblems.map((problem) => (
                <section key={problem.title}>
                  <h3>{problem.title}</h3>
                  <p>{problem.text}</p>
                </section>
              ))}
            </div>
          </article>

          <section
            className={`${styles.card} ${styles.digitalCard}`}
            aria-labelledby="digital-premium-title"
          >
            <div className={styles.sectionIntro}>
              <p className={styles.badge}>{copy.digitalBadge}</p>
              <h2 id="digital-premium-title">{copy.digitalTitle}</h2>
              <p>{copy.digitalBody}</p>
            </div>
            <div className={styles.benefitGrid}>
              {copy.digitalBenefits.map((benefit) => (
                <article className={styles.benefitItem} key={benefit}>
                  <h3>{benefit}</h3>
                </article>
              ))}
            </div>
          </section>

          <section
            className={`${styles.card} ${styles.comparisonCard}`}
            id="comparaison"
            aria-labelledby="comparison-title"
          >
            <div className={styles.comparisonGrid}>
              <div className={styles.comparisonContent}>
                <div className={styles.sectionIntro}>
                  <p className={styles.badge}>{copy.comparisonBadge}</p>
                  <h2 id="comparison-title">{copy.comparisonTitle}</h2>
                  <p>{copy.comparisonBody}</p>
                </div>

                <figure className={styles.comparisonVisual}>
                  <Image
                    alt="Deux téléphones comparent un menu PDF et une carte digitale Vistaire sur une table de restaurant haut de gamme."
                    fill
                    quality={100}
                    sizes="(max-width: 920px) calc(100vw - 72px), 620px"
                    src={comparisonPhoto}
                    unoptimized
                  />
                </figure>

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
              </div>
            </div>
          </section>

          <section
            className={`${styles.card} ${styles.restaurantPanel}`}
            aria-labelledby="restaurant-title"
          >
            <figure className={styles.detailVisual}>
              <Image
                alt="Fiche plat Vistaire affichée sur téléphone à côté d'un plat de homard dans un restaurant haut de gamme."
                fill
                quality={100}
                sizes="(max-width: 920px) calc(100vw - 72px), 620px"
                src={detailComparisonPhoto}
                unoptimized
              />
            </figure>
            <p className={styles.badge}>{copy.restaurantBadge}</p>
            <h2 id="restaurant-title">{copy.restaurantTitle}</h2>
            <p>{copy.restaurantBody}</p>
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
        currentPath={routes.pdfVsDigital}
        locale={locale}
        routeMode={routeMode}
        width="wide"
      />
    </main>
  );
}
