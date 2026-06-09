import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import contactBackground from "@/Framer/PhotoRestoComplet4.png";
import cocktailImage from "@/Framer/Boisson.png";
import diningRoomImage from "@/Framer/PhotoResto.png";
import pageContactImage from "@/Framer/PageContact.png";
import lobsterPlate from "@/Framer/PlatHomard.png";
import dessertImage from "@/Framer/Desert.png";
import tableImage from "@/Framer/Photo table.png";
import type { Locale } from "@/lib/i18n";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/seo";
import {
  getVistaireChromeRoutes,
  PreviewFooter,
  PreviewNav,
  type VistaireRouteMode
} from "./VistairePreviewChrome";
import styles from "./VistaireContactPreview.module.css";

type FramerImageProps = {
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  src: StaticImageData;
};

const imageTiles: FramerImageProps[] = [
  {
    alt: "Salle de restaurant haut de gamme preparee pour le service",
    src: diningRoomImage
  },
  {
    alt: "Plat de homard premium dans une assiette noire",
    src: lobsterPlate
  },
  {
    alt: "Dessert au chocolat servi dans une assiette noire",
    src: dessertImage
  },
  {
    alt: "Table de restaurant elegante avec verres et chandelle",
    src: tableImage
  }
];

function FramerImage({
  alt,
  className,
  priority,
  sizes = "(max-width: 920px) calc(100vw - 36px), 360px",
  src
}: FramerImageProps) {
  return (
    <Image
      alt={alt}
      className={className}
      fill
      priority={priority}
      quality={100}
      sizes={sizes}
      src={src}
      unoptimized
    />
  );
}

export function VistaireContactPreview({
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
          srTitle: "for your restaurant digital menu",
          restaurantBadge: "For restaurants",
          restaurantTitle: "For restaurants",
          bodyA:
            "Vistaire turns a restaurant QR code into a premium digital menu that opens on mobile, without an app.",
          bodyB:
            "We can discuss your menu, dish pages, brand identity, selective 3D/AR and adaptation to your guests.",
          bodyC: "Available for restaurants in the Montreal area.",
          ambienceLabel: "Vistaire atmosphere",
          appointment: "Book a call",
          contactTitle: "Vistaire contact",
          contactBody:
            "Tell us about your restaurant, your menu and the experience you want to offer.",
          company: "Company",
          region: "Region",
          regionValue: "Montreal, Quebec, Canada",
          phone: "Phone"
        }
      : {
          srTitle: "pour votre carte digitale restaurant",
          restaurantBadge: "POUR LES RESTAURANTS",
          restaurantTitle: "Pour les restaurants",
          bodyA:
            "Vistaire transforme le QR code d'un restaurant en carte digitale premium consultable sur mobile, sans application.",
          bodyB:
            "Nous pouvons discuter de votre menu, de vos fiches plats, de votre image de marque, de la 3D/AR sélective et de l'adaptation à votre clientèle.",
          bodyC: "Disponible pour les restaurants de la région de Montréal.",
          ambienceLabel: "Ambiance Vistaire",
          appointment: "Prendre rendez-vous",
          contactTitle: "Contact Vistaire",
          contactBody:
            "Parlez-nous de votre restaurant, de votre carte et de l'expérience que vous souhaitez offrir.",
          company: "Entreprise",
          region: "Région",
          regionValue: "Montréal, Québec, Canada",
          phone: "Téléphone"
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
        src={contactBackground}
        unoptimized
      />

      <section
        aria-labelledby="contact-preview-title"
        className={styles.hero}
        id="contact-preview"
      >
        <div className={styles.previewFrame}>
          <article className={`${styles.card} ${styles.heroImageCard}`}>
            <FramerImage
              alt="Cocktail rose premium servi dans une coupe sur une scene sombre"
              className={styles.cardImage}
              priority
              sizes="(max-width: 920px) calc(100vw - 36px), 380px"
              src={cocktailImage}
            />
            <div aria-hidden="true" className={styles.heroImageShade} />
            <div className={styles.heroImageCopy}>
              <h1 id="contact-preview-title">
                CONTACT
                <span>VISTAIRE</span>
                <span className={styles.srOnly}>
                  {copy.srTitle}
                </span>
              </h1>
            </div>
          </article>

          <div className={styles.middleColumn}>
            <article
              aria-labelledby="contact-restaurants-title"
              className={`${styles.card} ${styles.restaurantCard}`}
            >
              <div aria-hidden="true" className={styles.restaurantShade} />
              <div className={styles.restaurantContent}>
                <p className={styles.badge}>{copy.restaurantBadge}</p>
                <h2 id="contact-restaurants-title" className={styles.srOnly}>
                  {copy.restaurantTitle}
                </h2>
                <p>{copy.bodyA}</p>
                <p>{copy.bodyB}</p>
                <p>{copy.bodyC}</p>
              </div>
            </article>

            <div className={styles.tileGrid} aria-label={copy.ambienceLabel}>
              {imageTiles.map((tile) => (
                <article className={styles.tileCard} key={tile.alt}>
                  <FramerImage
                    alt={tile.alt}
                    className={styles.cardImage}
                    src={tile.src}
                  />
                </article>
              ))}
            </div>
          </div>

          <div className={styles.rightColumn}>
            <article className={`${styles.card} ${styles.barCard}`}>
              <FramerImage
                alt="Salle Vistaire premium avec banquettes, verres et lumière chaude"
                className={styles.cardImage}
                priority
                src={pageContactImage}
              />
              <div aria-hidden="true" className={styles.barShade} />
            </article>

            <article
              aria-labelledby="contact-card-title"
              className={`${styles.card} ${styles.contactCard}`}
            >
              <div aria-hidden="true" className={styles.contactShade} />
              <div className={styles.contactContent}>
                <Link
                  className={styles.contactButton}
                  href={routes.appointment}
                  prefetch={false}
                >
                  {copy.appointment}
                </Link>
                <h2 id="contact-card-title" className={styles.srOnly}>
                  {copy.contactTitle}
                </h2>
                <p>{copy.contactBody}</p>
                <dl className={styles.contactMeta}>
                  <div>
                    <dt>{copy.company}</dt>
                    <dd>Vistaire</dd>
                  </div>
                  <div>
                    <dt>{copy.region}</dt>
                    <dd>{copy.regionValue}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>
                      <a href="mailto:contact@vistaire.ca">
                        contact@vistaire.ca
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt>{copy.phone}</dt>
                    <dd>
                      <a href={`tel:${CONTACT_PHONE_TEL}`}>
                        {CONTACT_PHONE_DISPLAY}
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>
            </article>
          </div>
        </div>

        <PreviewNav
          activeSection="contact"
          currentPath={routes.contact}
          locale={locale}
          routeMode={routeMode}
        />
      </section>

      <PreviewFooter
        currentPath={routes.contact}
        locale={locale}
        routeMode={routeMode}
      />
    </main>
  );
}
