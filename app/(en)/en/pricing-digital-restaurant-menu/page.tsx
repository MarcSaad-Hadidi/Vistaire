import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { VistairePricingPreview } from "@/components/vistaire-preview/VistairePricingPreview";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import {
  buildPricingPageJsonLd,
  getPricingMetadata,
  PRICING_PATH_EN
} from "@/lib/pricingPage";
import { absoluteUrl } from "@/lib/seo";

const pricingMetadata = getPricingMetadata("en");
const socialImage = "/images/pricing/vistaire-acrylique.jpg";

export const metadata: Metadata = {
  title: {
    absolute: pricingMetadata.title
  },
  description: pricingMetadata.description,
  alternates: buildPageAlternates(PRICING_PATH_EN),
  robots: {
    index: true,
    follow: true
  },
  openGraph: {
    title: pricingMetadata.title,
    description: pricingMetadata.description,
    url: absoluteUrl(PRICING_PATH_EN),
    locale: LOCALE_OPEN_GRAPH.en,
    type: "website",
    images: [
      {
        url: absoluteUrl(socialImage),
        alt: "Vistaire Acrylic QR display on a premium restaurant table"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: pricingMetadata.title,
    description: pricingMetadata.description,
    images: [absoluteUrl(socialImage)]
  }
};

export default function PricingDigitalRestaurantMenuRouteEn() {
  return (
    <>
      <JsonLd data={buildPricingPageJsonLd(undefined, "en")} />
      <VistairePricingPreview locale="en" routeMode="production" />
    </>
  );
}
