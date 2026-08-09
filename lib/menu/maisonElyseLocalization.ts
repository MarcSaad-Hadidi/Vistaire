import {
  getTrouvableCopy,
  getTrouvableLanguagePresentation,
  getTrouvableLanguageShortCode,
  resolveTrouvableCopy
} from "@/components/menu/trouvableMenuControls";
import {
  normalizePublicMenuLocale,
  type PublicMenuSettings,
  type PublicMenuLocale
} from "@/lib/menu/publicMenuSettings";
import type {
  PublicMenu,
  PublicMenuTranslationStatus
} from "@/lib/menu/publicMenuCore";

/** The public-menu locale registry is intentionally independent from marketing locales. */
export type MaisonElyseLocale = PublicMenuLocale;

export type MaisonElyseCategoryKind =
  | "starter"
  | "signature"
  | "dessert"
  | "cocktail"
  | "drink";

const MAISON_ELYSE_CATEGORY_ALIASES: Record<
  MaisonElyseCategoryKind,
  ReadonlySet<string>
> = {
  starter: new Set(["entree", "entrees", "inputs", "starter", "starters"]),
  signature: new Set([
    "plat",
    "plats",
    "plat signature",
    "plats signatures",
    "signature dish",
    "signature dishes",
    "main",
    "mains",
    "main course",
    "main courses"
  ]),
  dessert: new Set(["dessert", "desserts"]),
  cocktail: new Set(["cocktail", "cocktails", "cocktails signatures"]),
  drink: new Set(["boisson", "boissons", "drink", "drinks"])
};

function normalizeMaisonElyseCategory(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function getMaisonElyseCategoryKind(
  label: string
): MaisonElyseCategoryKind | null {
  const normalized = normalizeMaisonElyseCategory(label);
  return (
    (Object.entries(MAISON_ELYSE_CATEGORY_ALIASES).find(([, aliases]) =>
      aliases.has(normalized)
    )?.[0] as MaisonElyseCategoryKind | undefined) ?? null
  );
}

export function getMaisonElyseCategoryLabel(
  label: string,
  locale: PublicMenuLocale
): string {
  const language = normalizeMaisonElyseLocale(locale).startsWith("en")
    ? "en"
    : "fr";
  switch (getMaisonElyseCategoryKind(label)) {
    case "starter":
      return language === "en" ? "Starters" : "Entrées";
    case "signature":
      return language === "en" ? "Signature dishes" : "Plats signatures";
    case "dessert":
      return "Desserts";
    case "cocktail":
      return "Cocktails";
    case "drink":
      return language === "en" ? "Drinks" : "Boissons";
    default:
      return label;
  }
}

export function normalizeMaisonElyseLocale(value: unknown, fallback = "fr-CA") {
  return normalizePublicMenuLocale(value, fallback);
}

export function getMaisonElyseLanguagePresentation(locale: string) {
  return {
    ...getTrouvableLanguagePresentation(locale),
    shortCode: getTrouvableLanguageShortCode(locale)
  };
}

export type MaisonElyseLanguageOption = {
  id: PublicMenuLocale;
  label: string;
  shortLabel: string;
};

type MaisonElyseLocalizedMenuInput = {
  fallbackLocale: PublicMenuLocale;
  fallbackMenu: PublicMenu;
  localizedMenus?: Partial<Record<PublicMenuLocale, PublicMenu>>;
  requestedLocale: unknown;
};

export type MaisonElyseLocalizedMenuResolution = {
  locale: PublicMenuLocale;
  menu: PublicMenu;
};

function canonicalMenuLocale(
  menu: PublicMenu,
  fallbackLocale?: PublicMenuLocale
): PublicMenuLocale | null {
  if (!menu.activeLocale && !fallbackLocale) return null;
  return normalizeMaisonElyseLocale(menu.activeLocale ?? fallbackLocale);
}

/** Keep the locale used for UI copy paired with a menu resolved for that locale. */
export function resolveMaisonElyseLocalizedMenu({
  fallbackLocale,
  fallbackMenu,
  localizedMenus = {},
  requestedLocale
}: MaisonElyseLocalizedMenuInput): MaisonElyseLocalizedMenuResolution {
  const requested = normalizeMaisonElyseLocale(requestedLocale, fallbackLocale);
  const requestedMenu = Object.entries(localizedMenus).find(
    ([locale, menu]) =>
      Boolean(menu) &&
      normalizeMaisonElyseLocale(locale, fallbackLocale) === requested &&
      canonicalMenuLocale(menu as PublicMenu) === requested
  )?.[1];

  if (requestedMenu) {
    return { locale: requested, menu: requestedMenu };
  }

  const fallbackActiveLocale = canonicalMenuLocale(fallbackMenu, fallbackLocale);
  if (fallbackActiveLocale) {
    return { locale: fallbackActiveLocale, menu: fallbackMenu };
  }

  return {
    locale: normalizeMaisonElyseLocale(fallbackLocale),
    menu: fallbackMenu
  };
}

/** Return only configured locales whose complete translation is public-ready. */
export function getMaisonElyseLanguageOptions(
  settings: Pick<PublicMenuSettings, "defaultLocale" | "supportedLocales">,
  translationLocales: PublicMenuTranslationStatus[] = []
): MaisonElyseLanguageOption[] {
  const statuses = new Map(
    translationLocales.map((status) => [status.locale, status.status])
  );
  const readyLocales = settings.supportedLocales.filter((candidate) => {
    const status = statuses.get(candidate);
    return (
      candidate === settings.defaultLocale ||
      status === "source" ||
      status === "up_to_date"
    );
  });
  const locales = readyLocales.length ? readyLocales : [settings.defaultLocale];

  return locales.map((candidate) => {
    const presentation = getMaisonElyseLanguagePresentation(candidate);
    return {
      id: candidate,
      label: presentation.nativeName || candidate,
      shortLabel: presentation.shortCode
    };
  });
}

export function getMaisonElyseTextDirection(locale: string): "ltr" | "rtl" {
  const normalized = normalizeMaisonElyseLocale(locale);
  try {
    return new Intl.Locale(normalized).language.toLowerCase() === "ar"
      ? "rtl"
      : "ltr";
  } catch {
    return normalized.toLowerCase().startsWith("ar") ? "rtl" : "ltr";
  }
}

/**
 * Maison Élyse uses the shared public UI-copy contract. Exact and base-language
 * persisted buckets, then the verified built-in pack, are resolved by the
 * central resolver; callers can expose its diagnostics for QA.
 */
export function resolveMaisonElyseCopy(
  locale: string,
  localizedUiCopy?: Record<string, unknown>
) {
  return resolveTrouvableCopy(
    normalizeMaisonElyseLocale(locale),
    localizedUiCopy
  );
}

export type MaisonElyseCopy = ReturnType<typeof getTrouvableCopy>;
