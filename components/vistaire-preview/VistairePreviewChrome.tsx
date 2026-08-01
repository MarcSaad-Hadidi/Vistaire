import Link from "next/link";
import { getLocalizedPath, type Locale } from "@/lib/i18n";
import { getPricingPage } from "@/lib/pricingPage";
import {
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_TEL,
  getVistaireSocialProfiles
} from "@/lib/seo";
import { SEO_GEO_PAGES, SEO_GEO_PAGES_EN } from "@/lib/seoGeoPages";
import styles from "./VistairePreviewChrome.module.css";

type PreviewNavItem = {
  active: boolean;
  href: string;
  label: string;
};

type PreviewNavSection = "home" | "menu" | "about" | "contact";
type PreviewChromeWidth = "standard" | "wide";
export type VistaireRouteMode = "production";

type VistaireChromeRoutes = {
  about: string;
  appointment: string;
  contact: string;
  dish: string;
  home: string;
  menu: string;
  menu3dAr: string;
  menuDigital: string;
  menuQrCode: string;
  pdfVsDigital: string;
  pricing: string;
  restaurateurDashboard: string;
};

export function getVistaireChromeRoutes(
  mode: VistaireRouteMode = "production",
  locale: Locale = "fr"
): VistaireChromeRoutes {
  const pricingPage = getPricingPage(locale);
  void mode;

  if (locale === "en") {
    return {
      about: "/en/about",
      appointment: "/en/book-a-call",
      contact: "/en/contact",
      dish: "/en/vistaire-menu",
      home: "/en",
      menu: "/en/vistaire-menu",
      menu3dAr: "/en/3d-ar-restaurant-menu",
      menuDigital: "/en/digital-restaurant-menu",
      menuQrCode: "/en/qr-code-restaurant-menu",
      pdfVsDigital: "/en/pdf-vs-digital-menu",
      pricing: pricingPage.path,
      restaurateurDashboard: "/en/restaurant-preview"
    };
  }

  return {
    about: "/a-propos",
    appointment: "/prendre-rendez-vous",
    contact: "/contact",
    dish: "/demo",
    home: "/",
    menu: "/demo",
    menu3dAr: "/menu-3d-ar-restaurant",
    menuDigital: "/menu-digital-restaurant",
    menuQrCode: "/menu-qr-code-restaurant",
    pdfVsDigital: "/menu-pdf-vs-menu-digital",
    pricing: pricingPage.path,
    restaurateurDashboard: "/apercu-restaurateur"
  };
}

const navLabels: Record<Locale, Record<PreviewNavSection, string>> = {
  fr: {
    home: "Accueil",
    menu: "Carte",
    about: "À propos",
    contact: "Contact"
  },
  en: {
    home: "Home",
    menu: "Menu",
    about: "About",
    contact: "Contact"
  }
};

const useCaseGeoSlugs = [
  "menu-qr-sans-pdf",
  "menu-digital-sans-application",
  "remplacer-menu-pdf-restaurant",
  "alternative-menu-pdf-restaurant",
  "fiche-plat-digitale-restaurant",
  "menu-restaurant-photos",
  "menu-restaurant-allergenes"
] as const;

const marketGeoSlugs = [
  "menu-digital-restaurant-montreal",
  "menu-digital-restaurant-laval",
  "menu-digital-restaurant-brossard",
  "menu-digital-restaurant-haut-de-gamme",
  "menu-digital-restaurant-gastronomique"
] as const;

const useCaseGeoSlugsEn = [
  "qr-menu-without-pdf",
  "digital-menu-without-app",
  "replace-restaurant-pdf-menu",
  "restaurant-pdf-menu-alternative",
  "digital-dish-page-restaurant",
  "restaurant-menu-photos",
  "restaurant-menu-allergens"
] as const;

const marketGeoSlugsEn = [
  "digital-restaurant-menu-montreal",
  "digital-restaurant-menu-laval",
  "digital-restaurant-menu-brossard",
  "high-end-restaurant-digital-menu",
  "fine-dining-restaurant-digital-menu"
] as const;

