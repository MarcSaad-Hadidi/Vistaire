import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { VistaireMenuQrCodeRestaurantPreview } from "@/components/vistaire-preview/VistaireMenuQrCodeRestaurantPreview";
import { VistaireSeoProductionSections } from "@/components/vistaire-preview/VistaireSeoProductionSections";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import { absoluteUrl } from "@/lib/seo";
import { buildSeoPillarJsonLd } from "@/lib/seoPillarJsonLd";
import { getSeoPage } from "@/lib/seoPages";

const page = getSeoPage("menu-qr-code-restaurant", "en");

export const metadata: Metadata = {
  title: {
    absolute: page.metadataTitle
  },
  description: page.metadataDescription,
  alternates: buildPageAlternates(page.path),
  openGraph: {
    url: absoluteUrl(page.path),
    title: page.metadataTitle,
    description: page.metadataDescription,
    locale: LOCALE_OPEN_GRAPH.en,
    type: "website",
    images: [
      {
        url: absoluteUrl(page.visualImage.src),
        alt: page.visualImage.alt
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: page.metadataTitle,
    description: page.metadataDescription,
    images: [absoluteUrl(page.visualImage.src)]
  }
};

export default function QrCodeRestaurantMenuRouteEn() {
  return (
    <>
      <JsonLd data={buildSeoPillarJsonLd(page)} />
      <VistaireMenuQrCodeRestaurantPreview
        h1={page.h1}
        locale="en"
        routeMode="production"
        seoAppendix={<VistaireSeoProductionSections page={page} />}
      />
    </>
  );
}
