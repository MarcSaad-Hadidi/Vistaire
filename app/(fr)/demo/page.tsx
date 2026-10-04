import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { RestaurantExperiences } from "@/components/vistaire-preview/RestaurantExperiences";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import { absoluteUrl, buildBreadcrumbJsonLd, buildWebPageJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

const canonicalPath = "/demo";
const title = "Trois expériences de menu restaurant | Vistaire";
const description =
  "Découvrez Maison Élyse, Trouvable et Sauge Noire : trois identités Vistaire, leurs vraies cartes et leurs fiches plats, avec 3D et AR sur les plats compatibles.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: buildPageAlternates(canonicalPath),
  openGraph: {
    url: absoluteUrl(canonicalPath),
    title,
    description,
    locale: LOCALE_OPEN_GRAPH.fr,
    type: "website"
  },
  twitter: {
    card: "summary",
    title,
    description
  }
};

export default function DemoPage() {
  return (
    <>
      <JsonLd
        data={[
          buildWebPageJsonLd({ path: canonicalPath, name: title, description }),
          buildBreadcrumbJsonLd([
            { name: "Accueil", path: "/" },
            { name: "Expériences Vistaire", path: canonicalPath }
          ])
        ]}
      />
      <RestaurantExperiences currentPath={canonicalPath} locale="fr" />
    </>
  );
}
