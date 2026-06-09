import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { VistaireContactPreview } from "@/components/vistaire-preview/VistaireContactPreview";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import {
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildContactPageJsonLd
} from "@/lib/seo";

const canonicalPath = "/contact";
const title = "Contact Vistaire";
const description =
  "Contactez Vistaire pour créer une carte digitale premium pour restaurant haut de gamme.";

export const metadata: Metadata = {
  title,
  description,
  alternates: buildPageAlternates(canonicalPath),
  openGraph: {
    url: absoluteUrl(canonicalPath),
    title,
    description:
      "Parlez à Vistaire de votre carte, de vos fiches plats et de votre expérience mobile.",
    locale: LOCALE_OPEN_GRAPH.fr,
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "Contact Vistaire",
    description:
      "Parlez à Vistaire de votre carte, de vos fiches plats et de votre expérience mobile."
  }
};

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={[
          buildContactPageJsonLd({
            path: canonicalPath,
            name: title,
            description
          }),
          buildBreadcrumbJsonLd([
            { name: "Accueil", path: "/" },
            { name: "Contact", path: canonicalPath }
          ])
        ]}
      />
      <VistaireContactPreview routeMode="production" />
    </>
  );
}
