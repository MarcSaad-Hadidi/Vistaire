import Image from "next/image";
import type { StaticImageData } from "next/image";
import restaurantBackground from "@/Framer/PhotoRestoComplet.png";
import lobsterPlate from "@/Framer/PlatHomard.png";
import restaurantTable from "@/Framer/Photo table.png";
import restaurantGuest from "@/Framer/PhotoFemme.png";
import type { Locale } from "@/lib/i18n";
import {
  getVistaireChromeRoutes,
  PreviewFooter,
  PreviewNav,
  type VistaireRouteMode
} from "./VistairePreviewChrome";
import styles from "./VistairePreviewLanding.module.css";

const heroPosterSrc = "/frames/menualive/frame_0200.webp";
const landingVideoSrc = "/videos/Vistaire2.mp4";
const heroCaptionsSrc = "/captions/hero-empty.vtt";

type FramerImageProps = {
  alt: string;
  className?: string;
  priority?: boolean;
  sizes: string;
  src: StaticImageData;
};

function FramerImage({ alt, className, priority, sizes, src }: FramerImageProps) {
  return (
    <Image
      alt={alt}
      className={className}
      fill
      priority={priority}
      quality={100}
      sizes={sizes}
      src={src}
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

export function VistairePreviewLanding({
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
          sectionLabel: "Vistaire landing page",
          videoLabel: "Video demonstration of the Vistaire digital menu",
          trackLabel: "English",
          srTitle: ", premium digital menu for high-end restaurants",
          heroSubline: "PREMIUM DIGITAL MENU",
          menuTitle: "DIGITAL MENU",
          explore: "Explore",
          aboutTag: "About Vistaire",
          aboutTitle: "A digital menu that makes dishes desirable",
          aboutBody:
            "Vistaire turns a restaurant QR code into a premium digital menu: clear navigation, visual dish pages and selective 3D/AR when it adds real value.",
          aboutBodySecond:
            "Based in Montreal, Vistaire helps restaurants in Quebec replace a PDF with a clear, citable mobile experience that stays faithful to the dining room.",
          discoverTitle: "DISCOVER",
          discoverButton: "Discover"
        }
      : {
          sectionLabel: "Nouvelle landing Vistaire",
          videoLabel: "Démonstration vidéo de la carte digitale Vistaire",
          trackLabel: "Français",
          srTitle: ", carte digitale premium pour restaurants haut de gamme",
          heroSubline: "CARTE DIGITALE PREMIUM",
          menuTitle: "CARTE DIGITALE",
          explore: "Explorer",
          aboutTag: "À propos de Vistaire",
          aboutTitle: "Une carte digitale qui donne envie",
          aboutBody:
            "Vistaire transforme le QR code d'un restaurant en carte digitale premium : menu clair, fiches plats visuelles et 3D/AR quand elle apporte une vraie valeur",
          aboutBodySecond:
            "Basé à Montréal, Vistaire aide les restaurants du Québec à remplacer un PDF par une expérience mobile claire, citable et fidèle à la salle.",
          discoverTitle: "DÉCOUVRIR",
          discoverButton: "Découvrir"
        };

  return (
    <main className={styles.page}>
      {/* Preload hero poster for faster LCP */}
      <link
        as="image"
        href={heroPosterSrc}
        rel="preload"
        type="image/webp"
      />

      <Image
        alt=""
        aria-hidden="true"
        className={styles.backgroundImage}
        fill
        priority
        quality={100}
        sizes="100vw"
        src={restaurantBackground}
      />

      <section
        aria-label={copy.sectionLabel}
        className={styles.hero}
        id="accueil"
      >
        <div className={styles.previewFrame}>
          <article className={`${styles.card} ${styles.videoCard}`}>
            <video
              aria-label={copy.videoLabel}
              autoPlay
              className={styles.heroVideo}
              controls={false}
              loop
              muted
              playsInline
              poster={heroPosterSrc}
              preload="metadata"
            >
              <source src={landingVideoSrc} type="video/mp4" />
              <track
                default
                kind="captions"
                label={copy.trackLabel}
                src={heroCaptionsSrc}
                srcLang={locale}
              />
            </video>
            <div aria-hidden="true" className={styles.videoShade} />
            <div className={styles.videoCopy}>
              <h1>
                VISTAIRE
                <span className={styles.srOnly}>
                  {copy.srTitle}
                </span>
              </h1>
              <p>{copy.heroSubline}</p>
            </div>
          </article>

          <div className={styles.rightGrid}>
            <article className={`${styles.card} ${styles.menuCard}`} id="carte">
              <FramerImage
                alt="Plat de homard premium servi dans une assiette noire"
                className={styles.cardImage}
                priority
                sizes="(max-width: 920px) calc(100vw - 28px), 540px"
                src={lobsterPlate}
              />
              <div aria-hidden="true" className={styles.menuShade} />
              <div className={styles.menuCopy}>
                <h2>{copy.menuTitle}</h2>
                <a className={styles.darkButton} href={routes.menu}>
                  {copy.explore}
                  <ArrowIcon />
                </a>
              </div>
            </article>

            <div className={styles.bottomGrid}>
              <article className={`${styles.aboutCard}`} id="a-propos">
                <div aria-hidden="true" className={styles.aboutShade} />
                <div className={styles.aboutContent}>
                  <p className={styles.aboutTag}>{copy.aboutTag}</p>
                  <h2>{copy.aboutTitle}</h2>
                  <p>{copy.aboutBody}</p>
                  <p>{copy.aboutBodySecond}</p>
                </div>
              </article>

              <article className={`${styles.card} ${styles.discoveryCard}`}>
                <div
                  aria-hidden="true"
                  className={`${styles.discoveryImage} ${styles["vistaire-discovery-image--first"]}`}
                >
                  <FramerImage
                    alt=""
                    className={`${styles.cardImage} ${styles.discoveryTableImage}`}
                    sizes="(max-width: 920px) calc(100vw - 28px), 260px"
                    src={restaurantTable}
                  />
                </div>
                <div
                  aria-hidden="true"
                  className={`${styles.discoveryImage} ${styles["vistaire-discovery-image--second"]}`}
                >
                  <FramerImage
                    alt=""
                    className={`${styles.cardImage} ${styles.discoveryGuestImage}`}
                    sizes="(max-width: 920px) calc(100vw - 28px), 260px"
                    src={restaurantGuest}
                  />
                </div>
                <div aria-hidden="true" className={styles.discoveryShade} />
                <div className={styles.discoveryCopy}>
                  <h2>
                    {copy.discoverTitle}
                    <span>VISTAIRE</span>
                  </h2>
                  <a className={styles.lightButton} href={routes.about}>
                    {copy.discoverButton}
                    <ArrowIcon />
                  </a>
                  <div aria-hidden="true" className={styles.dots}>
                    <span className={styles.dotFirst} />
                    <span className={styles.dotSecond} />
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>

        <PreviewNav
          activeSection="home"
          currentPath={routes.home}
          locale={locale}
          routeMode={routeMode}
        />
      </section>

      <PreviewFooter
        currentPath={routes.home}
        locale={locale}
        routeMode={routeMode}
      />
    </main>
  );
}
