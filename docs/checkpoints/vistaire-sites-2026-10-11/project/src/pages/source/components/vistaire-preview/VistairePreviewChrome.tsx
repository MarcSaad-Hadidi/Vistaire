import Link from "../../../NativeLink.tsx";
import { getEditorialGuideNavigation } from "../../lib/editorialGuideRoutes";
import {
  getLocalizedPath,
  normalizePathname,
  type Locale,
} from "../../lib/i18n";
import {
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_TEL,
  getVistaireSocialProfiles,
} from "../../lib/seo";
import { SEO_GEO_PAGES, SEO_GEO_PAGES_EN } from "../../lib/seoGeoPages";
import styles from "./VistairePreviewChrome.module.css";

import {
  getVistaireChromeRoutes,
  type VistaireRouteMode,
} from "./PublicSiteNavigation";
export { PreviewNav, getVistaireChromeRoutes } from "./PublicSiteNavigation";
export type { VistaireRouteMode } from "./PublicSiteNavigation";
type PreviewChromeWidth = "standard" | "wide";

const useCaseGeoSlugs = [
  "menu-qr-sans-pdf",
  "menu-digital-sans-application",
  "remplacer-menu-pdf-restaurant",
  "alternative-menu-pdf-restaurant",
  "fiche-plat-digitale-restaurant",
  "menu-restaurant-photos",
  "menu-restaurant-allergenes",
] as const;

const localGeoSlugs = [
  "menu-digital-restaurant-montreal",
  "menu-digital-restaurant-laval",
  "menu-digital-restaurant-brossard",
] as const;

const useCaseGeoSlugsEn = [
  "qr-menu-without-pdf",
  "digital-menu-without-app",
  "replace-restaurant-pdf-menu",
  "restaurant-pdf-menu-alternative",
  "digital-dish-page-restaurant",
  "restaurant-menu-photos",
  "restaurant-menu-allergens",
] as const;

const localGeoSlugsEn = [
  "digital-restaurant-menu-montreal",
  "digital-restaurant-menu-laval",
  "digital-restaurant-menu-brossard",
] as const;

function getGeoFooterLinks(slugs: readonly string[], locale: Locale = "fr") {
  const pages = locale === "en" ? SEO_GEO_PAGES_EN : SEO_GEO_PAGES;

  return slugs
    .map((slug) => pages.find((page) => page.slug === slug))
    .filter((page): page is (typeof pages)[number] => Boolean(page))
    .map((page) => ({
      label: page.eyebrow,
      href: page.path,
    }));
}

