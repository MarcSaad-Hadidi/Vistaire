import {
  BILINGUAL_ROUTE_PAIRS,
  buildAbsoluteLanguageAlternates,
  LOCALE_LANGUAGE_TAG,
  type Locale
} from "./i18n.ts";

export const SITE_NAME = "Vistaire";
export const SITE_URL_FALLBACK = "https://www.vistaire.ca";
export const CONTACT_EMAIL = "contact@vistaire.ca";
export const CONTACT_PHONE_DISPLAY = "514-715-2421";
export const CONTACT_PHONE_TEL = "+15147152421";
export const CONTACT_LOCATION_LABEL = "Montréal, Québec, Canada";
export const CONTACT_REGION_LABEL = "Montréal, Québec";
export const DEFAULT_SITE_DESCRIPTION =
  "Vistaire transforme le QR code restaurant en carte digitale immersive pour restaurants haut de gamme : fiches plats, visuels, allergènes, 3D/AR sélective et aperçu restaurateur.";

const SITE_URL_ENV_KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
  "SITE_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL"
] as const;

export const INTERNAL_ROBOTS_DISALLOW = [
  "/api",
  "/api/",
  "/api/*",
  "/owner",
  "/owner/",
  "/owner/*",
  "/admin",
  "/admin/",
  "/admin/*",
  "/sign-in",
  "/sign-in/",
  "/sign-in/*",
  "/todos",
  "/todos/",
  "/todos/*",
  "/dev",
  "/dev/",
  "/dev/*",
  "/vistaire-preview",
  "/vistaire-preview/",
  "/vistaire-preview/*",
  "/legacy",
  "/legacy/",
  "/legacy/*"
] as const;

type SiteUrlEnv = {
  [key: string]: string | undefined;
};

type SitemapDish = {
  slug: string;
  isAvailable?: boolean;
};

export const PUBLIC_SEO_SITEMAP_ENTRIES = [
  {
    path: "/menu-digital-restaurant",
    changeFrequency: "monthly",
    priority: 0.88
  },
  {
    path: "/menu-qr-code-restaurant",
    changeFrequency: "monthly",
    priority: 0.82
  },
  {
    path: "/menu-3d-ar-restaurant",
    changeFrequency: "monthly",
    priority: 0.78
  },
  {
    path: "/menu-pdf-vs-menu-digital",
    changeFrequency: "monthly",
    priority: 0.84
  }
] as const;

export const PUBLIC_PRODUCT_SITEMAP_ENTRIES = [
  {
    path: "/a-propos",
    changeFrequency: "monthly",
    priority: 0.72
  },
  {
    path: "/contact",
    changeFrequency: "monthly",
    priority: 0.7
  },
  {
    path: "/prendre-rendez-vous",
    changeFrequency: "monthly",
    priority: 0.74
  },
  {
    path: "/apercu-restaurateur",
    changeFrequency: "monthly",
    priority: 0.76
  }
] as const;

const STANDALONE_SITEMAP_ENTRIES = [
  {
    path: "/carte-vistaire",
    changeFrequency: "monthly",
    priority: 0.8
  }
] as const;

export type SitemapEntry = {
  url: string;
  lastModified: Date;
  changeFrequency: "weekly" | "monthly";
  priority: number;
  alternates?: {
    languages: Record<string, string>;
  };
};

export type RobotsRule = {
  userAgent: string;
  allow: string;
  disallow: string[];
  contentSignal?: string;
};

export type SocialProfile = {
  label: string;
  url: string;
};

const PUBLIC_AI_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "CCBot",
  "Google-Extended",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Amazonbot",
  "Applebot",
  "Applebot-Extended",
  "Bytespider",
  "CloudflareBrowserRenderingCrawler",
  "Googlebot",
  "meta-externalagent",
  "anthropic-ai",
  "Claude-User",
  "cohere-ai",
  "Perplexity-User",
  "YouBot"
] as const;

const ROBOTS_CONTENT_SIGNAL = "search=yes,ai-input=yes,ai-train=yes";

const AREA_SERVED_JSON_LD: JsonLdObject[] = [
  {
    "@type": "City",
    name: "Montréal"
  },
  {
    "@type": "AdministrativeArea",
    name: "Québec"
  },
  {
    "@type": "Country",
    name: "Canada"
  }
];

