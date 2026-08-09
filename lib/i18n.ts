import type { Metadata } from "next";
import { SEO_GEO_ROUTE_PAIRS } from "./seoGeoRoutes.ts";

export const SUPPORTED_LOCALES = ["fr", "en"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

export function normalizeLocale(value: unknown): Locale {
  if (typeof value !== "string") return DEFAULT_LOCALE;
  const normalized = value.trim().toLowerCase().replace("_", "-");
  return normalized === "en" || normalized === "en-ca" ? "en" : DEFAULT_LOCALE;
}

export const LOCALE_LANGUAGE_TAG: Record<Locale, "fr-CA" | "en-CA"> = {
  fr: "fr-CA",
  en: "en-CA"
};

export const LOCALE_OPEN_GRAPH: Record<Locale, "fr_CA" | "en_CA"> = {
  fr: "fr_CA",
  en: "en_CA"
};

export const VISTAIRE_LOCALE_HEADER = "x-vistaire-locale";

export const PUBLIC_ROUTE_UPDATED_AT = "2026-06-22T21:26:34.000Z";

export type BilingualRoutePair = {
  fr: string;
  en: string;
  changeFrequency: "weekly" | "monthly";
  priority: number;
  updatedAt: string;
};

export const BILINGUAL_ROUTE_PAIRS: BilingualRoutePair[] = [
  {
    fr: "/",
    en: "/en",
    changeFrequency: "monthly",
    priority: 1,
    updatedAt: PUBLIC_ROUTE_UPDATED_AT
  },
  {
    fr: "/demo",
    en: "/en/vistaire-menu",
    changeFrequency: "weekly",
    priority: 0.62,
    updatedAt: PUBLIC_ROUTE_UPDATED_AT
  },
  {
    fr: "/tarifs-menu-digital-restaurant",
    en: "/en/pricing-digital-restaurant-menu",
    changeFrequency: "monthly",
    priority: 0.9,
    updatedAt: PUBLIC_ROUTE_UPDATED_AT
  },
  {
    fr: "/menu-digital-restaurant",
    en: "/en/digital-restaurant-menu",
    changeFrequency: "monthly",
    priority: 0.88,
    updatedAt: PUBLIC_ROUTE_UPDATED_AT
  },
  {
    fr: "/menu-qr-code-restaurant",
    en: "/en/qr-code-restaurant-menu",
    changeFrequency: "monthly",
    priority: 0.82,
    updatedAt: PUBLIC_ROUTE_UPDATED_AT
  },
  {
    fr: "/menu-3d-ar-restaurant",
    en: "/en/3d-ar-restaurant-menu",
    changeFrequency: "monthly",
    priority: 0.78,
    updatedAt: PUBLIC_ROUTE_UPDATED_AT
  },
  {
    fr: "/menu-pdf-vs-menu-digital",
    en: "/en/pdf-vs-digital-menu",
    changeFrequency: "monthly",
    priority: 0.84,
    updatedAt: PUBLIC_ROUTE_UPDATED_AT
  },
  {
    fr: "/a-propos",
    en: "/en/about",
    changeFrequency: "monthly",
    priority: 0.72,
    updatedAt: PUBLIC_ROUTE_UPDATED_AT
  },
  {
    fr: "/contact",
    en: "/en/contact",
    changeFrequency: "monthly",
    priority: 0.7,
    updatedAt: PUBLIC_ROUTE_UPDATED_AT
  },
  {
    fr: "/prendre-rendez-vous",
    en: "/en/book-a-call",
    changeFrequency: "monthly",
    priority: 0.74,
    updatedAt: PUBLIC_ROUTE_UPDATED_AT
  },
  {
    fr: "/apercu-restaurateur",
    en: "/en/restaurant-preview",
    changeFrequency: "monthly",
    priority: 0.76,
    updatedAt: PUBLIC_ROUTE_UPDATED_AT
  },
  {
    fr: "/guides/anatomie-menu-digital-premium",
    en: "/en/guides/premium-digital-menu-anatomy",
    changeFrequency: "monthly",
    priority: 0.75,
    updatedAt: PUBLIC_ROUTE_UPDATED_AT
  },
  {
    fr: "/guides/menu-qr-mobile-sans-application",
    en: "/en/guides/mobile-qr-menu-without-app",
    changeFrequency: "monthly",
    priority: 0.74,
    updatedAt: PUBLIC_ROUTE_UPDATED_AT
  },
  {
    fr: "/guides/3d-restaurant-utile-vs-gadget",
    en: "/en/guides/restaurant-3d-useful-vs-gimmick",
    changeFrequency: "monthly",
    priority: 0.73,
    updatedAt: PUBLIC_ROUTE_UPDATED_AT
  },
  ...SEO_GEO_ROUTE_PAIRS.map((route) => ({
    fr: route.fr,
    en: route.en,
    changeFrequency: "monthly" as const,
    priority: route.priority,
    updatedAt: route.updatedAt
  }))
];

export function normalizePathname(pathname: string): string {
  const [pathOnly] = pathname.split(/[?#]/);
  const normalized = pathOnly.trim() || "/";
  if (normalized === "/") return "/";
  return normalized.replace(/\/+$/, "");
}

export function getLocaleFromPath(pathname: string): Locale {
  return normalizePathname(pathname).startsWith("/en") ? "en" : "fr";
}

export function getBilingualRoutePair(pathname: string) {
  const normalized = normalizePathname(pathname);
  return (
    BILINGUAL_ROUTE_PAIRS.find(
      (route) => route.fr === normalized || route.en === normalized
    ) ?? null
  );
}

export function getLocalizedPath(pathname: string, locale: Locale): string {
  const pair = getBilingualRoutePair(pathname);
  if (!pair) return locale === "en" ? "/en" : "/";
  return locale === "en" ? pair.en : pair.fr;
}

export function buildPageAlternates(pathname: string): Metadata["alternates"] {
  const normalized = normalizePathname(pathname);
  const pair = getBilingualRoutePair(normalized);
  if (!pair) {
    return {
      canonical: normalized
    };
  }

  const locale = getLocaleFromPath(normalized);
  const canonical = locale === "en" ? pair.en : pair.fr;
  const frenchPath = pair.fr;
  const englishPath = pair.en;

  return {
    canonical,
    languages: {
      [LOCALE_LANGUAGE_TAG.fr]: frenchPath,
      [LOCALE_LANGUAGE_TAG.en]: englishPath,
      "x-default": frenchPath
    }
  };
}

export function buildAbsoluteLanguageAlternates(
  pathname: string,
  absoluteUrl: (path: string) => string
) {
  const alternates = buildPageAlternates(pathname);
  const languages = alternates?.languages ?? {};

  return {
    [LOCALE_LANGUAGE_TAG.fr]: absoluteUrl(String(languages[LOCALE_LANGUAGE_TAG.fr] ?? "/")),
    [LOCALE_LANGUAGE_TAG.en]: absoluteUrl(String(languages[LOCALE_LANGUAGE_TAG.en] ?? "/en")),
    "x-default": absoluteUrl(String(languages["x-default"] ?? "/"))
  };
}

export function localeFromHeaderValue(value: string | null | undefined): Locale {
  return normalizeLocale(value);
}
