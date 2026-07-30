import "server-only";

import { getExchangeRates } from "@/lib/currency/exchangeRates";
import type { Locale } from "@/lib/i18n";
import { menuUiConfigForRestaurant, type MenuUiConfig } from "@/lib/menu/menuUiConfig";
import { getPublicMenuBySlug } from "@/lib/menu/publicMenu";
import {
  type PublicMenu,
  type PublicMenuContextQuery
} from "@/lib/menu/publicMenuCore";
import {
  resolvePublicMenuExperience,
  type ResolvedPublicMenuExperience
} from "@/lib/menu/publicMenuExperienceRoute";
import {
  normalizePublicMenuLocalePreference,
  publicLocaleToShortLocale
} from "@/lib/menu/publicMenuSettings";
import { resolvePublicMenuUiConfig } from "@/lib/menu/trouvableMenuExperience";
import { getPublishedMenuUiConfigForRestaurant } from "@/lib/owner/menuUiConfigStore";
import type { MenuExchangeRates } from "@/lib/currency/formatMenuPrice";

export type PublicMenuRenderQuery = {
  lang?: string;
  currency?: string;
  table?: string;
  view?: string;
  zone?: string;
};

export type PublicMenuRenderContext = {
  menu: PublicMenu;
  config: MenuUiConfig;
  context: string;
  query: PublicMenuContextQuery;
  locale: Locale;
  publicLocale: string;
  exchangeRates: MenuExchangeRates;
  localizedMenus: Partial<Record<Locale, PublicMenu>>;
  experience: ResolvedPublicMenuExperience;
};

export async function resolvePublicMenuRenderContext({
  query,
  slug
}: {
  query: PublicMenuRenderQuery;
  slug: string;
}): Promise<PublicMenuRenderContext | null> {
  const hasLangParam =
    typeof query.lang === "string" && query.lang.trim().length > 0;
  const initialMenu = await getPublicMenuBySlug(
    slug,
    hasLangParam ? query.lang : undefined
  );
  if (!initialMenu) return null;

  const publicLocale = normalizePublicMenuLocalePreference(
    hasLangParam ? query.lang : undefined,
    initialMenu.settings
  );
  const locale = publicLocaleToShortLocale(publicLocale);
  const context = [
    query.table ? `Table ${query.table}` : "",
    query.zone ? `Zone ${query.zone}` : ""
  ]
    .filter(Boolean)
    .join(" · ");
  const menuQuery: PublicMenuContextQuery = {
    lang: publicLocale,
    currency: query.currency,
    table: query.table,
    zone: query.zone,
    view: query.view
  };
  const fallbackConfig = menuUiConfigForRestaurant({
    name: initialMenu.name,
    slug: initialMenu.slug
  });
  const configRecord = await getPublishedMenuUiConfigForRestaurant(
    initialMenu.restaurantId,
    fallbackConfig
  );
  const config = resolvePublicMenuUiConfig(initialMenu, configRecord.config);
  const experience = resolvePublicMenuExperience(initialMenu, config, {
    allowPendingUniquePreview:
      process.env.NODE_ENV !== "production" &&
      process.env.VISTAIRE_UNIQUE_MENU_PREVIEW === "1"
  });
  const exchangeRates = await getExchangeRates({
    baseCurrency: initialMenu.settings.baseCurrency,
    supportedCurrencies: initialMenu.settings.supportedCurrencies
  });
  let localizedMenus: Partial<Record<Locale, PublicMenu>> = {};

  if (experience.kind === "maison-elyse") {
    const [frenchMenu, englishMenu] = await Promise.all([
      locale === "fr"
        ? Promise.resolve(initialMenu)
        : getPublicMenuBySlug(slug, "fr"),
      locale === "en"
        ? Promise.resolve(initialMenu)
        : getPublicMenuBySlug(slug, "en")
    ]);
    localizedMenus = {
      ...(frenchMenu ? { fr: frenchMenu } : {}),
      ...(englishMenu ? { en: englishMenu } : {})
    };
  }

  return {
    menu: initialMenu,
    config,
    context,
    query: {
      ...menuQuery,
      ...(experience.kind === "trouvable" && !hasLangParam
        ? { lang: undefined }
        : {})
    },
    locale,
    publicLocale,
    exchangeRates,
    localizedMenus,
    experience
  };
}
