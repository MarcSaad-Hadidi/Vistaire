import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { VistaireAboutPreview } from "@/components/vistaire-preview/VistaireAboutPreview";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import { absoluteUrl, buildBreadcrumbJsonLd, buildWebPageJsonLd } from "@/lib/seo";

const canonicalPath = "/a-propos";
const title = "À propos de Vistaire";
const description =
  "Vistaire transforme le QR code d'un restaurant en carte digitale premium, mobile-first, visuelle et pensée pour les restaurants haut de gamme.";

export const metadata: Metadata = {
  title,
  description,
  alternates: buildPageAlternates(canonicalPath),
  openGraph: {
    url: absoluteUrl(canonicalPath),
    title,
    description:
      "Une carte digitale premium qui prolonge l'expérience du restaurant sans remplacer le service.",
    locale: LOCALE_OPEN_GRAPH.fr,
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "À propos de Vistaire",
    description:
      "Une carte digitale premium qui prolonge l'expérience du restaurant sans remplacer le service."
  }
};

export default function AProposPage() {
  return (
    <>
      <JsonLd
        data={[
          buildWebPageJsonLd({
            path: canonicalPath,
            name: title,
            description
          }),
          buildBreadcrumbJsonLd([
            { name: "Accueil", path: "/" },
            { name: "À propos", path: canonicalPath }
          ])
        ]}
      />
      <VistaireAboutPreview routeMode="production" />
    </>
  );
}
