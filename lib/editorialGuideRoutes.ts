export type EditorialGuideKey =
  | "premium-menu-anatomy"
  | "mobile-qr-without-app"
  | "restaurant-3d-decision";

export type EditorialGuideLocale = "fr" | "en";

export type EditorialGuideRoutePair = {
  key: EditorialGuideKey;
  fr: string;
  en: string;
  labels: Record<EditorialGuideLocale, string>;
  changeFrequency: "monthly";
  priority: number;
};

export const EDITORIAL_GUIDE_ROUTE_PAIRS: EditorialGuideRoutePair[] = [
  {
    key: "premium-menu-anatomy",
    fr: "/guides/anatomie-menu-digital-premium",
    en: "/en/guides/premium-digital-menu-anatomy",
    labels: {
      fr: "L’anatomie d’un menu digital premium",
      en: "The anatomy of a premium digital menu"
    },
    changeFrequency: "monthly",
    priority: 0.75
  },
  {
    key: "mobile-qr-without-app",
    fr: "/guides/menu-qr-mobile-sans-application",
    en: "/en/guides/mobile-qr-menu-without-app",
    labels: {
      fr: "Menu QR mobile sans application",
      en: "Mobile QR menu without an app"
    },
    changeFrequency: "monthly",
    priority: 0.74
  },
  {
    key: "restaurant-3d-decision",
    fr: "/guides/3d-restaurant-utile-vs-gadget",
    en: "/en/guides/restaurant-3d-useful-vs-gimmick",
    labels: {
      fr: "3D au restaurant : utile ou gadget ?",
      en: "Restaurant 3D: useful or gimmick?"
    },
    changeFrequency: "monthly",
    priority: 0.73
  }
];

export function getEditorialGuideRoute(
  key: EditorialGuideKey,
  locale: EditorialGuideLocale
) {
  const pair = EDITORIAL_GUIDE_ROUTE_PAIRS.find((candidate) => candidate.key === key);

  if (!pair) {
    throw new Error(`Missing editorial guide route: ${key}`);
  }

  const alternateLocale = locale === "fr" ? "en" : "fr";
  return {
    path: pair[locale],
    alternatePath: pair[alternateLocale]
  };
}

export function getEditorialGuideNavigation(locale: EditorialGuideLocale) {
  return EDITORIAL_GUIDE_ROUTE_PAIRS.map((pair) => ({
    label: pair.labels[locale],
    href: pair[locale]
  }));
}
