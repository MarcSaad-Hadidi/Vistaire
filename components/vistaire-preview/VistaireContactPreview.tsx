import Image from "next/image";
import { getSeoMarketingImage } from "@/lib/seoMarketingImages";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/seo";
import {
  getVistaireChromeRoutes,
  PreviewFooter,
  PreviewNav,
  type VistaireRouteMode,
} from "./VistairePreviewChrome";
import styles from "./VistaireContactPreview.module.css";

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

export function VistaireContactPreview({
  locale = "fr",
  routeMode = "production",
}: {
  locale?: Locale;
  routeMode?: VistaireRouteMode;
}) {
  const routes = getVistaireChromeRoutes(routeMode, locale);
  const pageContactImage = getSeoMarketingImage("CONTACT:hero", locale);

  const copy =
    locale === "en"
      ? {
          badge: "Vistaire contact",
          title: "Let’s talk about your",
          titleAccent: "restaurant.",
          contactBody:
            "Tell us about your restaurant, your menu and the experience you want to offer.",
          restaurantBadge: "For restaurants",
          bodyA:
            "Vistaire turns a restaurant QR code into a premium digital menu that opens on mobile, without an app.",
          bodyB:
            "We can discuss your menu, dish pages, brand identity, selective 3D/AR and adaptation to your guests.",
          bodyC: "Available for restaurants in the Montreal area.",
          appointment: "Book a call",
          contactTitle: "Contact Vistaire",
          company: "Company",
          region: "Region",
          regionValue: "Montreal, Quebec, Canada",
          phone: "Phone",
          photoAlt:
            "Contemporary dining scene inspired by Trouvable",
          closing: "A menu designed for",
          closingAccent: "your tables.",
          explore: "Discover the Vistaire menus",
        }
      : {
          badge: "Contact Vistaire",
          title: "Parlons de votre",
          titleAccent: "restaurant.",
          contactBody:
            "Parlez-nous de votre restaurant, de votre carte et de l'expérience que vous souhaitez offrir.",
          restaurantBadge: "Pour les restaurants",
          bodyA:
            "Vistaire transforme le QR code d'un restaurant en carte digitale premium consultable sur mobile, sans application.",
          bodyB:
            "Nous pouvons discuter de votre menu, de vos fiches plats, de votre image de marque, de la 3D/AR sélective et de l'adaptation à votre clientèle.",
          bodyC: "Disponible pour les restaurants de la région de Montréal.",
          appointment: "Prendre rendez-vous",
          contactTitle: "Contacter Vistaire",
          company: "Entreprise",
          region: "Région",
          regionValue: "Montréal, Québec, Canada",
          phone: "Téléphone",
          photoAlt:
            "Mise en scène contemporaine de l’univers Trouvable",
          closing: "Une carte pensée pour",
          closingAccent: "vos tables.",
          explore: "Découvrir les cartes Vistaire",
        };

  return (
    <main className={styles.page} data-public-vistaire>
      <PreviewNav
        activeSection="contact"
        currentPath={routes.contact}
        locale={locale}
        routeMode={routeMode}
      />
      <section
        aria-labelledby="contact-preview-title"
        className={styles.hero}
        id="contact-preview"
      >
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{copy.badge}</p>
          <h1 id="contact-preview-title">
            {copy.title} <em>{copy.titleAccent}</em>
          </h1>
          <p className={styles.intro}>{copy.contactBody}</p>
          <Link
            className={styles.ctaButton}
            href={routes.appointment}
            prefetch={false}
          >
            {copy.appointment}
            <ArrowIcon />
          </Link>
          <dl aria-label={copy.contactTitle} className={styles.contactMeta}>
            <div>
              <dt>{locale === "en" ? "Email" : "Courriel"}</dt>
              <dd>
                <a href="mailto:contact@vistaire.ca">
                  contact@vistaire.ca
                  <ArrowIcon />
                </a>
              </dd>
            </div>
            <div>
              <dt>{copy.phone}</dt>
              <dd>
                <a href={`tel:${CONTACT_PHONE_TEL}`}>
                  {CONTACT_PHONE_DISPLAY}
                  <ArrowIcon />
                </a>
              </dd>
            </div>
            <div>
              <dt>{copy.region}</dt>
              <dd>{copy.regionValue}</dd>
            </div>
            <div>
              <dt>{copy.company}</dt>
              <dd>Vistaire</dd>
            </div>
          </dl>
        </div>
        <div className={styles.heroPhoto}>
          <Image
            alt={pageContactImage.alt}
            className={styles.photo}
            fill
            priority
            quality={90}
            sizes="(max-width: 800px) calc(100vw - 40px), 620px"
            src={pageContactImage.src}
          />
        </div>
      </section>

      <section
        aria-labelledby="contact-restaurants-title"
        className={styles.restaurant}
      >
        <div>
          <p className={styles.eyebrow}>{copy.restaurantBadge}</p>
          <h2 id="contact-restaurants-title">
            {copy.closing} <em>{copy.closingAccent}</em>
          </h2>
          <Link className={styles.textLink} href={routes.menu} prefetch={false}>
            {copy.explore}
            <ArrowIcon />
          </Link>
        </div>
        <div className={styles.restaurantCopy}>
          <p>{copy.bodyA}</p>
          <p>{copy.bodyB}</p>
          <p className={styles.regionLine}>{copy.bodyC}</p>
        </div>
      </section>
      <PreviewFooter
        currentPath={routes.contact}
        locale={locale}
        routeMode={routeMode}
      />
    </main>
  );
}
