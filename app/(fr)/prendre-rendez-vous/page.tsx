import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { VistaireRendezVousPreview } from "@/components/vistaire-preview/VistaireRendezVousPreview";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import {
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildPageServiceJsonLd,
  buildWebPageJsonLd
} from "@/lib/seo";

const canonicalPath = "/prendre-rendez-vous";
const title = "Prendre rendez-vous avec Vistaire";
const description =
  "Planifiez un rendez-vous avec Vistaire pour présenter votre restaurant avec une carte digitale premium.";

export const metadata: Metadata = {
  title,
  description,
  alternates: buildPageAlternates(canonicalPath),
  openGraph: {
    url: absoluteUrl(canonicalPath),
    title,
    description:
      "Parlez-nous de votre restaurant, de votre carte et de l'expérience que vous souhaitez offrir.",
    locale: LOCALE_OPEN_GRAPH.fr,
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "Prendre rendez-vous avec Vistaire",
    description:
      "Parlez-nous de votre restaurant, de votre carte et de l'expérience que vous souhaitez offrir."
  }
};

export default function PrendreRendezVousPage() {
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
            name: "Rendez-vous Vistaire",
            serviceType: "Diagnostic de carte digitale QR pour restaurant",
            description
          }),
          buildBreadcrumbJsonLd([
            { name: "Accueil", path: "/" },
            { name: "Prendre rendez-vous", path: canonicalPath }
          ])
        ]}
      />
      <VistaireRendezVousPreview routeMode="production" />
    </>
  );
}