function LanguageSwitcher({
  currentPath,
  locale,
}: {
  currentPath: string;
  locale: Locale;
}) {
  const options = [
    {
      locale: "fr" as const,
      label: "FR",
      href: getLocalizedPath(currentPath, "fr"),
    },
    {
      locale: "en" as const,
      label: "EN",
      href: getLocalizedPath(currentPath, "en"),
    },
  ];

  return (
    <div
      aria-label={locale === "en" ? "Language" : "Langue"}
      className={styles.languageSwitcher}
    >
      {options.map((option) => (
        <Link
          aria-current={option.locale === locale ? "true" : undefined}
          aria-label={
            option.locale === "en"
              ? "View this page in English"
              : "Voir cette page en français"
          }
          className={
            option.locale === locale
              ? `${styles.languageLink} ${styles.languageLinkActive}`
              : styles.languageLink
          }
          href={option.href}
          key={option.locale}
          prefetch={false}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

export function PreviewFooter({
  currentPath,
  locale = "fr",
  routeMode = "production",
  width = "standard",
}: {
  currentPath?: string;
  locale?: Locale;
  routeMode?: VistaireRouteMode;
  width?: PreviewChromeWidth;
}) {
  const routes = getVistaireChromeRoutes(routeMode, locale);
  const resolvedCurrentPath = currentPath ?? routes.home;
  const isPricingPage =
    normalizePathname(resolvedCurrentPath) ===
    normalizePathname(routes.pricing);
  const contactPhoneDisplay = isPricingPage
    ? CONTACT_PHONE_DISPLAY.replace(/-/g, " ")
    : CONTACT_PHONE_DISPLAY;
  const productLinks =
    locale === "en"
      ? [
          { label: "Sample menu", href: routes.menu },
          { label: "Digital restaurant menu", href: routes.menuDigital },
          { label: "QR code restaurant menu", href: routes.menuQrCode },
          { label: "Selective 3D / AR", href: routes.menu3dAr },
          { label: "Pricing", href: routes.pricing },
          { label: "Restaurant preview", href: routes.restaurateurDashboard },
          { label: "About", href: routes.about },
          { label: "Contact", href: routes.contact },
        ]
      : [
          { label: "Carte digitale", href: routes.menu },
          { label: "Menu digital restaurant", href: routes.menuDigital },
          { label: "Menu QR code restaurant", href: routes.menuQrCode },
          { label: "3D / AR sélective", href: routes.menu3dAr },
          { label: "Tarifs", href: routes.pricing },
          { label: "Aperçu restaurateur", href: routes.restaurateurDashboard },
          { label: "À propos", href: routes.about },
          { label: "Contact", href: routes.contact },
        ];
  const guideLinks = getEditorialGuideNavigation(locale);
  const solutionLinks = [
    {
      label: locale === "en" ? "PDF vs digital menu" : "PDF vs menu digital",
      href: routes.pdfVsDigital,
    },
    ...getGeoFooterLinks(
      locale === "en" ? useCaseGeoSlugsEn : useCaseGeoSlugs,
      locale,
    ),
  ];
  const localLinks = getGeoFooterLinks(
    locale === "en" ? localGeoSlugsEn : localGeoSlugs,
    locale,
  );
  const socialProfiles = getVistaireSocialProfiles();

  return (
    <footer
      className={`${styles.previewFooter} ${
        width === "wide" ? styles.previewFooterWide : ""
      }`}
      id="contact"
    >
      <div className={styles.footerInvitation}>
        <h2>
          {locale === "en"
            ? "A menu worthy of your restaurant."
            : "Une carte à la hauteur de votre restaurant."}
        </h2>
        <Link
          href={routes.appointment}
          className={styles.footerInvitationCta}
          prefetch={false}
        >
          {locale === "en"
            ? "Let’s talk about your menu"
            : "Parlons de votre carte"}
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path
              d="M3 13 13 3M3 3h10v10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            />
          </svg>
        </Link>
      </div>
      <section className={styles.footerBrand} aria-label="Vistaire">
        <h2>Vistaire</h2>
        <p className={styles.footerTagline}>
          {locale === "en"
            ? "Premium digital menu for high end restaurants."
            : "Carte digitale premium pour restaurants haut de gamme."}
        </p>
        <p className={styles.footerDescription}>
          {locale === "en"
            ? "A premium mobile experience built to present dishes, replace PDF menus and protect the restaurant brand."
            : "Une expérience mobile pensée pour présenter les plats, remplacer les menus PDF et valoriser la carte d'un restaurant."}
        </p>
      </section>

      <section
        className={styles.footerColumn}
        aria-label={locale === "en" ? "Product" : "Produit"}
      >
        <h2>{locale === "en" ? "Product" : "Produit"}</h2>
        <nav
          className={styles.footerLinkList}
          aria-label={locale === "en" ? "Vistaire product" : "Produit Vistaire"}
        >
          {productLinks.map((item) => (
            <Link href={item.href} key={item.label} prefetch={false}>
              {item.label}
            </Link>
          ))}
        </nav>
      </section>

      <section
        className={`${styles.footerColumn} ${styles.footerColumnWide}`}
        aria-label="Guides"
      >
        <h2>Guides</h2>
        <nav
          className={`${styles.footerLinkList} ${styles.footerLinkListBalanced}`}
          aria-label={locale === "en" ? "Vistaire guides" : "Guides Vistaire"}
        >
          {guideLinks.map((item) => (
            <Link href={item.href} key={item.label} prefetch={false}>
              {item.label}
            </Link>
          ))}
        </nav>
      </section>

      {solutionLinks.length > 0 ? (
        <section
          className={styles.footerColumn}
          aria-label={
            locale === "en" ? "Restaurant solutions" : "Besoins restaurants"
          }
        >
          <h2>{locale === "en" ? "Solutions" : "Besoins"}</h2>
          <nav
            className={styles.footerLinkList}
            aria-label={
              locale === "en"
                ? "Guides by restaurant solution"
                : "Guides par besoin restaurant"
            }
          >
            {solutionLinks.map((item) => (
              <Link href={item.href} key={item.href} prefetch={false}>
                {item.label}
              </Link>
            ))}
          </nav>
        </section>
      ) : null}

      {localLinks.length > 0 ? (
        <section
          className={styles.footerColumn}
          aria-label={locale === "en" ? "Local guides" : "Guides locaux"}
        >
          <h2>{locale === "en" ? "Local" : "Local"}</h2>
          <nav
            className={styles.footerLinkList}
            aria-label={
              locale === "en"
                ? "Local restaurant guides"
                : "Guides restaurants locaux"
            }
          >
            {localLinks.map((item) => (
              <Link href={item.href} key={item.href} prefetch={false}>
                {item.label}
              </Link>
            ))}
          </nav>
        </section>
      ) : null}

      <section className={styles.footerColumn} aria-label="Contact">
        <h2>Contact</h2>
        <p className={styles.footerPlace}>
          {locale === "en"
            ? "Montreal, Quebec, Canada"
            : "Montréal, Québec, Canada"}
        </p>
        <a className={styles.footerEmail} href="mailto:contact@vistaire.ca">
          contact@vistaire.ca
        </a>
        <a className={styles.footerEmail} href={`tel:${CONTACT_PHONE_TEL}`}>
          {contactPhoneDisplay}
        </a>
        <Link
          aria-label={locale === "en" ? "Book a call" : "Prendre rendez-vous"}
          className={styles.footerCta}
          href={routes.appointment}
          prefetch={false}
        >
          {locale === "en" ? "Book a call" : "Prendre rendez vous"}
        </Link>
        {socialProfiles.length > 0 ? (
          <nav
            aria-label={
              locale === "en"
                ? "Vistaire public profiles"
                : "Profils publics Vistaire"
            }
            className={styles.footerSocialLinks}
          >
            {socialProfiles.map((profile) => (
              <a
                href={profile.url}
                key={profile.url}
                rel="me noopener noreferrer"
                target="_blank"
              >
                {profile.label}
              </a>
            ))}
          </nav>
        ) : null}
      </section>

      <div className={styles.footerBottom}>
        <p className={styles.footerCopyright}>
          {locale === "en"
            ? "© 2026 Vistaire. All rights reserved."
            : "© 2026 Vistaire. Tous droits réservés."}
        </p>
        <LanguageSwitcher currentPath={resolvedCurrentPath} locale={locale} />
      </div>
    </footer>
  );
}
