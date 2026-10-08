import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { VistairePreviewLanding } from "@/components/vistaire-preview/VistairePreviewLanding";
import { absoluteUrl, buildSocialImageMetadata, buildVistaireServiceJsonLd, buildWebPageJsonLd } from "@/lib/seo";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";

export const revalidate = 60;

const canonicalPath = "/en";
const title = "Vistaire | Premium QR digital menu for high-end restaurants";
const description =
  "Vistaire creates your premium digital menu with a custom mobile design, physical QR displays, dish photography and guided setup for your restaurant.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: buildPageAlternates(canonicalPath),
  openGraph: {
    type: "website",
    ...buildSocialImageMetadata("en"),
    url: absoluteUrl(canonicalPath),
    title: "Vistaire | Premium QR digital menu for high-end restaurants",
    description,
    locale: LOCALE_OPEN_GRAPH.en
  },
  twitter: {
    ...buildSocialImageMetadata("en"),
    card: "summary_large_image",
    title: "Vistaire | Premium QR digital menu for high-end restaurants",
    description
  }
};

export default function EnglishHome() {
  return (
    <>
      <JsonLd
        data={[
          buildWebPageJsonLd({
            path: canonicalPath,
            name: "Vistaire | Premium QR digital menu for high-end restaurants",
            description,
            locale: "en"
          }),
          buildVistaireServiceJsonLd()
        ]}
      />
      <VistairePreviewLanding locale="en" routeMode="production" />
    </>
  );
}
