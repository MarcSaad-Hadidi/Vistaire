import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { DemoPhoneShowcase } from "@/components/vistaire-preview/DemoPhoneShowcase";
import { buildPageAlternates, LOCALE_OPEN_GRAPH, normalizeLocale } from "@/lib/i18n";
import { getLandingExperiences } from "@/lib/landing/menuExperiences";
import { absoluteUrl, buildBreadcrumbJsonLd, buildWebPageJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

const canonicalPath = "/demo";
const title = "Menu client exemple | Vistaire";
const description =
  "Explorez trois expériences de menu client Vistaire, pensées pour une lecture fluide à table.";

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

type DemoPageProps = {
  searchParams: Promise<{ lang?: string; experience?: string }>;
};

export default async function DemoPage({ searchParams }: DemoPageProps) {
  const query = await searchParams;
  const hasLangParam = typeof query.lang === "string" && query.lang.trim().length > 0;
  const locale = hasLangParam ? normalizeLocale(query.lang) : "fr";
  const experiences = await getLandingExperiences(locale);

  return (
    <>
      <JsonLd
        data={[
          buildWebPageJsonLd({ path: canonicalPath, name: title, description }),
          buildBreadcrumbJsonLd([
            { name: "Accueil", path: "/" },
            { name: "Menu client Vistaire", path: canonicalPath }
          ])
        ]}
      />
      <DemoPhoneShowcase
        experiences={experiences}
        menuLocale={locale}
      />
    </>
  );
}
