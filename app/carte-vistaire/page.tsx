import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { CarteVistairePage } from "@/components/carte-vistaire/CarteVistairePage";
import { CARTE_VISTAIRE_PATH } from "@/lib/pricingPage";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import {
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildPageServiceJsonLd,
  buildWebPageJsonLd
} from "@/lib/seo";

const title = "Carte Vistaire interactive | Menu digital premium";
const description =
  "Découvrez une carte Vistaire interactive avec catégories, fiches plats, prix, allergènes et plats 3D inclus lorsque le rendu est validé.";

export const metadata: Metadata = {
  title,
  description,
  alternates: buildPageAlternates(CARTE_VISTAIRE_PATH),
  robots: {
    index: true,
    follow: true
  },
  openGraph: {
    title,
    description,
    url: absoluteUrl(CARTE_VISTAIRE_PATH),
    locale: LOCALE_OPEN_GRAPH.fr,
    type: "website"
  },
  twitter: {
    card: "summary",
    title,
    description
  }
};

export default function CarteVistaireRoute() {
  return (
    <>
      <JsonLd
        data={[
          buildWebPageJsonLd({
            path: CARTE_VISTAIRE_PATH,
            name: title,
            description
          }),
          buildPageServiceJsonLd({
            path: CARTE_VISTAIRE_PATH,
            name: "Carte Vistaire interactive",
            serviceType: "Carte digitale mobile premium pour restaurants",
            description:
              "Carte mobile avec catégories, fiches plats, prix, allergènes, QR code et plats 3D inclus selon validation."
          }),
          buildBreadcrumbJsonLd([
            { name: "Accueil", path: "/" },
            { name: "Carte Vistaire", path: CARTE_VISTAIRE_PATH }
          ])
        ]}
      />
      <CarteVistairePage />
    </>
  );
}
