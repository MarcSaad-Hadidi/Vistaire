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
          usageTitle: "3D / AR should stay useful, not spectacular for nothing",
          usageBody:
            "In a high-end restaurant, an immersive view should extend the menu and reassure the guest. It has value only when it clarifies a dish, a texture or a presentation.",
          beforeBadge: "Before the immersive view",
          beforeTitle: "The dish page remains the entry point",
          beforeBody:
            "Vistaire starts with a clear page: name, price, description, allergens and visual. 3D / AR comes after, only if the dish deserves an extra layer of understanding.",
          casesBadge: "Use cases",
          casesTitle: "When 3D / AR brings real value",
          casesBody:
            "The best uses are rare, visible and connected to a true guest question: size, texture, plating or understanding of a signature dish.",
          premiumBadge: "High-end restaurant",
          premiumTitle: "An immersive menu that respects service",
          premiumBody:
            "Vistaire does not turn the table into a technical demonstration. The guest sees what helps the choice, then naturally returns to the menu and service.",
          finalBadge: "Next step",
          finalTitle: "Your signature dishes deserve measured presentation",
          finalBody:
            "Let's talk about the dishes that truly benefit from being seen in volume and how to integrate them without weighing down your menu.",
          digitalMenu: "Digital restaurant menu",
          talk: "Talk to Vistaire",
          internalLabel: "Vistaire internal links",
          selectivePrinciples: [
            {
              title: "Selective",
              text:
                "3D / AR is not applied to the whole menu. It serves signature dishes that benefit from being seen in volume."
            },
            {
              title: "Mobile-first",
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
          usageTitle: "La 3D / AR doit rester utile, pas spectaculaire pour rien",
          usageBody:
            "Dans un restaurant haut de gamme, une vue immersive doit prolonger la carte et rassurer le client. Elle n'a de valeur que si elle clarifie un plat, une texture ou une présentation.",
          beforeBadge: "Avant la vue immersive",
          beforeTitle: "La fiche plat reste le point d'entrée",
          beforeBody:
            "Vistaire commence par une fiche claire : nom, prix, description, allergènes et visuel. La 3D / AR arrive ensuite, seulement si le plat mérite une couche de compréhension supplémentaire.",
          casesBadge: "Cas d'usage",
          casesTitle: "Quand la 3D / AR apporte une vraie valeur",
          casesBody:
            "Les meilleurs usages sont rares, visibles et liés à une vraie question client : taille, texture, dressage, ou compréhension du plat signature.",
          premiumBadge: "Restaurant haut de gamme",
          premiumTitle: "Une carte immersive qui respecte le service",
          premiumBody:
            "Vistaire ne transforme pas la table en démonstration technique. Le client voit ce qui l'aide à choisir, puis revient naturellement à la carte et au service.",
          finalBadge: "Prochaine étape",
          finalTitle: "Vos plats signatures méritent une présentation mesurée",
          finalBody:
            "Parlons des plats qui gagnent vraiment à être vus en volume et de la façon de les intégrer sans alourdir votre carte.",
          digitalMenu: "Menu digital restaurant",
          talk: "Parler à Vistaire",
          internalLabel: "Liens internes Vistaire",
          selectivePrinciples: [
            {
              title: "Sélective",
              text:
                "La 3D / AR n'est pas appliquée à toute la carte. Elle sert les plats signatures qui gagnent à être vus en volume."
            },
            {
              title: "Mobile-first",
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
                alt="Vue 3D et réalité augmentée Vistaire présentées sur téléphone"
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
                alt="Cliente consultant une carte digitale Vistaire dans un restaurant sombre"
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
                alt="Fiche plat Vistaire sur téléphone à côté d'un dessert signature"
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
