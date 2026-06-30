import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MaisonElyseDishDetail } from "@/components/menu/MaisonElyseDishDetail";
import { PublicDishDetailExperience } from "@/components/menu/PublicDishDetailExperience";
import { TrouvableDishDetailExperience } from "@/components/menu/TrouvableDishDetailExperience";
import { normalizeLocale } from "@/lib/i18n";
import { getPublicMenuBySlug } from "@/lib/menu/publicMenu";
import { menuUiConfigForRestaurant } from "@/lib/menu/menuUiConfig";
import { getPublicMenuDishBySlug } from "@/lib/menu/publicMenuCore";
import {
  isTrouvablePublicMenu,
  resolvePublicMenuUiConfig
} from "@/lib/menu/trouvableMenuExperience";
import { getPublishedMenuUiConfigForRestaurant } from "@/lib/owner/menuUiConfigStore";

export const dynamic = "force-dynamic";

type PublicDishPageProps = {
  params: Promise<{ slug: string; dishSlug: string }>;
  searchParams: Promise<{ lang?: string; table?: string; zone?: string; view?: string }>;
};

export async function generateMetadata({
  params,
  searchParams
}: PublicDishPageProps): Promise<Metadata> {
  const { slug, dishSlug } = await params;
  const query = await searchParams;
  const hasLangParam = typeof query.lang === "string" && query.lang.trim().length > 0;
  const locale = hasLangParam ? normalizeLocale(query.lang) : "fr";
  const menu = await getPublicMenuBySlug(slug, locale);
  const dish = menu ? getPublicMenuDishBySlug(menu, dishSlug) : null;

  if (!menu || !dish) {
    return {
      title: "Plat introuvable | Menu Vistaire",
      robots: { index: false, follow: false }
    };
  }

  return {
    title: `${dish.name} | ${menu.name}`,
    description: dish.description || `${dish.name}, ${dish.category}`,
    robots: { index: false, follow: true }
  };
}

export default async function PublicDishPage({
  params,
  searchParams
}: PublicDishPageProps) {
  const { slug, dishSlug } = await params;
  const query = await searchParams;
  const hasLangParam = typeof query.lang === "string" && query.lang.trim().length > 0;
  const locale = hasLangParam ? normalizeLocale(query.lang) : "fr";
  const menuQuery = {
    ...(hasLangParam ? { lang: locale } : {}),
    table: query.table,
    zone: query.zone,
    view: query.view
  };
  const menu = await getPublicMenuBySlug(slug, locale);

  if (!menu) {
    notFound();
  }

  const dish = getPublicMenuDishBySlug(menu, dishSlug);
  if (!dish) {
    notFound();
  }

  if (menu.slug === "maison-elyse") {
    return (
      <MaisonElyseDishDetail
        dish={dish}
        locale={locale}
        menu={menu}
        query={menuQuery}
      />
    );
  }

  const context = [
    query.table ? `Table ${query.table}` : "",
    query.zone ? `Zone ${query.zone}` : ""
  ]
    .filter(Boolean)
    .join(" · ");
  if (isTrouvablePublicMenu(menu)) {
    return (
      <TrouvableDishDetailExperience
        context={context}
        dish={dish}
        menu={menu}
        query={menuQuery}
      />
    );
  }

  const fallbackConfig = menuUiConfigForRestaurant({
    name: menu.name,
    slug: menu.slug
  });
  const configRecord = await getPublishedMenuUiConfigForRestaurant(
    menu.restaurantId,
    fallbackConfig
  );
  const resolvedConfig = resolvePublicMenuUiConfig(menu, configRecord.config);

  return (
    <PublicDishDetailExperience
      config={resolvedConfig}
      context={context}
      dish={dish}
      menu={menu}
      query={menuQuery}
    />
  );
}
