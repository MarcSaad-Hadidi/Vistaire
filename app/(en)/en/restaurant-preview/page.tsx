import type { Metadata } from "next";
import QRCode from "qrcode";
import { JsonLd } from "@/components/JsonLd";
import { VistaireRestaurateurDashboardPreview } from "@/components/vistaire-preview/VistaireRestaurateurDashboardPreview";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import {
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildPageServiceJsonLd,
  buildWebPageJsonLd
} from "@/lib/seo";

const canonicalPath = "/en/restaurant-preview";
const title = "Vistaire restaurant preview";
const description =
  "Explore an interactive demonstration of the Vistaire restaurant dashboard: Overview, Availability and Insights with isolated fictional data.";

export const metadata: Metadata = {
  title,
  description,
  alternates: buildPageAlternates(canonicalPath),
  openGraph: {
    url: absoluteUrl(canonicalPath),
    title: `${title} | Vistaire`,
    description,
    locale: LOCALE_OPEN_GRAPH.en,
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} | Vistaire`,
    description
  }
};

export default async function RestaurantPreviewPageEn() {
  const demoMenuUrl = absoluteUrl("/en/vistaire-menu");
  const demoQrSvg = await QRCode.toString(demoMenuUrl, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 3,
    width: 172,
    color: {
      dark: "#0d0805",
      light: "#fff7ea"
    }
  });

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
          buildPageServiceJsonLd({
            path: canonicalPath,
            name: "Vistaire restaurant preview",
            serviceType: "Restaurant dashboard demonstration for a premium digital menu",
            description
          }),
          buildBreadcrumbJsonLd([
            { name: "Home", path: "/en" },
            { name: "Restaurant preview", path: canonicalPath }
          ])
        ]}
      />
      <VistaireRestaurateurDashboardPreview
        demoQrSvg={demoQrSvg}
        locale="en"
        routeMode="production"
      />
    </>
  );
}
