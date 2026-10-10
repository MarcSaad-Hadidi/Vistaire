import Image from "next/image";
import Link from "next/link";
import mobileQrTable from "@/Framer/PageApropos2.png";
import tableImage from "@/Framer/Photo table.png";
import type { Locale } from "@/lib/i18n";
import {
  getVistaireChromeRoutes,
  PreviewFooter,
  PreviewNav,
  type VistaireRouteMode,
} from "./VistairePreviewChrome";
import styles from "./VistaireAboutPreview.module.css";

function ArrowIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16">
      <path
        d="M4 12 12 4m0 0H4m8 0v8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

export function VistaireAboutPreview({
  locale = "fr",
  routeMode = "production",
}: {
  locale?: Locale;
  routeMode?: VistaireRouteMode;
}) {
  const routes = getVistaireChromeRoutes(routeMode, locale);
  const copy =
    locale === "en"
      ? {
          badge: "About Vistaire",
          title: "Digital should extend the restaurant",
          titleAccent: "experience.",
          proposition:
            "Vistaire turns the restaurant QR code into a premium digital menu.",
          intro:
            "Vistaire helps high-end restaurants present their menu in an elegant mobile experience: clear navigation, visual dish pages, allergens, prices and selective 3D/AR.",
          appointment: "Book a call",
          discover: "Discover Vistaire",
          photoAlt: "A Vistaire mobile menu beside a restaurant table QR code",
          mobileTitle: "A premium mobile menu",
          mobileLine: "Built for table service",
          visionBadge: "Our vision",
          visionTitle: "A Montreal studio dedicated to high-end restaurants",
          visionA:
            "Digital should extend the restaurant experience, not replace it. Vistaire keeps the dish at the center: a clear, visual, mobile-first menu designed to create desire without turning the dining room into a cold app.",
          visionB:
            "Vistaire supports restaurants in Montreal, Quebec and Canada that want to present their menu on mobile without losing the elegance of the room.",
          serviceTitle: "Built for table service.",
          values: [
            {
              title: "Mobile-first",
              body: "A clear, visual menu designed for your guests’ phones.",
            },
            {
              title: "Selective 3D",
              body: "Dishes presented in detail, wherever 3D/AR brings real value.",
            },
            {
              title: "No app",
              body: "Your menu opens directly from the table QR code.",
            },
          ],
          tableAlt:
            "An elegantly set restaurant table with glasses, a candle and a Vistaire QR code",
          closing: "Your cuisine. Your world.",
          closingAccent: "Another dimension.",
          explore: "Explore the menus",
        }
      : {
          badge: "À propos de Vistaire",
          title: "Le digital doit prolonger l’expérience du",
          titleAccent: "restaurant.",
          proposition:
            "Vistaire transforme le QR code restaurant en carte digitale premium.",
          intro:
            "Vistaire aide les restaurants haut de gamme à présenter leur carte dans une expérience mobile élégante : menu clair, fiches plats visuelles, allergènes, prix et 3D/AR sélective.",
          appointment: "Prendre rendez-vous",
          discover: "Découvrir Vistaire",
          photoAlt:
            "Une carte Vistaire sur téléphone à côté d’un QR code de table",
          mobileTitle: "Une carte mobile premium",
          mobileLine: "Pensée pour le service à table",
          visionBadge: "Notre vision",
          visionTitle:
            "Une maison montréalaise dédiée aux restaurants haut de gamme",
          visionA:
            "Le digital doit prolonger l'expérience du restaurant, pas la remplacer. Vistaire garde le plat au centre : une carte claire, visuelle et mobile-first, conçue pour donner envie sans transformer la salle en application froide.",
          visionB:
            "Vistaire accompagne les restaurants de Montréal, du Québec et du Canada qui veulent présenter leur carte sur mobile sans perdre l'élégance de la salle.",
          serviceTitle: "Pensée pour le service à table.",
          values: [
            {
              title: "Mobile-first",
              body: "Une carte claire et visuelle, pensée pour le téléphone de vos clients.",
            },
            {
              title: "3D sélective",
              body: "Des plats mis en valeur avec justesse, quand la 3D/AR apporte une vraie valeur.",
            },
            {
              title: "Sans application",
              body: "Votre carte s’ouvre directement depuis le QR code de la table.",
            },
          ],
          tableAlt:
            "Une table de restaurant élégante avec verres, chandelle et QR code Vistaire",
          closing: "Votre cuisine. Votre univers.",
          closingAccent: "Une autre dimension.",
          explore: "Explorer les cartes",
        };

  return (
    <main className={styles.page} data-public-vistaire>
      <PreviewNav
        activeSection="about"
        currentPath={routes.about}
        locale={locale}
        routeMode={routeMode}
      />
      <section
        aria-labelledby="about-preview-title"
        className={styles.hero}
        id="a-propos"
      >
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{copy.badge}</p>
          <h1 id="about-preview-title">
            {copy.title} <em>{copy.titleAccent}</em>
          </h1>
          <p className={styles.proposition}>{copy.proposition}</p>
          <p className={styles.intro}>{copy.intro}</p>
          <Link className={styles.textLink} href="#vision" prefetch={false}>
            {copy.discover}
            <ArrowIcon />
          </Link>
        </div>
        <figure className={styles.heroPhoto}>
          <Image
            alt={copy.photoAlt}
            className={styles.photo}
            fill
            priority
            quality={90}
            sizes="(max-width: 800px) calc(100vw - 40px), 620px"
            src={mobileQrTable}
          />
          <figcaption>
            <span>{copy.mobileTitle}</span>
            <span>{copy.mobileLine}</span>
          </figcaption>
        </figure>
      </section>

      <section
        aria-labelledby="about-vision-title"
        className={styles.vision}
        id="vision"
      >
        <div>
          <p className={styles.eyebrow}>{copy.visionBadge}</p>
          <h2 id="about-vision-title">{copy.visionTitle}</h2>
        </div>
        <div className={styles.visionCopy}>
          <p>{copy.visionA}</p>
          <p>{copy.visionB}</p>
        </div>
      </section>

      <section aria-labelledby="about-service-title" className={styles.service}>
        <h2 id="about-service-title">{copy.serviceTitle}</h2>
        <dl className={styles.values}>
          {copy.values.map((value, index) => (
            <div key={value.title}>
              <span aria-hidden="true" className={styles.valueIndex}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <dt>{value.title}</dt>
              <dd>{value.body}</dd>
            </div>
          ))}
        </dl>
        <Link
          className={styles.ctaButton}
          href={routes.appointment}
          prefetch={false}
        >
          {copy.appointment}
          <ArrowIcon />
        </Link>
      </section>

      <section aria-labelledby="about-closing-title" className={styles.closing}>
        <div className={styles.closingPhoto}>
          <Image
            alt={copy.tableAlt}
            className={styles.photo}
            fill
            quality={90}
            sizes="(max-width: 800px) 100vw, 660px"
            src={tableImage}
          />
        </div>
        <div className={styles.closingCopy}>
          <h2 id="about-closing-title">
            {copy.closing}
            <br />
            <em>{copy.closingAccent}</em>
          </h2>
          <Link className={styles.textLink} href={routes.menu} prefetch={false}>
            {copy.explore}
            <ArrowIcon />
          </Link>
        </div>
      </section>
      <PreviewFooter
        currentPath={routes.about}
        locale={locale}
        routeMode={routeMode}
      />
    </main>
  );
}