const SERVICE_OFFER_CATALOG: JsonLdObject = {
  "@type": "OfferCatalog",
  name: "Experience Vistaire",
  itemListElement: [
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Carte digitale QR premium",
        serviceType: "Menu digital QR premium pour restaurants"
      }
    },
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Fiches plats visuelles",
        serviceType: "Présentation mobile des plats, prix et allergènes"
      }
    },
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Menu PDF vers menu digital mobile",
        serviceType: "Transformation de menu PDF en carte digitale"
      }
    },
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "3D/AR sélective pour plats signatures",
        serviceType: "Présentation immersive sélective"
      }
    },
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Dashboard restaurateur",
        serviceType: "Aperçu restaurateur des signaux de consultation"
      }
    }
  ]
};

type JsonLdPrimitive = string | number | boolean | null;
export type JsonLdValue =
  | JsonLdPrimitive
  | JsonLdValue[]
  | { [key: string]: JsonLdValue };

export type JsonLdObject = {
  [key: string]: JsonLdValue;
};

type SocialProfileEnv = SiteUrlEnv & {
  NEXT_PUBLIC_VISTAIRE_LINKEDIN_URL?: string;
  NEXT_PUBLIC_VISTAIRE_INSTAGRAM_URL?: string;
  NEXT_PUBLIC_VISTAIRE_GOOGLE_BUSINESS_URL?: string;
  NEXT_PUBLIC_VISTAIRE_FACEBOOK_URL?: string;
  NEXT_PUBLIC_VISTAIRE_X_URL?: string;
};

export function resolveSiteUrl(value?: string | null): URL {
  const trimmed = value?.trim();
  if (!trimmed) return new URL(SITE_URL_FALLBACK);

  const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return new URL(SITE_URL_FALLBACK);
    }
    return new URL(url.origin);
  } catch {
    return new URL(SITE_URL_FALLBACK);
  }
}

export function getSiteUrl(env: SiteUrlEnv = process.env): URL {
  for (const key of SITE_URL_ENV_KEYS) {
    const candidate = env[key];
    if (candidate) return resolveSiteUrl(candidate);
  }

  return resolveSiteUrl();
}

export function absoluteUrl(path = "/", env?: SiteUrlEnv): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, getSiteUrl(env)).toString();
}

export function buildSitemapEntries(
  dishes: SitemapDish[] = [],
  lastModified = new Date(),
  env?: SiteUrlEnv
): SitemapEntry[] {
  void dishes;
  const entries = new Map<string, SitemapEntry>();
  const toAbsolute = (path: string) => absoluteUrl(path, env);
  const setEntry = (
    path: string,
    changeFrequency: SitemapEntry["changeFrequency"],
    priority: number,
    alternates?: SitemapEntry["alternates"]
  ) => {
    const url = toAbsolute(path);
    const current = entries.get(url);

    entries.set(url, {
      url,
      lastModified,
      changeFrequency,
      priority: Math.max(current?.priority ?? 0, priority),
      ...(alternates ? { alternates } : {})
    });
  };

  for (const route of BILINGUAL_ROUTE_PAIRS) {
    const languageAlternates = buildAbsoluteLanguageAlternates(
      route.fr,
      toAbsolute
    );

    for (const path of [route.fr, route.en]) {
      setEntry(path, route.changeFrequency, route.priority, {
        languages: languageAlternates
      });
    }

    if (route.fr === "/") {
      for (const standaloneRoute of STANDALONE_SITEMAP_ENTRIES) {
        setEntry(
          standaloneRoute.path,
          standaloneRoute.changeFrequency,
          standaloneRoute.priority
        );
      }
    }
  }

  return [...entries.values()];
}

export function buildRobotsRules(): RobotsRule[] {
  return ["*", ...PUBLIC_AI_CRAWLERS].map((userAgent) => ({
    userAgent,
    contentSignal: ROBOTS_CONTENT_SIGNAL,
    allow: "/",
    disallow: [...INTERNAL_ROBOTS_DISALLOW]
  }));
}

