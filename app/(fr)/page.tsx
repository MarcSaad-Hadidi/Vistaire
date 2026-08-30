import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { VistairePreviewLanding } from "@/components/vistaire-preview/VistairePreviewLanding";
import {
  DEFAULT_SITE_DESCRIPTION,
  absoluteUrl,
  buildVistaireServiceJsonLd,
  buildWebPageJsonLd
} from "@/lib/seo";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Menu digital QR premium pour restaurants haut de gamme",
  description: DEFAULT_SITE_DESCRIPTION,
  alternates: buildPageAlternates("/"),
  openGraph: {
    url: absoluteUrl("/"),
    title: "Vistaire | Menu digital QR premium pour restaurants haut de gamme",
    description: DEFAULT_SITE_DESCRIPTION,
    locale: LOCALE_OPEN_GRAPH.fr
  },
  twitter: {
    card: "summary",
    title: "Vistaire | Menu digital QR premium pour restaurants haut de gamme",
    description: DEFAULT_SITE_DESCRIPTION
  }
};

export default function Home() {
  return (
    <>
      <JsonLd
        data={[
          buildWebPageJsonLd({
            path: "/",
            name: "Vistaire | Menu digital QR premium pour restaurants haut de gamme",
            description: DEFAULT_SITE_DESCRIPTION
          }),
          buildVistaireServiceJsonLd()
        ]}
      />
      <VistairePreviewLanding routeMode="production" />
    </>
  );
}
