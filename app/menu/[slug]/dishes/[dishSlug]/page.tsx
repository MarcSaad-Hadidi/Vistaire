import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MaisonElyseDishDetail } from "@/components/menu/MaisonElyseDishDetail";
import { PublicDishDetailExperience } from "@/components/menu/PublicDishDetailExperience";
import { TrouvableDishDetailExperience } from "@/components/menu/TrouvableDishDetailExperience";
import { getExchangeRates } from "@/lib/currency/exchangeRates";
import { getPublicMenuBySlug } from "@/lib/menu/publicMenu";
import { menuUiConfigForRestaurant } from "@/lib/menu/menuUiConfig";
import { getPublicMenuDishBySlug } from "@/lib/menu/publicMenuCore";
import {
  normalizePublicMenuLocalePreference,
  publicLocaleToShortLocale
} from "@/lib/menu/publicMenuSettings";
import { resolvePublicMenuExperience } from "@/lib/menu/publicMenuExperienceRoute";
import { resolvePublicMenuUiConfig } from "@/lib/menu/trouvableMenuExperience";
import { getPublishedMenuUiConfigForRestaurant } from "@/lib/owner/menuUiConfigStore";
import { trouvableTypographyClassName } from "../../trouvableTypography";

export const dynamic = "force-dynamic";

type PublicDishPageProps = {
  params: Promise<{ slug: string; dishSlug: string }>;
  searchParams: Promise<{
    lang?: string;
    currency?: string;
    table?: string;
    zone?: string;
    view?: string;
  }>;
};

export async function generateMetadata({
  params,
  searchParams
}: PublicDishPageProps): Promise<Metadata> {
  const { slug, dishSlug } = await params;
  const query = await searchParams;
  const hasLangParam = typeof query.lang === "string" && query.lang.trim().length > 0;
  const menu = await getPublicMenuBySlug(slug, hasLangParam ? query.lang : undefined);
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
  const initialMenu = await getPublicMenuBySlug(
    slug,
    hasLangParam ? query.lang : undefined
  );

  if (!initialMenu) {
    notFound();
  }

  const activePublicLocale = normalizePublicMenuLocalePreference(
    hasLangParam ? query.lang : undefined,
    initialMenu.settings
  );
  const activeLocale = publicLocaleToShortLocale(activePublicLocale);
  const menu = initialMenu;
  const menuQuery = {
    lang: activePublicLocale,
    currency: query.currency,
    table: query.table,
    zone: query.zone,
    view: query.view
  };

  const dish = getPublicMenuDishBySlug(menu, dishSlug);
  if (!dish) {
    notFound();
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
  const experience = resolvePublicMenuExperience(menu, resolvedConfig, {
    allowPendingUniquePreview:
      process.env.NODE_ENV !== "production" &&
      process.env.VISTAIRE_UNIQUE_MENU_PREVIEW === "1"
  });
  const context = [
    query.table ? `Table ${query.table}` : "",
    query.zone ? `Zone ${query.zone}` : ""
  ]
    .filter(Boolean)
    .join(" · ");

  if (experience.kind === "maison-elyse") {
    return (
      <MaisonElyseDishDetail
        dish={dish}
        locale={activeLocale}
        menu={menu}
        query={menuQuery}
        config={resolvedConfig}
      />
    );
  }

  if (experience.kind === "trouvable") {
    const exchangeRates = await getExchangeRates({
      baseCurrency: menu.settings.baseCurrency,
      supportedCurrencies: menu.settings.supportedCurrencies
    });

    return (
      <TrouvableDishDetailExperience
        config={resolvedConfig}
        context={context}
        dish={dish}
        exchangeRates={exchangeRates}
        menu={menu}
        query={{
          ...menuQuery,
          lang: hasLangParam ? activePublicLocale : undefined
        }}
        typographyClassName={trouvableTypographyClassName}
      />
    );
  }

  if (experience.kind === "unique-registered" && experience.renderer) {
    const UniqueDishDetail = experience.renderer.dishDetail;
    return (
      <UniqueDishDetail
        menu={menu}
        config={resolvedConfig}
        context={context}
        query={menuQuery}
        locale={activeLocale}
        dish={dish}
        mode="public"
      />
    );
  }

  return (
    <PublicDishDetailExperience
      config={resolvedConfig}
      context={context}
      dish={dish}
      locale={activeLocale}
      menu={menu}
      query={menuQuery}
    />
  );
}
