import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { TarifsMenuDigitalRestaurantPage } from "@/components/seo/pages/TarifsMenuDigitalRestaurantPage";
import {
  PRICING_PATH,
  buildPricingPageJsonLd,
  pricingMetadata
} from "@/lib/pricingPage";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import { absoluteUrl } from "@/lib/seo";

const socialImage = "/images/pricing/vistaire-acrylique.jpg";

export const metadata: Metadata = {
  title: {
    absolute: pricingMetadata.title
  },
  description: pricingMetadata.description,
  alternates: buildPageAlternates(PRICING_PATH),
  robots: {
    index: true,
    follow: true
  },
  openGraph: {
    title: pricingMetadata.title,
    description: pricingMetadata.description,
    url: absoluteUrl(PRICING_PATH),
    locale: LOCALE_OPEN_GRAPH.fr,
    type: "website",
    images: [
      {
        url: absoluteUrl(socialImage),
        alt: "Support QR Vistaire Acrylique sur une table de restaurant premium"
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

export default function TarifsMenuDigitalRestaurantRoute() {
  return (
    <>
      <JsonLd data={buildPricingPageJsonLd()} />
      <TarifsMenuDigitalRestaurantPage />
    </>
  );
}