function formatRobotsRule(rule: RobotsRule): string {
  return [
    `User-agent: ${rule.userAgent}`,
    rule.contentSignal ? `Content-Signal: ${rule.contentSignal}` : null,
    `Allow: ${rule.allow}`,
    ...rule.disallow.map((path) => `Disallow: ${path}`)
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildRobotsTxt(env?: SiteUrlEnv): string {
  return `${buildRobotsRules()
    .map(formatRobotsRule)
    .join("\n\n")}\n\nSitemap: ${absoluteUrl("/sitemap.xml", env)}\n`;
}

function resolvePublicUrl(value?: string): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function buildSocialProfiles(
  candidates: ReadonlyArray<{
    label: string;
    url: string | undefined;
  }>
): SocialProfile[] {
  const profiles: SocialProfile[] = [];

  for (const profile of candidates) {
    const url = resolvePublicUrl(profile.url);
    if (url && !profiles.some((candidate) => candidate.url === url)) {
      profiles.push({
        label: profile.label,
        url
      });
    }
  }

  return profiles;
}

export function getVistaireSocialProfiles(env?: SocialProfileEnv): SocialProfile[] {
  if (env) {
    return buildSocialProfiles([
      { label: "LinkedIn", url: env.NEXT_PUBLIC_VISTAIRE_LINKEDIN_URL },
      { label: "Instagram", url: env.NEXT_PUBLIC_VISTAIRE_INSTAGRAM_URL },
      {
        label: "Google Business Profile",
        url: env.NEXT_PUBLIC_VISTAIRE_GOOGLE_BUSINESS_URL
      },
      { label: "Facebook", url: env.NEXT_PUBLIC_VISTAIRE_FACEBOOK_URL },
      { label: "X", url: env.NEXT_PUBLIC_VISTAIRE_X_URL }
    ]);
  }

  return buildSocialProfiles([
    {
      label: "LinkedIn",
      url: process.env.NEXT_PUBLIC_VISTAIRE_LINKEDIN_URL
    },
    {
      label: "Instagram",
      url: process.env.NEXT_PUBLIC_VISTAIRE_INSTAGRAM_URL
    },
    {
      label: "Google Business Profile",
      url: process.env.NEXT_PUBLIC_VISTAIRE_GOOGLE_BUSINESS_URL
    },
    {
      label: "Facebook",
      url: process.env.NEXT_PUBLIC_VISTAIRE_FACEBOOK_URL
    },
    { label: "X", url: process.env.NEXT_PUBLIC_VISTAIRE_X_URL }
  ]);
}

export function buildOrganizationJsonLd(env?: SiteUrlEnv): JsonLdObject {
  const sameAs = getVistaireSocialProfiles(env).map((profile) => profile.url);

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${absoluteUrl("/", env)}#organization`,
    name: SITE_NAME,
    url: absoluteUrl("/", env),
    email: CONTACT_EMAIL,
    telephone: CONTACT_PHONE_TEL,
    description:
      "Vistaire conçoit des expériences de menu digital QR premium pour restaurants haut de gamme à Montréal, au Québec et au Canada.",
    areaServed: AREA_SERVED_JSON_LD,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: CONTACT_EMAIL,
      telephone: CONTACT_PHONE_TEL,
      areaServed: "CA",
      availableLanguage: ["fr-CA", "en-CA"]
    },
    knowsAbout: [
      "menu digital restaurant",
      "menu QR code restaurant",
      "carte digitale restaurant",
      "remplacement de menu PDF",
      "fiches plats visuelles",
      "3D et réalité augmentée pour restaurant"
    ],
    ...(sameAs.length > 0 ? { sameAs } : {})
  };
}

export function buildWebsiteJsonLd(
  env?: SiteUrlEnv,
  locale: Locale = "fr"
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${absoluteUrl("/", env)}#website`,
    name: SITE_NAME,
    url: absoluteUrl("/", env),
    inLanguage: LOCALE_LANGUAGE_TAG[locale],
    publisher: {
      "@id": `${absoluteUrl("/", env)}#organization`
    }
  };
}

export function buildProfessionalServiceJsonLd(env?: SiteUrlEnv): JsonLdObject {
  const sameAs = getVistaireSocialProfiles(env).map((profile) => profile.url);

  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": `${absoluteUrl("/", env)}#professional-service`,
    name: SITE_NAME,
    url: absoluteUrl("/", env),
    email: CONTACT_EMAIL,
    telephone: CONTACT_PHONE_TEL,
    description:
      "Vistaire est un service professionnel de menu digital QR premium pour restaurants haut de gamme, restaurants indépendants et cartes issues de menus PDF.",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Montréal",
      addressRegion: "QC",
      addressCountry: "CA"
    },
    areaServed: AREA_SERVED_JSON_LD,
    serviceType: "Menu digital QR premium pour restaurants",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: CONTACT_EMAIL,
      telephone: CONTACT_PHONE_TEL,
      areaServed: "CA",
      availableLanguage: ["fr-CA", "en-CA"]
    },
    makesOffer: SERVICE_OFFER_CATALOG.itemListElement,
    parentOrganization: {
      "@id": `${absoluteUrl("/", env)}#organization`
    },
    ...(sameAs.length > 0 ? { sameAs } : {})
  };
}

