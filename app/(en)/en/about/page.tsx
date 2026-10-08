import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { VistaireAboutPreview } from "@/components/vistaire-preview/VistaireAboutPreview";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import { absoluteUrl, buildSocialImageMetadata, buildBreadcrumbJsonLd, buildWebPageJsonLd } from "@/lib/seo";

const canonicalPath = "/en/about";
const title = "About Vistaire";
const description =
  "Vistaire creates premium digital menus for restaurants with physical QR displays, dish photography and personalized, guided setup.";

export const metadata: Metadata = {
  title,
  description,
  alternates: buildPageAlternates(canonicalPath),
  openGraph: {
    ...buildSocialImageMetadata("en"),
    url: absoluteUrl(canonicalPath),
    title,
    description:
      "A premium digital menu that extends the restaurant experience without replacing service.",
    locale: LOCALE_OPEN_GRAPH.en,
    type: "website"
  },
  twitter: {
    ...buildSocialImageMetadata("en"),
    card: "summary_large_image",
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
