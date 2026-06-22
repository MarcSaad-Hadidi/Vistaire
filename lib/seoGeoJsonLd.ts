import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildPageServiceJsonLd,
  buildWebPageJsonLd,
  type JsonLdObject
} from "./seo.ts";
import type { SeoGeoPageData } from "./seoGeoPages.ts";

function buildAreaServed(areaServed?: string[]): JsonLdObject[] | undefined {
  if (!areaServed?.length) return undefined;

  return areaServed.map((name) => ({
    "@type": "Place",
    name
  }));
}

export function buildSeoGeoAeoJsonLd(page: SeoGeoPageData) {
  const locale = page.locale ?? "fr";
  const service = buildPageServiceJsonLd({
    path: page.path,
    ...page.service
  });
  const areaServed = buildAreaServed(page.areaServed);

  if (areaServed) {
    service.areaServed = areaServed;
  }

  return [
    buildWebPageJsonLd({
      path: page.path,
      name: page.metadataTitle,
      description: page.metadataDescription,
      locale
    }),
    buildBreadcrumbJsonLd([
      { name: locale === "en" ? "Home" : "Accueil", path: locale === "en" ? "/en" : "/" },
      { name: page.h1, path: page.path }
    ]),
    service,
    buildFaqPageJsonLd(page.faq, page.path)
  ];
}
