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

export function VistaireMenu3dArRestaurantPreview({
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
  const copy =
    locale === "en"
      ? {
          defaultTitle:
            "3D AR restaurant menu: show the dish when it truly helps",
          badge: "Selective 3D / AR",
          lead:
            "Vistaire integrates 3D and augmented reality with restraint: only on dishes where volume, texture or service presentation makes the decision clearer.",
          viewMenu: "View the menu",
          appointment: "Book a call",
          usageBadge: "Premium use",
          usageTitle: "Help guests see the dish from a new angle",
          usageBody:
            "In a high-end restaurant, an immersive view should extend the menu and reassure the guest. It has value only when it clarifies a dish, a texture or a presentation.",
          beforeBadge: "Before the immersive view",
          beforeTitle: "The dish page remains the entry point",
          beforeBody:
            "Guests first see the dish name, price, description, allergens and photo. They can open 3D for selected dishes. Augmented reality depends on the phone, browser and available files; the photo remains accessible.",
          casesBadge: "Use cases",
          casesTitle: "When 3D / AR brings real value",
          casesBody:
            "A different angle can help guests understand the plating and presentation of a signature dish before choosing.",
          premiumBadge: "High-end restaurant",
          premiumTitle: "An immersive menu that respects service",
          premiumBody:
            "Guests choose when to open the immersive view and can return to the menu at any time. Photos and dish details remain the starting point.",
          finalBadge: "Next step",
          finalTitle: "Your signature dishes deserve measured presentation",
          finalBody:
            "Let's talk about the dishes that truly benefit from being seen in volume and how to integrate them without weighing down your menu.",
          digitalMenu: "Digital restaurant menu",
          talk: "Talk to Vistaire",
          internalLabel: "Explore Vistaire services",
          selectivePrinciples: [
            {
              title: "Selective",
              text:
                "3D / AR is not applied to the whole menu. It serves signature dishes that benefit from being seen in volume."
            },
            {
              title: "Built for phones",
              text:
                "The guest understands the dish from the phone before requesting an immersive view."
            },
            {
              title: "No gimmick",
              text:
                "Vistaire keeps the room, service and kitchen at the center. Immersion supports choice; it does not replace the experience."
            }
          ],
          arUseCases: [
            "Signature dessert with important volume, texture or plating.",
            "Iconic dish where presentation influences the decision.",
            "Creation that needs explanation without overloading the main menu."
          ]
        }
      : {
          defaultTitle:
            "Menu 3D AR restaurant : montrer le plat quand cela aide vraiment",
          badge: "3D / AR sélective",
          lead:
            "Vistaire intègre la 3D et la réalité augmentée avec retenue : uniquement sur les plats où le volume, la texture ou le geste de service rendent la décision plus claire.",
          viewMenu: "Voir la carte",
          appointment: "Prendre rendez-vous",
          usageBadge: "Usage premium",
          usageTitle: "Voir le plat sous un autre angle pour mieux choisir",
          usageBody:
            "Dans un restaurant haut de gamme, une vue immersive doit prolonger la carte et rassurer le client. Elle n'a de valeur que si elle clarifie un plat, une texture ou une présentation.",
          beforeBadge: "Avant la vue immersive",
          beforeTitle: "La fiche plat reste le point d'entrée",
          beforeBody:
            "Le client découvre d’abord le nom, le prix, la description, les allergènes et la photo. Il peut ouvrir la 3D sur certains plats. La réalité augmentée dépend du téléphone, du navigateur et des fichiers disponibles; la photo reste accessible.",
          casesBadge: "Cas d'usage",
          casesTitle: "Quand la 3D / AR apporte une vraie valeur",
          casesBody:
            "Un autre angle de vue peut aider le client à comprendre le dressage et la présentation d’un plat signature avant de choisir.",
          premiumBadge: "Restaurant haut de gamme",
          premiumTitle: "Une carte immersive qui respecte le service",
          premiumBody:
            "Le client choisit d’ouvrir la vue immersive et peut revenir à la carte à tout moment. Les photos et les informations du plat restent le point de départ.",
          finalBadge: "Prochaine étape",
          finalTitle: "Vos plats signatures méritent une présentation mesurée",
          finalBody:
            "Parlons des plats qui gagnent vraiment à être vus en volume et de la façon de les intégrer sans alourdir votre carte.",
          digitalMenu: "Menu digital restaurant",
          talk: "Parler à Vistaire",
          internalLabel: "Découvrir les services Vistaire",
          selectivePrinciples: [
            {
              title: "Sélective",
              text:
                "La 3D / AR n'est pas appliquée à toute la carte. Elle sert les plats signatures qui gagnent à être vus en volume."
            },
            {
              title: "Pensée pour le mobile",
              text:
                "Le client comprend le plat depuis son téléphone avant de demander une vue immersive."
            },
            {
              title: "Sans gadget",
              text:
                "Vistaire garde la salle, le service et la cuisine au centre. L'immersion aide le choix, elle ne remplace pas l'expérience."
            }
          ],
          arUseCases: [
            "Dessert signature avec volume, texture ou dressage important.",
            "Plat iconique dont la présentation influence la décision.",
            "Création à expliquer sans alourdir la carte principale."
          ]
        };
  const pageTitle = h1 ?? copy.defaultTitle;
  const internalLinks = [
    { label: copy.viewMenu, href: routes.menu },
    { label: copy.digitalMenu, href: routes.menuDigital },
    { label: copy.talk, href: routes.contact }
  ] as const;

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
          currentPath={routes.menu3dAr}
          locale={locale}
          routeMode={routeMode}
        />
      </div>

      <section
        aria-labelledby="menu-3d-ar-restaurant-title"
        className={styles.hero}
        id="accueil"
      >
        <div className={styles.previewFrame}>
          <article className={`${styles.card} ${styles.heroCopy}`}>
            <p className={styles.badge}>{copy.badge}</p>
            <h1 id="menu-3d-ar-restaurant-title">{pageTitle}</h1>
            <p className={styles.heroLead}>{copy.lead}</p>
            <div className={styles.heroActions} aria-label={locale === "en" ? "Main actions" : "Actions principales"}>
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
                alt={locale === "en"
                  ? "Vistaire 3D and augmented reality views presented on a phone"
                  : "Vue 3D et réalité augmentée Vistaire présentées sur téléphone"}
                className={styles.visualImage}
                fill
                priority
                quality={100}
                sizes="(max-width: 920px) calc(100vw - 56px), 20vw"
                src={photoDigital2}
                unoptimized
              />
            </figure>
          </article>

          <section
            className={`${styles.card} ${styles.problemCard}`}
            aria-labelledby="selective-title"
          >
            <p className={styles.badge}>{copy.usageBadge}</p>
            <h2 id="selective-title">{copy.usageTitle}</h2>
            <p>{copy.usageBody}</p>
            <div className={styles.problemList}>
              {copy.selectivePrinciples.map((principle) => (
                <section key={principle.title}>
                  <h3>{principle.title}</h3>
                  <p>{principle.text}</p>
                </section>
              ))}
            </div>
          </section>

          <section
            className={`${styles.card} ${styles.mobileProofCard}`}
            aria-labelledby="ar-mobile-title"
          >
            <figure className={styles.visualFigure}>
              <Image
                alt={locale === "en"
                  ? "Guest browsing a Vistaire digital menu in a warmly lit restaurant"
                  : "Cliente consultant une carte digitale Vistaire dans un restaurant à la lumière tamisée"}
                className={styles.visualImage}
                fill
                priority
                quality={100}
                sizes="(max-width: 920px) calc(100vw - 56px), 58vw"
                src={photoDigital3}
                unoptimized
              />
            </figure>
            <div className={styles.visualCopy}>
              <p className={styles.badge}>{copy.beforeBadge}</p>
              <h2 id="ar-mobile-title">{copy.beforeTitle}</h2>
              <p>{copy.beforeBody}</p>
            </div>
          </section>

          <section
            className={`${styles.card} ${styles.comparisonCard}`}
            aria-labelledby="use-cases-title"
          >
            <div className={styles.sectionIntro}>
              <p className={styles.badge}>{copy.casesBadge}</p>
              <h2 id="use-cases-title">{copy.casesTitle}</h2>
              <p>{copy.casesBody}</p>
            </div>
            <div className={styles.benefitGrid}>
              {copy.arUseCases.map((useCase) => (
                <article className={styles.benefitItem} key={useCase}>
                  <h3>{useCase}</h3>
                </article>
              ))}
            </div>
          </section>

          <section
            className={`${styles.card} ${styles.premiumPanel}`}
            aria-labelledby="premium-ar-title"
          >
            <div className={styles.premiumContent}>
              <div className={styles.sectionIntro}>
                <p className={styles.badge}>{copy.premiumBadge}</p>
                <h2 id="premium-ar-title">{copy.premiumTitle}</h2>
                <p>{copy.premiumBody}</p>
              </div>
            </div>
            <figure className={`${styles.visualFigure} ${styles.premiumVisual}`}>
              <Image
                alt={locale === "en"
                  ? "Vistaire dish page on a phone beside a signature dessert"
                  : "Fiche plat Vistaire sur téléphone à côté d'un dessert signature"}
                className={styles.visualImage}
                fill
                quality={100}
                sizes="(max-width: 920px) calc(100vw - 56px), 24vw"
                src={pageDigitalPhoto}
                unoptimized
              />
            </figure>
          </section>

          <section
            className={`${styles.card} ${styles.finalCta}`}
            aria-labelledby="final-3d-cta-title"
          >
            <div>
              <p className={styles.badge}>{copy.finalBadge}</p>
              <h2 id="final-3d-cta-title">{copy.finalTitle}</h2>
              <p>{copy.finalBody}</p>
            </div>
            <div className={styles.finalActions}>
              <Link
                className={styles.primaryButton}
                href={routes.appointment}
                prefetch={false}
              >
                {copy.appointment}
                <ArrowIcon />
              </Link>
              <Link className={styles.secondaryButton} href={routes.menu} prefetch={false}>
                {copy.viewMenu}
              </Link>
            </div>
            <nav className={styles.internalLinks} aria-label={copy.internalLabel}>
              {internalLinks.map((item) => (
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
        currentPath={routes.menu3dAr}
        locale={locale}
        routeMode={routeMode}
        width="wide"
      />
    </main>
  );
}
