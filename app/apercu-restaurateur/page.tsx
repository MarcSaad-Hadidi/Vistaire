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

const canonicalPath = "/apercu-restaurateur";
const title = "Aperçu restaurateur Vistaire";
const description =
  "Découvrez l'interface restaurateur Vistaire : menu actif, QR code, plats populaires, readiness et signaux d'attention pour une carte premium.";

export const metadata: Metadata = {
  title,
  description,
  alternates: buildPageAlternates(canonicalPath),
  openGraph: {
    url: absoluteUrl(canonicalPath),
    title: `${title} | Vistaire`,
    description,
    locale: LOCALE_OPEN_GRAPH.fr,
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} | Vistaire`,
    description
  }
};

export default async function RestaurateurDashboardPreviewPage() {
  const demoMenuUrl = absoluteUrl("/demo");
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
            description
          }),
          buildPageServiceJsonLd({
            path: canonicalPath,
            name: "Interface restaurateur Vistaire",
            serviceType: "Aperçu restaurateur pour menu digital premium",
            description
          }),
          buildBreadcrumbJsonLd([
            { name: "Accueil", path: "/" },
            { name: "Aperçu restaurateur", path: canonicalPath }
          ])
        ]}
      />
      <VistaireRestaurateurDashboardPreview
        demoQrSvg={demoQrSvg}
        routeMode="production"
      />
    </>
  );
}
