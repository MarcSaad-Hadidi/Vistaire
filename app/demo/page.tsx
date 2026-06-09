import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { VistaireMenuPreview } from "@/components/vistaire-preview/VistaireMenuPreview";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import { absoluteUrl } from "@/lib/seo";
import { buildBreadcrumbJsonLd, buildWebPageJsonLd } from "@/lib/seo";

const canonicalPath = "/demo";
const title = "Menu client exemple | Maison Élyse";
const description =
  "Maison Élyse est un restaurant exemple de présentation Vistaire : menu client, fiches plats, allergènes, accords et vues immersives.";

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
    card: "summary",
    title: `${title} | Vistaire`,
    description
  }
};

export default function DemoPage() {
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
            { name: "Menu client exemple", path: canonicalPath }
          ])
        ]}
      />
      <VistaireMenuPreview routeMode="production" />
    </>
  );
}
