import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildPageServiceJsonLd,
  buildWebPageJsonLd,
  type JsonLdObject
} from "./seo.ts";
import type { SeoGeoPageData } from "./seoGeoTypes.ts";

function normalizePlaceName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function areaServedType(name: string): "City" | "AdministrativeArea" | "Country" | "Place" {
  const normalized = normalizePlaceName(name);

  if (normalized === "canada") return "Country";
  if (["quebec", "monteregie"].includes(normalized)) {
    return "AdministrativeArea";
  }
  if (["montreal", "laval", "brossard"].includes(normalized)) return "City";
  return "Place";
}

function buildAreaServed(areaServed?: string[]): JsonLdObject[] | undefined {
  if (!areaServed?.length) return undefined;

  return areaServed.map((name) => ({
    "@type": areaServedType(name),
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
      dateModified: page.updatedAt,
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
