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
import { resolveStablePublicMenuUiConfigReadiness } from "@/lib/menu/publicMenuStableUiConfig";
import {
  normalizePublicMenuLocale,
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

export type PublicMenuStableRenderContext = PublicMenuBaseRenderContext & {
  localizedMenus: Partial<Record<PublicMenuLocale, PublicMenu>>;
  stableCacheReadiness: {
    // Compatibility name: this is true when the effective public UI config is
    // stable for landing-cache rendering, including code-owned built-in fallbacks.
    publishedUiConfig: boolean;
    localizedMenusComplete: boolean;
  };
};

export type PublicDishRenderContext = PublicMenuBaseRenderContext & {
  exchangeRates: MenuExchangeRates | null;
};

async function resolvePublicMenuBaseRenderContext({
  query,
  slug
}: {
  query: PublicMenuRenderQuery;
  slug: string;
}): Promise<{
  renderContext: PublicMenuBaseRenderContext;
  publishedUiConfig: boolean;
} | null> {
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
  const stablePublicUiConfig = resolveStablePublicMenuUiConfigReadiness({
    configRecord,
    experienceKind: experience.kind
  });

  return {
    publishedUiConfig: stablePublicUiConfig.ready,
    renderContext: {
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
    },
  };
}

export function arePublicMenuTranslationsReadyForStableCache(
  menu: Pick<PublicMenu, "settings" | "translationLocales">
): boolean {
  const statuses = menu.translationLocales ?? [];
  if (!statuses.length) return false;

  const configuredLocales = new Set([
    ...menu.settings.supportedLocales,
    ...statuses.map((status) => status.locale)
  ]);
  const isReady = (locale: string, status: string) =>
    locale === menu.settings.defaultLocale
      ? status === "source" || status === "up_to_date"
      : status === "up_to_date";

  return (
    statuses.every((status) => isReady(status.locale, status.status)) &&
    [...configuredLocales].every((locale) =>
      statuses.some(
        (status) => status.locale === locale && isReady(locale, status.status)
      )
    )
  );
}

async function resolveLocalizedMenus(
  renderContext: PublicMenuBaseRenderContext,
  slug: string
): Promise<{
  localizedMenus: Partial<Record<PublicMenuLocale, PublicMenu>>;
  complete: boolean;
}> {
  if (renderContext.experience.kind !== "maison-elyse") {
    return { localizedMenus: {}, complete: true };
  }

  const { settings, translationLocales = [] } = renderContext.menu;
  const translationProvenanceComplete =
    arePublicMenuTranslationsReadyForStableCache(renderContext.menu);
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
      if (!resolved?.activeLocale) {
        return { cacheReady: false, entry: null };
      }

      const candidateLocale = normalizePublicMenuLocale(candidate);
      const resolvedLocale = normalizePublicMenuLocale(
        resolved.activeLocale,
        resolved.settings.defaultLocale
      );
      const entry =
        resolvedLocale === candidateLocale
          ? ([candidateLocale, resolved] as const)
          : null;
      const status = resolved.translationStatus?.status;
      const translationReady =
        candidateLocale === settings.defaultLocale
          ? status === "source" || status === "up_to_date"
          : status === "up_to_date";
      const sameIdentity =
        resolved.slug === renderContext.menu.slug &&
        resolved.restaurantId === renderContext.menu.restaurantId &&
        (!renderContext.menu.menuId ||
          resolved.menuId === renderContext.menu.menuId);
      return {
        cacheReady:
          Boolean(entry) &&
          resolved.source === "supabase" &&
          sameIdentity &&
          translationReady,
        entry
      };
    })
  );

  const entries = resolvedMenus.filter(
    (
      result
    ): result is {
      cacheReady: boolean;
      entry: readonly [PublicMenuLocale, PublicMenu];
    } => Boolean(result.entry)
  );
  return {
    localizedMenus: Object.fromEntries(entries.map((result) => result.entry)),
    complete:
      translationProvenanceComplete &&
      resolvedMenus.length === locales.length &&
      resolvedMenus.every((result) => result.cacheReady)
  };
}

export function resolvePublicMenuExchangeRates(
  menu: Pick<PublicMenu, "settings">
): Promise<MenuExchangeRates> {
  return getExchangeRates({
    baseCurrency: menu.settings.baseCurrency,
    supportedCurrencies: menu.settings.supportedCurrencies
  });
}

export async function resolvePublicMenuStableRenderContext({
  query,
  slug
}: {
  query: PublicMenuRenderQuery;
  slug: string;
}): Promise<PublicMenuStableRenderContext | null> {
  const base = await resolvePublicMenuBaseRenderContext({ query, slug });
  if (!base) return null;
  const { renderContext } = base;
  const localized = await resolveLocalizedMenus(renderContext, slug);

  return {
    ...renderContext,
    localizedMenus: localized.localizedMenus,
    stableCacheReadiness: {
      publishedUiConfig: base.publishedUiConfig,
      localizedMenusComplete: localized.complete
    }
  };
}

export async function resolvePublicMenuRenderContext({
  query,
  slug
}: {
  query: PublicMenuRenderQuery;
  slug: string;
}): Promise<PublicMenuRenderContext | null> {
  const base = await resolvePublicMenuBaseRenderContext({ query, slug });
  if (!base) return null;
  const { renderContext } = base;

  const [exchangeRates, localized] = await Promise.all([
    resolvePublicMenuExchangeRates(renderContext.menu),
    resolveLocalizedMenus(renderContext, slug)
  ]);

  return {
    ...renderContext,
    exchangeRates,
    localizedMenus: localized.localizedMenus
  };
}

export async function resolvePublicDishRenderContext({
  query,
  slug
}: {
  query: PublicMenuRenderQuery;
  slug: string;
}): Promise<PublicDishRenderContext | null> {
  const base = await resolvePublicMenuBaseRenderContext({ query, slug });
  if (!base) return null;
  const { renderContext } = base;

  const { experience } = renderContext;
  const exchangeRates =
    experience.kind === "trouvable" ||
    experience.kind === "unique-registered"
      ? await resolvePublicMenuExchangeRates(renderContext.menu)
      : null;

  return {
    ...renderContext,
    exchangeRates
  };
}
