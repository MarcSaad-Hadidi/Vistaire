import { SEO_GEO_PAGES as SEO_GEO_PAGES_FR } from "./seoGeoPages.fr.ts";
import { SEO_GEO_PAGES_EN } from "./seoGeoPages.en.ts";

export type {
  CommercialIntent,
  SearchIntentMatrixEntry,
  SeoGeoInternalLink,
  SeoGeoPageData,
  SeoGeoPageDraft,
  SeoGeoPageSlug,
  SeoGeoPageSlugEn,
  SeoGeoPageSlugFr,
  SeoGeoPageType,
  SeoGeoQueryEvidence,
  SeoGeoQueryEvidenceStatus,
  SeoGeoRoutePair
} from "./seoGeoTypes.ts";
export {
  SEO_GEO_CONTENT_UPDATED_AT,
  SEO_GEO_EDITORIAL_QUERY_EVIDENCE
} from "./seoGeoEvidence.ts";
export { SEO_GEO_ROUTE_PAIRS } from "./seoGeoRoutes.ts";
export {
  PLANNED_SEO_GEO_PAGES,
  SEARCH_INTENT_MATRIX
} from "./seoGeoIntent.ts";
export { SEO_GEO_PAGES_FR as SEO_GEO_PAGES, SEO_GEO_PAGES_EN };

export function getSeoGeoPage(
  slug: string,
  locale: "fr" | "en" = "fr"
) {
  const pages = locale === "en" ? SEO_GEO_PAGES_EN : SEO_GEO_PAGES_FR;

  return pages.find((page) => page.slug === slug) ?? null;
}

export function getPublishedSeoGeoPaths(locale: "fr" | "en" = "fr"): string[] {
  return (locale === "en" ? SEO_GEO_PAGES_EN : SEO_GEO_PAGES_FR).map(
    (page) => page.path
  );
}
