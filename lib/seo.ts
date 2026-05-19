export const SITE_NAME = "Vistaire";
export const SITE_URL_FALLBACK = "https://www.vistaire.ca";
export const DEFAULT_SITE_DESCRIPTION =
  "Vistaire transforme le QR code restaurant en menu digital premium, rapide, visuel et immersif avec fiches plats, vues 3D/AR quand disponibles et aperçu restaurateur.";

const SITE_URL_ENV_KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
  "SITE_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL"
] as const;

export const INTERNAL_ROBOTS_DISALLOW = [
  "/api/",
  "/owner",
  "/owner/",
  "/sign-in",
  "/sign-in/",
  "/todos",
  "/todos/"
] as const;

type SiteUrlEnv = {
  [key: string]: string | undefined;
};

type SitemapDish = {
  slug: string;
  isAvailable?: boolean;
};

export type SitemapEntry = {
  url: string;
  lastModified: Date;
  changeFrequency: "weekly" | "monthly";
  priority: number;
};

export type RobotsRule = {
  userAgent: string;
  allow: string;
  disallow: string[];
};

type JsonLdPrimitive = string | number | boolean | null;
export type JsonLdValue =
  | JsonLdPrimitive
  | JsonLdValue[]
  | { [key: string]: JsonLdValue };

export type JsonLdObject = {
  [key: string]: JsonLdValue;
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
  dishes: SitemapDish[],
  lastModified = new Date(),
  env?: SiteUrlEnv
): SitemapEntry[] {
  const availableDishEntries = dishes
    .filter((dish) => dish.isAvailable !== false)
    .map((dish) => ({
      url: absoluteUrl(`/demo/dishes/${dish.slug}`, env),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7
    }));

  return [
    {
      url: absoluteUrl("/", env),
      lastModified,
      changeFrequency: "monthly",
      priority: 1
    },
    {
      url: absoluteUrl("/demo", env),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9
    },
    ...availableDishEntries,
    {
      url: absoluteUrl("/admin", env),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.75
    }
  ];
}

export function buildRobotsRules(): RobotsRule[] {
  return [
    {
      userAgent: "OAI-SearchBot",
      allow: "/",
      disallow: [...INTERNAL_ROBOTS_DISALLOW]
    },
    {
      userAgent: "*",
      allow: "/",
      disallow: [...INTERNAL_ROBOTS_DISALLOW]
    }
  ];
}

export function buildOrganizationJsonLd(env?: SiteUrlEnv): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${absoluteUrl("/", env)}#organization`,
    name: SITE_NAME,
    url: absoluteUrl("/", env),
    description:
      "Vistaire conçoit des expériences de menu digital premium pour restaurants."
  };
}

export function buildWebsiteJsonLd(env?: SiteUrlEnv): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${absoluteUrl("/", env)}#website`,
    name: SITE_NAME,
    url: absoluteUrl("/", env),
    inLanguage: "fr-CA",
    publisher: {
      "@id": `${absoluteUrl("/", env)}#organization`
    }
  };
}

export function buildVistaireServiceJsonLd(env?: SiteUrlEnv): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${absoluteUrl("/", env)}#service`,
    name: "Menu digital premium Vistaire",
    serviceType: "Menu digital premium pour restaurants",
    description: DEFAULT_SITE_DESCRIPTION,
    provider: {
      "@id": `${absoluteUrl("/", env)}#organization`
    },
    areaServed: "Canada",
    audience: {
      "@type": "BusinessAudience",
      audienceType: "Restaurants"
    }
  };
}

export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
  env?: SiteUrlEnv
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path, env)
    }))
  };
}
