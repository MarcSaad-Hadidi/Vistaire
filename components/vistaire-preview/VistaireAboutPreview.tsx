import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import restaurantBackground from "@/Framer/PhotoRestoComplet3.png";
import lobsterPlate from "@/Framer/PlatHomard.png";
import mobileQrTable from "@/Framer/PageApropos2.png";
import restaurantGuest from "@/Framer/PageApropos.png";
import type { Locale } from "@/lib/i18n";
import {
  getVistaireChromeRoutes,
  PreviewFooter,
  PreviewNav,
  type VistaireRouteMode
} from "./VistairePreviewChrome";
import styles from "./VistaireAboutPreview.module.css";

type FramerImageProps = {
  alt: string;
  className?: string;
  priority?: boolean;
  src: StaticImageData;
};

function FramerImage({ alt, className, priority, src }: FramerImageProps) {
  return (
    <Image
      alt={alt}
      className={className}
      fill
      priority={priority}
      quality={100}
      sizes="(max-width: 720px) calc(100vw - 36px), 430px"
      src={src}
      unoptimized
    />
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

export function VistaireAboutPreview({
  locale = "fr",
  routeMode = "production"
}: {
  locale?: Locale;
  routeMode?: VistaireRouteMode;
}) {
  const routes = getVistaireChromeRoutes(routeMode, locale);
  const copy =
    locale === "en"
      ? {
          sectionLabel: "About Vistaire",
          badge: "About",
          h1: "Vistaire turns the restaurant QR code into a premium digital menu.",
          intro:
            "Vistaire creates personalized digital menus for restaurants, with physical QR displays, dish photography and guided setup. Guests explore your food on their phones through clear categories, photos and selected 3D experiences.",
          appointment: "Book a call",
          mobileTitleA: "MOBILE",
          mobileTitleB: "MENU",
          mobileLine: "Built for table service",
          discover: "Discover Vistaire",
          visionBadge: "Our vision",
          visionTitle: "A Montreal studio dedicated to high-end restaurants",
          visionA:
            "Every menu starts with your food and the character of your restaurant. Vistaire brings them into a clear mobile experience that helps guests discover dishes while preserving the personal attention of table service.",
          visionB:
            "Vistaire supports restaurants in Montreal, Quebec and Canada that want to present their menu on mobile without losing the elegance of the room.",
          values: ["Built for phones", "Selective 3D", "No app"]
        }
      : {
          sectionLabel: "À propos de Vistaire",
          badge: "À propos",
          h1: "Vistaire transforme le QR code restaurant en carte digitale premium.",
          intro:
            "Vistaire crée des cartes digitales personnalisées pour restaurants, avec supports QR physiques, photos des plats et mise en place accompagnée. Vos clients découvrent votre cuisine sur téléphone à travers des catégories claires, des photos et certaines expériences 3D.",
          appointment: "Prendre rendez-vous",
          mobileTitleA: "CARTE MOBILE",
          mobileTitleB: "PREMIUM",
          mobileLine: "Pensée pour le service à table",
          discover: "Découvrir Vistaire",
          visionBadge: "Notre Vision",
          visionTitle:
            "Une maison montréalaise dédiée aux restaurants haut de gamme",
          visionA:
            "Chaque carte part de votre cuisine et de l’identité de votre restaurant. Vistaire les traduit dans une expérience mobile claire, qui aide à découvrir les plats tout en préservant l’attention du service à table.",
          visionB:
            "Vistaire accompagne les restaurants de Montréal, du Québec et du Canada qui veulent présenter leur carte sur mobile sans perdre l'élégance de la salle.",
          values: ["Pensée pour le mobile", "3D Sélective", "Sans Application"]
        };

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

      <section
        aria-label={copy.sectionLabel}
        className={styles.hero}
        id="a-propos"
      >
        <div className={styles.previewFrame}>
          <article className={`${styles.card} ${styles.introCard}`}>
            <div aria-hidden="true" className={styles.textShade} />
            <div className={styles.introCopy}>
              <p className={styles.badge}>{copy.badge}</p>
              <h1>{copy.h1}</h1>
              <p>{copy.intro}</p>
            </div>
          </article>

          <article className={`${styles.card} ${styles.plateCard}`}>
            <FramerImage
              alt={locale === "en"
                ? "Lobster dish presented on a black plate"
                : "Plat de homard présenté dans une assiette noire"}
              className={styles.cardImage}
              priority
              src={lobsterPlate}
            />
            <div aria-hidden="true" className={styles.imageShade} />
            <Link
              className={`${styles.ctaButton} ${styles.plateButton}`}
              href={routes.appointment}
              prefetch={false}
            >
              {copy.appointment}
              <ArrowIcon />
            </Link>
          </article>

          <article
            aria-labelledby="about-mobile-card-title"
            className={`${styles.card} ${styles.mobileCard}`}
          >
            <FramerImage
              alt={locale === "en"
                ? "Phone displaying a Vistaire menu beside a tabletop QR display"
                : "Téléphone affichant une carte Vistaire à côté d'un support QR de table"}
              className={styles.cardImage}
              priority
              src={mobileQrTable}
            />
            <div aria-hidden="true" className={styles.mobileShade} />
            <div className={styles.mobileCopy}>
              <div aria-hidden="true" className={styles.ornaments}>
                <span>✽</span>
                <span>✽</span>
                <span>✽</span>
              </div>
              <h2 id="about-mobile-card-title">
                {copy.mobileTitleA}
                <span>{copy.mobileTitleB}</span>
              </h2>
              <p>{copy.mobileLine}</p>
            </div>
          </article>

          <article className={`${styles.card} ${styles.guestCard}`}>
            <FramerImage
              alt={locale === "en"
                ? "Guest browsing a Vistaire digital menu in a restaurant"
                : "Client consultant une carte digitale Vistaire dans un restaurant"}
              className={styles.cardImage}
              src={restaurantGuest}
            />
            <div aria-hidden="true" className={styles.guestShade} />
            <Link
              className={`${styles.ctaButton} ${styles.guestButton}`}
              href="#vision"
              prefetch={false}
            >
              {copy.discover}
              <ArrowIcon />
            </Link>
          </article>

          <article className={`${styles.card} ${styles.visionCard}`} id="vision">
            <div aria-hidden="true" className={styles.visionShade} />
            <div className={styles.visionCopy}>
              <p className={styles.badge}>{copy.visionBadge}</p>
              <h2>{copy.visionTitle}</h2>
              <p>{copy.visionA}</p>
              <p>{copy.visionB}</p>
              <p className={styles.values}>
                {copy.values[0]} <span>·</span> {copy.values[1]} <span>·</span>{" "}
                {copy.values[2]}
              </p>
            </div>
          </article>
        </div>

        <PreviewNav
          activeSection="about"
          currentPath={routes.about}
          locale={locale}
          routeMode={routeMode}
        />
      </section>

      <PreviewFooter
        currentPath={routes.about}
        locale={locale}
        routeMode={routeMode}
      />
    </main>
  );
}
