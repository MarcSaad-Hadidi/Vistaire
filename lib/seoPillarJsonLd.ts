import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildPageServiceJsonLd,
  buildWebPageJsonLd
} from "@/lib/seo";
import type { SeoPageData } from "@/lib/seoPages";

export function buildSeoPillarJsonLd(page: SeoPageData) {
  const locale = page.locale ?? "fr";

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
    buildPageServiceJsonLd({
      path: page.path,
      ...page.service
    }),
    buildFaqPageJsonLd(page.faq, page.path)
  ];
}
