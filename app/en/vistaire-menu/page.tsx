import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { DemoPhoneShowcase } from "@/components/vistaire-preview/DemoPhoneShowcase";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import { getPublicMenuBySlug } from "@/lib/menu/publicMenu";
import { absoluteUrl, buildBreadcrumbJsonLd, buildWebPageJsonLd } from "@/lib/seo";

const canonicalPath = "/en/vistaire-menu";
const title = "Sample client menu | Maison Élyse";
const description =
  "Maison Élyse is a Vistaire sample restaurant menu: client menu, dish pages, allergens, pairings and immersive views.";

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
    card: "summary",
    title: `${title} | Vistaire`,
    description
  }
};

export default async function VistaireMenuPageEn() {
  const menu = await getPublicMenuBySlug("maison-elyse");

  if (!menu) {
    notFound();
  }

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
            { name: "Sample client menu", path: canonicalPath }
          ])
        ]}
      />
      <DemoPhoneShowcase
        currentPath={canonicalPath}
        locale="en"
        menu={menu}
      />
    </>
  );
}
