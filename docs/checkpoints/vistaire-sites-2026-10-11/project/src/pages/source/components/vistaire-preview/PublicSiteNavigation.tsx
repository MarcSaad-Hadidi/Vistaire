import { PublicNavigation } from "./PublicNavigation";
import {
  getLocalizedPath,
  normalizePathname,
  type Locale,
} from "../../lib/i18n";
import { PRICING_PATH, PRICING_PATH_EN } from "../../lib/pricingPage";

type PreviewNavItem = {
  active: boolean;
  href: string;
  label: string;
};

type PreviewNavSection = "home" | "menu" | "pricing" | "about" | "contact";
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
      pricing: PRICING_PATH_EN,
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
    pricing: PRICING_PATH,
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
  // The shared top bar navigates between pages, including on the active page.
  void activeSection;
  void contactHref;
  return (["home", "menu", "pricing", "about", "contact"] as const).map(
    (section) => ({
      label: labels[section],
      href: routes[section],
      active: isCurrentRoute(routes[section]),
    }),
  );
}

export function PreviewNav({
  activeSection,
  contactHref,
  currentPath,
  locale = "fr",
  routeMode = "production",
  menuOpen,
  onMenuChange,
}: {
  menuOpen?: boolean;
  onMenuChange?: (open: boolean) => void;
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
      menuOpen={menuOpen}
      onMenuChange={onMenuChange}
      items={items}
      home={routes.home}
      appointment={routes.appointment}
      locale={locale}
      appointmentLabel={
        locale === "fr" && resolvedCurrentPath === routes.pricing
          ? "Prendre rendez vous"
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
          href: routes.pdfVsDigital,
          label:
            locale === "en" ? "PDF vs digital menu" : "PDF ou menu digital",
        },
        {
          href: routes.restaurateurDashboard,
          label: locale === "en" ? "Restaurant preview" : "Aperçu restaurateur",
        },
      ]}
    />
  );
}
