import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { VistaireAboutPreview } from "@/components/vistaire-preview/VistaireAboutPreview";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import { absoluteUrl, buildSocialImageMetadata, buildBreadcrumbJsonLd, buildWebPageJsonLd } from "@/lib/seo";

const canonicalPath = "/a-propos";
const title = "À propos de Vistaire";
const description =
  "Vistaire crée des menus digitaux premium pour restaurants, avec supports QR physiques, photos des plats et mise en place personnalisée et accompagnée.";

export const metadata: Metadata = {
  title,
  description,
  alternates: buildPageAlternates(canonicalPath),
  openGraph: {
    ...buildSocialImageMetadata("fr"),
    url: absoluteUrl(canonicalPath),
    title,
    description:
      "Une carte digitale premium qui prolonge l'expérience du restaurant sans remplacer le service.",
    locale: LOCALE_OPEN_GRAPH.fr,
    type: "website"
  },
  twitter: {
    ...buildSocialImageMetadata("fr"),
    card: "summary_large_image",
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
