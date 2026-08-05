import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { DemoPhoneShowcase } from "@/components/vistaire-preview/DemoPhoneShowcase";
import { buildPageAlternates, LOCALE_OPEN_GRAPH } from "@/lib/i18n";
import { getLandingExperiences } from "@/lib/landing/menuExperiences";
import { absoluteUrl, buildBreadcrumbJsonLd, buildWebPageJsonLd } from "@/lib/seo";

const canonicalPath = "/en/vistaire-menu";
const title = "Sample client menu | Vistaire";
const description =
  "Explore three Vistaire client menu experiences, designed for a fluid at-table reading experience.";

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
  const experiences = await getLandingExperiences("en");

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
            { name: "Vistaire client menu", path: canonicalPath }
          ])
        ]}
      />
      <DemoPhoneShowcase
        currentPath={canonicalPath}
        experiences={experiences}
        locale="en"
        menuLocale="en"
      />
    </>
  );
}
