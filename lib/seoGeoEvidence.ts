import type {
  SeoGeoPageData,
  SeoGeoPageDraft,
  SeoGeoQueryEvidence
} from "./seoGeoTypes.ts";

export const SEO_GEO_CONTENT_UPDATED_AT = "2026-06-22T21:26:34.000Z";

export const SEO_GEO_EDITORIAL_QUERY_EVIDENCE = {
  status: "editorial-hypothesis",
  source: "editorial",
  updatedAt: SEO_GEO_CONTENT_UPDATED_AT,
  note:
    "Editorial SEO/GEO mapping from Vistaire positioning and visible page intent; no validated keyword-volume, ranking, difficulty, client-performance or conversion export has been supplied."
} satisfies SeoGeoQueryEvidence;

export function withEditorialQueryEvidence(
  pages: ReadonlyArray<SeoGeoPageDraft>
): SeoGeoPageData[] {
  return pages.map((page) => ({
    ...page,
    updatedAt: page.updatedAt ?? SEO_GEO_CONTENT_UPDATED_AT,
    queryEvidence: page.queryEvidence ?? { ...SEO_GEO_EDITORIAL_QUERY_EVIDENCE }
  }));
}
