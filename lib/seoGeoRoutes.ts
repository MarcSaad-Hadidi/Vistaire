import { SEO_GEO_CONTENT_UPDATED_AT } from "./seoGeoEvidence.ts";
import type { SeoGeoRoutePair } from "./seoGeoTypes.ts";

export const SEO_GEO_ROUTE_PAIRS = [
  {
    fr: "/menu-qr-sans-pdf",
    en: "/en/qr-menu-without-pdf",
    priority: 0.81,
    updatedAt: SEO_GEO_CONTENT_UPDATED_AT
  },
  {
    fr: "/menu-digital-sans-application",
    en: "/en/digital-menu-without-app",
    priority: 0.79,
    updatedAt: SEO_GEO_CONTENT_UPDATED_AT
  },
  {
    fr: "/remplacer-menu-pdf-restaurant",
    en: "/en/replace-restaurant-pdf-menu",
    priority: 0.83,
    updatedAt: SEO_GEO_CONTENT_UPDATED_AT
  },
  {
    fr: "/alternative-menu-pdf-restaurant",
    en: "/en/restaurant-pdf-menu-alternative",
    priority: 0.8,
    updatedAt: SEO_GEO_CONTENT_UPDATED_AT
  },
  {
    fr: "/fiche-plat-digitale-restaurant",
    en: "/en/digital-dish-page-restaurant",
    priority: 0.78,
    updatedAt: SEO_GEO_CONTENT_UPDATED_AT
  },
  {
    fr: "/menu-restaurant-photos",
    en: "/en/restaurant-menu-photos",
    priority: 0.76,
    updatedAt: SEO_GEO_CONTENT_UPDATED_AT
  },
  {
    fr: "/menu-restaurant-allergenes",
    en: "/en/restaurant-menu-allergens",
    priority: 0.76,
    updatedAt: SEO_GEO_CONTENT_UPDATED_AT
  },
  {
    fr: "/menu-digital-restaurant-montreal",
    en: "/en/digital-restaurant-menu-montreal",
    priority: 0.82,
    updatedAt: SEO_GEO_CONTENT_UPDATED_AT
  },
  {
    fr: "/menu-digital-restaurant-laval",
    en: "/en/digital-restaurant-menu-laval",
    priority: 0.74,
    updatedAt: SEO_GEO_CONTENT_UPDATED_AT
  },
  {
    fr: "/menu-digital-restaurant-brossard",
    en: "/en/digital-restaurant-menu-brossard",
    priority: 0.74,
    updatedAt: SEO_GEO_CONTENT_UPDATED_AT
  },
  {
    fr: "/menu-digital-restaurant-haut-de-gamme",
    en: "/en/high-end-restaurant-digital-menu",
    priority: 0.82,
    updatedAt: SEO_GEO_CONTENT_UPDATED_AT
  },
  {
    fr: "/menu-digital-restaurant-gastronomique",
    en: "/en/fine-dining-restaurant-digital-menu",
    priority: 0.78,
    updatedAt: SEO_GEO_CONTENT_UPDATED_AT
  }
] as const satisfies readonly SeoGeoRoutePair[];