export function buildVistaireServiceJsonLd(env?: SiteUrlEnv): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${absoluteUrl("/", env)}#service`,
    name: "Carte digitale immersive Vistaire",
    serviceType: "Menu digital QR premium pour restaurants haut de gamme",
    url: absoluteUrl("/", env),
    description: DEFAULT_SITE_DESCRIPTION,
    mainEntityOfPage: {
      "@id": `${absoluteUrl("/", env)}#webpage`
    },
    provider: {
      "@id": `${absoluteUrl("/", env)}#organization`
    },
    areaServed: AREA_SERVED_JSON_LD,
    audience: {
      "@type": "BusinessAudience",
      audienceType:
        "Restaurants haut de gamme, restaurants indépendants et restaurants avec menu QR ou PDF"
    },
    hasOfferCatalog: SERVICE_OFFER_CATALOG
  };
}

export function buildWebPageJsonLd(
  page: {
    path: string;
    name: string;
    description: string;
    dateModified?: Date | string;
    locale?: Locale;
  },
  env?: SiteUrlEnv
): JsonLdObject {
  const dateModified =
    page.dateModified instanceof Date
      ? page.dateModified.toISOString()
      : page.dateModified;

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${absoluteUrl(page.path, env)}#webpage`,
    url: absoluteUrl(page.path, env),
    name: page.name,
    description: page.description,
    inLanguage: LOCALE_LANGUAGE_TAG[page.locale ?? "fr"],
    isPartOf: {
      "@id": `${absoluteUrl("/", env)}#website`
    },
    publisher: {
      "@id": `${absoluteUrl("/", env)}#organization`
    },
    ...(dateModified ? { dateModified } : {})
  };
}

export function buildPageServiceJsonLd(
  service: {
    path: string;
    name: string;
    serviceType: string;
    description: string;
  },
  env?: SiteUrlEnv
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${absoluteUrl(service.path, env)}#service`,
    name: service.name,
    serviceType: service.serviceType,
    description: service.description,
    url: absoluteUrl(service.path, env),
    provider: {
      "@id": `${absoluteUrl("/", env)}#organization`
    },
    areaServed: AREA_SERVED_JSON_LD,
    audience: {
      "@type": "BusinessAudience",
      audienceType:
        "Restaurants haut de gamme, restaurants indépendants et restaurants avec menu QR ou PDF"
    },
    hasOfferCatalog: SERVICE_OFFER_CATALOG
  };
}

export function buildContactPageJsonLd(
  page: {
    path: string;
    name: string;
    description: string;
    locale?: Locale;
  },
  env?: SiteUrlEnv
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": `${absoluteUrl(page.path, env)}#webpage`,
    url: absoluteUrl(page.path, env),
    name: page.name,
    description: page.description,
    inLanguage: LOCALE_LANGUAGE_TAG[page.locale ?? "fr"],
    isPartOf: {
      "@id": `${absoluteUrl("/", env)}#website`
    },
    publisher: {
      "@id": `${absoluteUrl("/", env)}#organization`
    },
    mainEntity: {
      "@type": "Organization",
      "@id": `${absoluteUrl("/", env)}#organization`,
      name: SITE_NAME,
      email: CONTACT_EMAIL,
      telephone: CONTACT_PHONE_TEL,
      areaServed: AREA_SERVED_JSON_LD,
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: CONTACT_EMAIL,
        telephone: CONTACT_PHONE_TEL,
        areaServed: "CA",
        availableLanguage: ["fr-CA", "en-CA"]
      }
    }
  };
}

export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
  env?: SiteUrlEnv
): JsonLdObject {
  const currentPath = items.at(-1)?.path ?? "/";

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${absoluteUrl(currentPath, env)}#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path, env)
    }))
  };
}

export function buildFaqPageJsonLd(
  faqs: Array<{ question: string; answer: string }>,
  pagePath: string,
  env?: SiteUrlEnv
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${absoluteUrl(pagePath, env)}#faq`,
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer
      }
    }))
  };
}
