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
  routeMode = "preview"
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
            "Vistaire helps high-end restaurants present their menu in an elegant mobile experience: clear navigation, visual dish pages, allergens, prices and selective 3D/AR.",
          appointment: "Book a call",
          mobileTitleA: "MOBILE",
          mobileTitleB: "MENU",
          mobileLine: "Built for table service",
          discover: "Discover Vistaire",
          visionBadge: "Our vision",
          visionTitle: "A Montreal studio dedicated to high-end restaurants",
          visionA:
            "Digital should extend the restaurant experience, not replace it. Vistaire keeps the dish at the center: a clear, visual, mobile-first menu designed to create desire without turning the dining room into a cold app.",
          visionB:
            "Vistaire supports restaurants in Montreal, Quebec and Canada that want to present their menu on mobile without losing the elegance of the room.",
          values: ["Mobile-first", "Selective 3D", "No app"]
        }
      : {
          sectionLabel: "À propos de Vistaire",
          badge: "À propos",
          h1: "Vistaire transforme le QR code restaurant en carte digitale premium.",
          intro:
            "Vistaire aide les restaurants haut de gamme à présenter leur carte dans une expérience mobile élégante : menu clair, fiches plats visuelles, allergènes, prix et 3D/AR sélective.",
          appointment: "Prendre rendez-vous",
          mobileTitleA: "CARTE MOBILE",
          mobileTitleB: "PREMIUM",
          mobileLine: "Pensée pour le service à table",
          discover: "Découvrir Vistaire",
          visionBadge: "Notre Vision",
          visionTitle:
            "Une maison montréalaise dédiée aux restaurants haut de gamme",
          visionA:
            "Le digital doit prolonger l'expérience du restaurant, pas la remplacer. Vistaire garde le plat au centre : une carte claire, visuelle et mobile-first, conçue pour donner envie sans transformer la salle en application froide.",
          visionB:
            "Vistaire accompagne les restaurants de Montréal, du Québec et du Canada qui veulent présenter leur carte sur mobile sans perdre l'élégance de la salle.",
          values: ["Mobile-First", "3D Sélective", "Sans Application"]
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
              alt="Plat de homard présenté dans une assiette noire"
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
              alt="Téléphone affichant une carte Vistaire à côté d'un QR code de table"
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
              alt="Client consultant une carte digitale Vistaire dans un restaurant premium"
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
