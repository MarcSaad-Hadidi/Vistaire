import Link from "next/link";
import { PublicNavigation } from "./PublicNavigation";
import { PublicFooterNavigation } from "./PublicFooterNavigation";
import {
  getLocalizedPath,
  normalizePathname,
  type Locale,
} from "@/lib/i18n";
import { getPricingPage } from "@/lib/pricingPage";
import {
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_TEL,
  getVistaireSocialProfiles,
} from "@/lib/seo";
import styles from "./VistairePreviewChrome.module.css";
import "./public-pages.css";

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
  locale: Locale = "fr",
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
      restaurateurDashboard: "/en/restaurant-preview",
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
    restaurateurDashboard: "/apercu-restaurateur",
  };
}

const navLabels: Record<Locale, Record<PreviewNavSection, string>> = {
  fr: {
    home: "Accueil",
    menu: "Carte",
    pricing: "Tarifs",
    about: "À propos",
    contact: "Contact",
  },
  en: {
    home: "Home",
    menu: "Menu",
    pricing: "Pricing",
    about: "About",
    contact: "Contact",
  },
};

function getPreviewNav(
  routes: VistaireChromeRoutes,
  activeSection?: PreviewNavSection,
  contactHref = "#contact-preview",
  locale: Locale = "fr",
  currentPath = routes.home,
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
      active: activeSection === "home" && isCurrentRoute(routes.home),
    },
    {
      label: labels.menu,
      href: isCurrentRoute(routes.menu) ? "#carte" : routes.menu,
      active: activeSection === "menu" && isCurrentRoute(routes.menu),
    },
    {
      label: labels.pricing,
      href: isCurrentRoute(routes.pricing) ? "#pricing-title" : routes.pricing,
      active: activeSection === "pricing" && isCurrentRoute(routes.pricing),
    },
    {
      label: labels.about,
      href: isCurrentRoute(routes.about) ? "#a-propos" : routes.about,
      active: activeSection === "about" && isCurrentRoute(routes.about),
    },
    {
      label: labels.contact,
      href:
        isCurrentRoute(routes.contact) && isLocalHref(contactHref)
          ? contactHref
          : routes.contact,
      active: activeSection === "contact" && isCurrentRoute(routes.contact),
    },
  ];
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

export function PreviewNav({
  activeSection,
  contactHref,
  currentPath,
  locale = "fr",
  routeMode = "production",
}: {
  activeSection?: PreviewNavSection;
  contactHref?: string;
  currentPath?: string;
  locale?: Locale;
  routeMode?: VistaireRouteMode;
}) {
  const routes = getVistaireChromeRoutes(routeMode, locale);
  const resolvedCurrentPath = normalizePathname(currentPath ?? routes.home);

  const items = getPreviewNav(
    routes,
    activeSection,
    contactHref,
    locale,
    resolvedCurrentPath,
  );
  return (
    <PublicNavigation
      items={items}
      home={routes.home}
      appointment={routes.appointment}
      locale={locale}
      appointmentLabel={
        locale === "fr" && resolvedCurrentPath === routes.pricing
          ? "Prendre rendez vous"
          : undefined
      }
      appointmentShortLabel={
        locale === "fr" && resolvedCurrentPath === routes.pricing
          ? "Rendez vous"
          : undefined
      }
      languages={[
        {
          href: getLocalizedPath(resolvedCurrentPath, "fr"),
          label: "FR",
          active: locale === "fr",
        },
        {
          href: getLocalizedPath(resolvedCurrentPath, "en"),
          label: "EN",
          active: locale === "en",
        },
      ]}
      extraItems={[
        {
          href: routes.menuDigital,
          label: locale === "en" ? "Digital menu" : "Menu digital",
        },
        {
          href: routes.menuQrCode,
          label: locale === "en" ? "Table QR codes" : "Supports QR",
        },
        { href: routes.menu3dAr, label: "3D / AR" },
        {
          href: routes.restaurateurDashboard,
          label: locale === "en" ? "Restaurant preview" : "Aperçu restaurateur",
        },
      ]}
    />
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

      <PublicFooterNavigation locale={locale} />

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
        <Link href={`${routes.pricing}#pricing-terms-title`} prefetch={false}>
          {locale === "en" ? "Offer terms" : "Conditions de l’offre"}
        </Link>
        <LanguageSwitcher currentPath={resolvedCurrentPath} locale={locale} />
      </div>
    </footer>
  );
}
