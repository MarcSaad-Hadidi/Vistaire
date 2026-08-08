import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { DemoPhoneShowcase } from "@/components/vistaire-preview/DemoPhoneShowcase";
import { buildPageAlternates, LOCALE_OPEN_GRAPH, normalizeLocale } from "@/lib/i18n";
import { getPublicMenuBySlug } from "@/lib/menu/publicMenu";
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

type DemoPageProps = {
  searchParams: Promise<{ lang?: string }>;
};

export default async function DemoPage({ searchParams }: DemoPageProps) {
  const query = await searchParams;
  const hasLangParam = typeof query.lang === "string" && query.lang.trim().length > 0;
  const menuLocale = hasLangParam ? normalizeLocale(query.lang) : "fr";
  const [frenchMenu, englishMenu] = await Promise.all([
    getPublicMenuBySlug("maison-elyse", "fr"),
    getPublicMenuBySlug("maison-elyse", "en")
  ]);

  if (!frenchMenu || !englishMenu) {
    notFound();
  }

  const menu = menuLocale === "en" ? englishMenu : frenchMenu;

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
      <DemoPhoneShowcase
        localizedMenus={{ "fr-CA": frenchMenu, "en-CA": englishMenu }}
        menu={menu}
        menuLocale={menuLocale}
        menuQuery={hasLangParam ? { lang: menuLocale } : undefined}
      />
    </>
  );
}
