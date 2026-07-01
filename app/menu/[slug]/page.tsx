import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MaisonElyseQrMenu } from "@/components/menu/MaisonElyseQrMenu";
import { PublicMenuRenderer } from "@/components/menu/PublicMenuRenderer";
import { TrouvablePremiumMenuExperience } from "@/components/menu/TrouvablePremiumMenuExperience";
import { getExchangeRates } from "@/lib/currency/exchangeRates";
import { normalizeLocale } from "@/lib/i18n";
import { getPublicMenuBySlug } from "@/lib/menu/publicMenu";
import {
  normalizePublicMenuLocalePreference,
  publicLocaleToShortLocale
} from "@/lib/menu/publicMenuSettings";
import { menuUiConfigForRestaurant } from "@/lib/menu/menuUiConfig";
import {
  isMaisonElysePublicMenu,
  isTrouvablePublicMenu,
  resolvePublicMenuUiConfig
} from "@/lib/menu/trouvableMenuExperience";
import { getPublishedMenuUiConfigForRestaurant } from "@/lib/owner/menuUiConfigStore";
import { trouvableTypographyClassName } from "./trouvableTypography";

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
  const initialMenu = await getPublicMenuBySlug(slug, locale);

  if (!initialMenu) {
    notFound();
  }

  const activePublicLocale = normalizePublicMenuLocalePreference(
    hasLangParam ? query.lang : undefined,
    initialMenu.settings
  );
  const activeLocale = publicLocaleToShortLocale(activePublicLocale);
  const menu =
    activeLocale === locale
      ? initialMenu
      : (await getPublicMenuBySlug(slug, activeLocale)) ?? initialMenu;
  const menuQuery = {
    lang: activeLocale,
    table: query.table,
    zone: query.zone,
    view: query.view
  };

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
  const resolvedConfig = resolvePublicMenuUiConfig(menu, configRecord.config);
  const exchangeRates = await getExchangeRates({
    baseCurrency: menu.settings.baseCurrency,
    supportedCurrencies: menu.settings.supportedCurrencies
  });

  if (isMaisonElysePublicMenu(menu)) {
    const [frenchMenu, englishMenu] = await Promise.all([
      activeLocale === "fr" ? Promise.resolve(menu) : getPublicMenuBySlug(slug, "fr"),
      activeLocale === "en" ? Promise.resolve(menu) : getPublicMenuBySlug(slug, "en")
    ]);

    return (
      <MaisonElyseQrMenu
        menu={menu}
        locale={activeLocale}
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

  if (isTrouvablePublicMenu(menu)) {
    return (
      <TrouvablePremiumMenuExperience
        menu={menu}
        config={resolvedConfig}
        context={context}
        exchangeRates={exchangeRates}
        query={menuQuery}
        typographyClassName={trouvableTypographyClassName}
      />
    );
  }

  return (
    <PublicMenuRenderer
      menu={menu}
      config={resolvedConfig}
      context={context}
      query={menuQuery}
      mode="public"
      disableHeavyAssets={false}
    />
  );
}
