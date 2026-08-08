import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { DemoPhoneShowcase } from "@/components/vistaire-preview/DemoPhoneShowcase";
import { buildPageAlternates, LOCALE_OPEN_GRAPH, normalizeLocale } from "@/lib/i18n";
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

type VistaireMenuPageEnProps = {
  searchParams: Promise<{ lang?: string }>;
};

export default async function VistaireMenuPageEn({
  searchParams
}: VistaireMenuPageEnProps) {
  const query = await searchParams;
  const hasLangParam = typeof query.lang === "string" && query.lang.trim().length > 0;
  const menuLocale = hasLangParam ? normalizeLocale(query.lang) : "en";
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
        localizedMenus={{ "fr-CA": frenchMenu, "en-CA": englishMenu }}
        locale="en"
        menu={menu}
        menuLocale={menuLocale}
        menuQuery={hasLangParam ? { lang: menuLocale } : undefined}
      />
    </>
  );
}
