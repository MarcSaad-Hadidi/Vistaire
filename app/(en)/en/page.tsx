import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { VistairePreviewLanding } from "@/components/vistaire-preview/VistairePreviewLanding";
import { absoluteUrl, buildVistaireServiceJsonLd, buildWebPageJsonLd } from "@/lib/seo";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";

const canonicalPath = "/en";
const title = "Premium QR digital menu for high-end restaurants";
const description =
  "Vistaire creates a premium mobile-first digital menu for high-end restaurants: QR code, visual dish pages, allergens and selective 3D/AR.";

export const metadata: Metadata = {
  title,
  description,
  alternates: buildPageAlternates(canonicalPath),
  openGraph: {
    url: absoluteUrl(canonicalPath),
    title: "Vistaire | Premium QR digital menu for high-end restaurants",
    description,
    locale: LOCALE_OPEN_GRAPH.en
  },
  twitter: {
    card: "summary",
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
