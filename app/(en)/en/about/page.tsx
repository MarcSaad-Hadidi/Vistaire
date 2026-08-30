import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { VistaireAboutPreview } from "@/components/vistaire-preview/VistaireAboutPreview";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import { absoluteUrl, buildBreadcrumbJsonLd, buildWebPageJsonLd } from "@/lib/seo";

const canonicalPath = "/en/about";
const title = "About Vistaire";
const description =
  "Vistaire turns a restaurant QR code into a premium mobile-first digital menu for high-end restaurants.";

export const metadata: Metadata = {
  title,
  description,
  alternates: buildPageAlternates(canonicalPath),
  openGraph: {
    url: absoluteUrl(canonicalPath),
    title,
    description:
      "A premium digital menu that extends the restaurant experience without replacing service.",
    locale: LOCALE_OPEN_GRAPH.en,
    type: "website"
  },
  twitter: {
    card: "summary",
    title,
    description:
      "A premium digital menu that extends the restaurant experience without replacing service."
  }
};

export default function AboutPageEn() {
  return (
    <>
      <JsonLd
        data={[
          buildWebPageJsonLd({
            path: canonicalPath,
            name: title,
            description,
            locale: "en"
          }),
          buildBreadcrumbJsonLd([
            { name: "Home", path: "/en" },
            { name: "About", path: canonicalPath }
          ])
        ]}
      />
      <VistaireAboutPreview locale="en" routeMode="production" />
    </>
  );
}
