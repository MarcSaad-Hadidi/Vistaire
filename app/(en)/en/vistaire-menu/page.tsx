import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { RestaurantExperiences } from "@/components/vistaire-preview/RestaurantExperiences";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import { absoluteUrl, buildBreadcrumbJsonLd, buildWebPageJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

const canonicalPath = "/en/vistaire-menu";
const title = "Three restaurant menu experiences | Vistaire";
const description =
  "Explore Maison Élyse, Trouvable and Sauge Noire: three Vistaire demonstration menus with dish details, photos, 3D and AR for compatible dishes.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: buildPageAlternates(canonicalPath),
  openGraph: {
    url: absoluteUrl(canonicalPath),
    title,
    description,
    locale: LOCALE_OPEN_GRAPH.en,
    type: "website"
  },
  twitter: {
    card: "summary",
    title,
    description
  }
};

export default function VistaireMenuPageEn() {
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
          buildBreadcrumbJsonLd([
            { name: "Home", path: "/en" },
            { name: "Vistaire experiences", path: canonicalPath }
          ])
        ]}
      />
      <RestaurantExperiences currentPath={canonicalPath} locale="en" />
    </>
  );
}
