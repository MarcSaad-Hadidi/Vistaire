import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MaisonElyseQrMenu } from "@/components/menu/MaisonElyseQrMenu";
import { PublicMenuRenderer } from "@/components/menu/PublicMenuRenderer";
import { normalizeLocale } from "@/lib/i18n";
import { getPublicMenuBySlug } from "@/lib/menu/publicMenu";
import { menuUiConfigForRestaurant } from "@/lib/menu/menuUiConfig";
import { getPublishedMenuUiConfigForRestaurant } from "@/lib/owner/menuUiConfigStore";

export const dynamic = "force-dynamic";

type MenuPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string; table?: string; view?: string; zone?: string }>;
};

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

export default async function PublicMenuPage({
  params,
  searchParams
}: MenuPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const hasLangParam = typeof query.lang === "string" && query.lang.trim().length > 0;
  const locale = hasLangParam ? normalizeLocale(query.lang) : "fr";
  const menuQuery = {
    ...(hasLangParam ? { lang: locale } : {}),
    table: query.table,
    zone: query.zone
  };
  const menu = await getPublicMenuBySlug(slug, locale);

  if (!menu) {
    notFound();
  }

  const context = [
    query.table ? `Table ${query.table}` : "",
    query.zone ? `Zone ${query.zone}` : ""
  ]
    .filter(Boolean)
    .join(" · ");
  const fallbackConfig = menuUiConfigForRestaurant({
    name: menu.name,
    slug: menu.slug
  });
  const configRecord = await getPublishedMenuUiConfigForRestaurant(
    menu.restaurantId,
    fallbackConfig
  );

  if (menu.slug === "maison-elyse") {
    const [frenchMenu, englishMenu] = await Promise.all([
      locale === "fr" ? Promise.resolve(menu) : getPublicMenuBySlug(slug, "fr"),
      locale === "en" ? Promise.resolve(menu) : getPublicMenuBySlug(slug, "en")
    ]);

    return (
      <MaisonElyseQrMenu
        menu={menu}
        locale={locale}
        localizedMenus={{
          ...(frenchMenu ? { fr: frenchMenu } : {}),
          ...(englishMenu ? { en: englishMenu } : {})
        }}
        context={context}
        query={menuQuery}
        startFullMenu={query.view === "carte"}
      />
    );
  }

  return (
    <PublicMenuRenderer
      menu={menu}
      config={configRecord.config}
      context={context}
      query={menuQuery}
      mode="public"
      disableHeavyAssets={false}
    />
  );
}
