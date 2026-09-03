import Link from "next/link";
import { getEditorialGuideNavigation } from "@/lib/editorialGuideRoutes";
import { getLocalizedPath, normalizePathname, type Locale } from "@/lib/i18n";
import { getPricingPage } from "@/lib/pricingPage";
import {
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_TEL,
  getVistaireSocialProfiles
} from "@/lib/seo";
import { SEO_GEO_PAGES, SEO_GEO_PAGES_EN } from "@/lib/seoGeoPages";
import { PrivacyUtilityBar } from "@/components/privacy/PrivacyUtilityBar";
import styles from "./VistairePreviewChrome.module.css";

type PreviewNavItem = {
  active: boolean;
  href: string;
  label: string;
};

type PreviewNavSection = "home" | "menu" | "pricing" | "about" | "contact";
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
    pricing: "Tarifs",
    about: "À propos",
    contact: "Contact"
  },
  en: {
    home: "Home",
    menu: "Menu",
    pricing: "Pricing",
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

const localGeoSlugs = [
  "menu-digital-restaurant-montreal",
  "menu-digital-restaurant-laval",
  "menu-digital-restaurant-brossard"
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

const localGeoSlugsEn = [
  "digital-restaurant-menu-montreal",
  "digital-restaurant-menu-laval",
  "digital-restaurant-menu-brossard"
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
  locale: Locale = "fr",
  currentPath = routes.home
): PreviewNavItem[] {
  const labels = navLabels[locale];
  const normalizedCurrentPath = normalizePathname(currentPath);
  const isCurrentRoute = (route: string) =>
    normalizedCurrentPath === normalizePathname(route);
  const isLocalHref = (href: string) => href.startsWith("#") && href.length > 1;

  return [
    {
      label: labels.home,
      href: isCurrentRoute(routes.home) ? "#accueil" : routes.home,
      active: activeSection === "home"
    },
    {
      label: labels.menu,
      href: isCurrentRoute(routes.menu) ? "#carte" : routes.menu,
      active: activeSection === "menu"
    },
    {
      label: labels.pricing,
      href: isCurrentRoute(routes.pricing) ? "#pricing-title" : routes.pricing,
      active: activeSection === "pricing"
    },
    {
      label: labels.about,
      href: isCurrentRoute(routes.about) ? "#a-propos" : routes.about,
      active: activeSection === "about"
    },
    {
      label: labels.contact,
      href:
        isCurrentRoute(routes.contact) && isLocalHref(contactHref)
          ? contactHref
          : routes.contact,
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
  const resolvedCurrentPath = normalizePathname(currentPath ?? routes.home);

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
        {getPreviewNav(
          routes,
          activeSection,
          contactHref,
          locale,
          resolvedCurrentPath
        ).map((item) => {
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
          { label: "Digital restaurant menu", href: routes.menuDigital },
          { label: "QR code restaurant menu", href: routes.menuQrCode },
          { label: "Selective 3D / AR", href: routes.menu3dAr },
          { label: "Pricing", href: routes.pricing },
          { label: "Restaurant preview", href: routes.restaurateurDashboard },
          { label: "About", href: routes.about }
        ]
      : [
          { label: "Carte digitale", href: routes.menu },
          { label: "Menu digital restaurant", href: routes.menuDigital },
          { label: "Menu QR code restaurant", href: routes.menuQrCode },
          { label: "3D / AR sélective", href: routes.menu3dAr },
          { label: "Tarifs", href: routes.pricing },
          { label: "Aperçu restaurateur", href: routes.restaurateurDashboard },
          { label: "À propos", href: routes.about }
        ];
  const guideLinks = getEditorialGuideNavigation(locale);
  const solutionLinks = [
    {
      label: locale === "en" ? "PDF vs digital menu" : "PDF vs menu digital",
      href: routes.pdfVsDigital
    },
    ...getGeoFooterLinks(
      locale === "en" ? useCaseGeoSlugsEn : useCaseGeoSlugs,
      locale
    )
  ];
  const localLinks = getGeoFooterLinks(
    locale === "en" ? localGeoSlugsEn : localGeoSlugs,
    locale
  );
  const socialProfiles = getVistaireSocialProfiles();

  return (
    <footer
      className={`${styles.previewFooter} ${
        width === "wide" ? styles.previewFooterWide : ""
      }`}
      data-vistaire-preview-footer
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
        <PrivacyUtilityBar
          className={styles.footerUtilityLinks}
          locale={locale}
          variant="footer"
        />
        <LanguageSwitcher currentPath={resolvedCurrentPath} locale={locale} />
      </div>
    </footer>
  );
}