function getGeoFooterLinks(
  slugs: readonly string[],
  locale: Locale = "fr"
) {
  const pages = locale === "en" ? SEO_GEO_PAGES_EN : SEO_GEO_PAGES;

  return slugs
    .map((slug) => pages.find((page) => page.slug === slug))
    .filter((page): page is (typeof pages)[number] => Boolean(page))
    .map((page) => ({
      label: page.eyebrow,
      href: page.path
    }));
}

function getPreviewNav(
  routes: VistaireChromeRoutes,
  activeSection?: PreviewNavSection,
  contactHref = "#contact-preview",
  locale: Locale = "fr"
): PreviewNavItem[] {
  const labels = navLabels[locale];

  return [
    {
      label: labels.home,
      href: activeSection === "home" ? "#accueil" : routes.home,
      active: activeSection === "home"
    },
    {
      label: labels.menu,
      href: activeSection === "menu" ? "#carte" : routes.menu,
      active: activeSection === "menu"
    },
    {
      label: labels.about,
      href: activeSection === "about" ? "#a-propos" : routes.about,
      active: activeSection === "about"
    },
    {
      label: labels.contact,
      href: activeSection === "contact" ? contactHref : routes.contact,
      active: activeSection === "contact"
    }
  ];
}

function LanguageSwitcher({
  currentPath,
  locale
}: {
  currentPath: string;
  locale: Locale;
}) {
  const options = [
    { locale: "fr" as const, label: "FR", href: getLocalizedPath(currentPath, "fr") },
    { locale: "en" as const, label: "EN", href: getLocalizedPath(currentPath, "en") }
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

export function PreviewNav({
  activeSection,
  contactHref,
  currentPath,
  locale = "fr",
  routeMode = "production"
}: {
  activeSection?: PreviewNavSection;
  contactHref?: string;
  currentPath?: string;
  locale?: Locale;
  routeMode?: VistaireRouteMode;
}) {
  const routes = getVistaireChromeRoutes(routeMode, locale);
  const resolvedCurrentPath = currentPath ?? routes.home;

  return (
    <nav
      aria-label={locale === "en" ? "Main navigation" : "Navigation preview"}
      className={styles.previewNav}
    >
      <Link
        aria-label={locale === "en" ? "Vistaire - home" : "Vistaire - accueil"}
        className={styles.navBrand}
        href={routes.home}
        prefetch={false}
      >
        <span className={styles.navBrandName}>Vistaire</span>
        <span className={styles.navBrandSubline}>
          {locale === "en" ? "Premium digital menu" : "Carte digitale premium"}
        </span>
      </Link>

      <div className={styles.navLinks}>
        {getPreviewNav(routes, activeSection, contactHref, locale).map((item) => {
          const isCurrentPage = item.active && item.href.startsWith("#");

          return (
            <Link
              aria-current={isCurrentPage ? "page" : undefined}
              className={
                item.active
                  ? `${styles.navLink} ${styles.navActive}`
                  : styles.navLink
              }
              href={item.href}
              key={item.label}
              prefetch={false}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <LanguageSwitcher currentPath={resolvedCurrentPath} locale={locale} />

      <Link className={styles.navCta} href={routes.appointment} prefetch={false}>
        <span className={styles.navCtaFull}>
          {locale === "en" ? "Book a call" : "Prendre rendez-vous"}
        </span>
        <span className={styles.navCtaShort}>
          {locale === "en" ? "Book" : "Rendez-vous"}
        </span>
        <span aria-hidden="true" className={styles.navCtaArrow}>
          ↗
        </span>
      </Link>
    </nav>
  );
}

export function PreviewFooter({
  currentPath,
  locale = "fr",
  routeMode = "production",
  width = "standard"
}: {
  currentPath?: string;
  locale?: Locale;
  routeMode?: VistaireRouteMode;
  width?: PreviewChromeWidth;
}) {
  const routes = getVistaireChromeRoutes(routeMode, locale);
  const resolvedCurrentPath = currentPath ?? routes.home;
  const productLinks =
    locale === "en"
      ? [
            { label: "Sample menu", href: routes.menu },
            { label: "Dish pages", href: routes.dish },
            { label: "Selective 3D / AR", href: routes.menu3dAr },
            { label: "Restaurant preview", href: routes.restaurateurDashboard }
          ]
        : [
            { label: "Carte digitale", href: routes.menu },
            { label: "Fiches plats", href: routes.dish },
            { label: "3D / AR sélective", href: routes.menu3dAr },
            { label: "Aperçu restaurateur", href: routes.restaurateurDashboard }
          ];
  const resourceLinks =
    locale === "en"
      ? [
            { label: "Pricing", href: routes.pricing },
            { label: "Digital restaurant menu", href: routes.menuDigital },
            { label: "QR code restaurant menu", href: routes.menuQrCode },
            { label: "3D / AR restaurant menu", href: routes.menu3dAr },
            { label: "PDF vs digital menu", href: routes.pdfVsDigital },
            { label: "High-end restaurants", href: routes.about }
          ]
        : [
            { label: "Tarifs", href: routes.pricing },
            { label: "Menu digital restaurant", href: routes.menuDigital },
            { label: "Menu QR code restaurant", href: routes.menuQrCode },
            { label: "Menu 3D / AR restaurant", href: routes.menu3dAr },
            { label: "PDF vs menu digital", href: routes.pdfVsDigital },
            { label: "À propos", href: routes.about }
          ];
  const useCaseLinks = getGeoFooterLinks(
    locale === "en" ? useCaseGeoSlugsEn : useCaseGeoSlugs,
    locale
  );
  const marketLinks = getGeoFooterLinks(
    locale === "en" ? marketGeoSlugsEn : marketGeoSlugs,
    locale
  );
  const socialProfiles = getVistaireSocialProfiles();

  return (
    <footer
      className={`${styles.previewFooter} ${
        width === "wide" ? styles.previewFooterWide : ""
      }`}
      id="contact"
    >
      <section className={styles.footerBrand} aria-label="Vistaire">
        <h2>Vistaire</h2>
        <p className={styles.footerTagline}>
          {locale === "en"
            ? "Premium digital menu for high-end restaurants."
            : "Carte digitale premium pour restaurants haut de gamme."}
        </p>
        <p className={styles.footerDescription}>
          {locale === "en"
            ? "A mobile-first experience built to present dishes, replace PDF menus and protect the restaurant brand."
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
        aria-label={locale === "en" ? "Resources" : "Ressources"}
      >
        <h2>{locale === "en" ? "Guides" : "Guides"}</h2>
        <nav
          className={`${styles.footerLinkList} ${styles.footerLinkListBalanced}`}
          aria-label={locale === "en" ? "Vistaire guides" : "Guides Vistaire"}
        >
          {resourceLinks.map((item) => (
            <Link href={item.href} key={item.label} prefetch={false}>
              {item.label}
            </Link>
          ))}
        </nav>
      </section>

      {useCaseLinks.length > 0 ? (
        <section
          className={styles.footerColumn}
          aria-label={locale === "en" ? "Restaurant needs" : "Besoins restaurants"}
        >
          <h2>{locale === "en" ? "Needs" : "Besoins"}</h2>
          <nav
            className={styles.footerLinkList}
            aria-label={
              locale === "en"
                ? "Guides by restaurant need"
                : "Guides par besoin restaurant"
            }
          >
            {useCaseLinks.map((item) => (
              <Link href={item.href} key={item.href} prefetch={false}>
                {item.label}
              </Link>
            ))}
          </nav>
        </section>
      ) : null}

      {marketLinks.length > 0 ? (
        <section
          className={styles.footerColumn}
          aria-label={
            locale === "en"
              ? "Local and restaurant types"
              : "Local et types de restaurants"
          }
        >
          <h2>{locale === "en" ? "Local" : "Local"}</h2>
          <nav
            className={styles.footerLinkList}
            aria-label={
              locale === "en"
                ? "Local and restaurant guides"
                : "Guides locaux et restaurants"
            }
          >
            {marketLinks.map((item) => (
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
          {locale === "en" ? "Montreal, Quebec, Canada" : "Montréal, Québec, Canada"}
        </p>
        <a className={styles.footerEmail} href="mailto:contact@vistaire.ca">
          contact@vistaire.ca
        </a>
        <a className={styles.footerEmail} href={`tel:${CONTACT_PHONE_TEL}`}>
          {CONTACT_PHONE_DISPLAY}
        </a>
        <Link
          className={styles.footerCta}
          href={routes.appointment}
          prefetch={false}
        >
          {locale === "en" ? "Book a call" : "Prendre rendez-vous"}
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
