import "server-only";

import { getExchangeRates } from "@/lib/currency/exchangeRates";
import { type Locale } from "@/lib/i18n";
import { type PublicMenuLocale } from "@/lib/menu/publicMenuSettings";
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
  publicLocale: PublicMenuLocale;
  exchangeRates: MenuExchangeRates;
  localizedMenus: Partial<Record<PublicMenuLocale, PublicMenu>>;
  experience: ResolvedPublicMenuExperience;
};

type PublicMenuBaseRenderContext = Omit<
  PublicMenuRenderContext,
  "exchangeRates" | "localizedMenus"
>;

export type PublicDishRenderContext = PublicMenuBaseRenderContext & {
  exchangeRates: MenuExchangeRates | null;
};

async function resolvePublicMenuBaseRenderContext({
  query,
  slug
}: {
  query: PublicMenuRenderQuery;
  slug: string;
}): Promise<PublicMenuBaseRenderContext | null> {
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
  const menu: PublicMenu = {
    ...initialMenu,
    ...(initialMenu.activeLocale
      ? {}
      : { activeLocale: publicLocale }),
    ...(initialMenu.translationStatus || initialMenu.source !== "demo"
      ? {}
      : {
          translationStatus: {
            locale: publicLocale,
            status:
              publicLocale === initialMenu.settings.defaultLocale
                ? "source"
                : "up_to_date"
          }
        })
  };
  const context = [
    query.table ? `Table ${query.table}` : "",
    query.zone ? `Zone ${query.zone}` : ""
  ]
    .filter(Boolean)
    .join(" · ");
  const menuQuery: PublicMenuContextQuery = {
    lang: hasLangParam ? publicLocale : undefined,
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

  return {
    menu,
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
    experience
  };
}

async function resolveLocalizedMenus(
  renderContext: PublicMenuBaseRenderContext,
  slug: string
): Promise<Partial<Record<PublicMenuLocale, PublicMenu>>> {
  if (renderContext.experience.kind !== "maison-elyse") return {};

  const { settings, translationLocales = [] } = renderContext.menu;
  const readyLocales = settings.supportedLocales.filter((candidate) => {
    const status = translationLocales.find((item) => item.locale === candidate)?.status;
    return (
      candidate === settings.defaultLocale ||
      status === "source" ||
      status === "up_to_date"
    );
  });
  const locales = readyLocales.length ? readyLocales : [settings.defaultLocale];
  const resolvedMenus = await Promise.all(
    locales.map(async (candidate) => {
      const resolved =
        candidate === renderContext.publicLocale
          ? renderContext.menu
          : await getPublicMenuBySlug(slug, candidate);
      return resolved ? ([candidate, resolved] as const) : null;
    })
  );

  return Object.fromEntries(
    resolvedMenus.filter(
      (entry): entry is readonly [PublicMenuLocale, PublicMenu] => Boolean(entry)
    )
  );
}

function getRenderContextExchangeRates(
  renderContext: PublicMenuBaseRenderContext
): Promise<MenuExchangeRates> {
  return getExchangeRates({
    baseCurrency: renderContext.menu.settings.baseCurrency,
    supportedCurrencies: renderContext.menu.settings.supportedCurrencies
  });
}

export async function resolvePublicMenuRenderContext({
  query,
  slug
}: {
  query: PublicMenuRenderQuery;
  slug: string;
}): Promise<PublicMenuRenderContext | null> {
  const renderContext = await resolvePublicMenuBaseRenderContext({ query, slug });
  if (!renderContext) return null;

  const [exchangeRates, localizedMenus] = await Promise.all([
    getRenderContextExchangeRates(renderContext),
    resolveLocalizedMenus(renderContext, slug)
  ]);

  return {
    ...renderContext,
    exchangeRates,
    localizedMenus
  };
}

export async function resolvePublicDishRenderContext({
  query,
  slug
}: {
  query: PublicMenuRenderQuery;
  slug: string;
}): Promise<PublicDishRenderContext | null> {
  const renderContext = await resolvePublicMenuBaseRenderContext({ query, slug });
  if (!renderContext) return null;

  const { experience } = renderContext;
  const exchangeRates =
    experience.kind === "trouvable" ||
    experience.kind === "unique-registered"
      ? await getRenderContextExchangeRates(renderContext)
      : null;

  return {
    ...renderContext,
    exchangeRates
  };
}
