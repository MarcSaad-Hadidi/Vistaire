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
import type { PublicMenuTranslationStatus } from "@/lib/menu/publicMenuCore";

/** The public-menu locale registry is intentionally independent from marketing locales. */
export type MaisonElyseLocale = PublicMenuLocale;

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
