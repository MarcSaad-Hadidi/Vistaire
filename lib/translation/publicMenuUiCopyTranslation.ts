import type { PublicMenuSettings } from "../menu/publicMenuSettings.ts";
import { normalizePublicMenuLocale } from "../menu/publicMenuSettings.ts";
import {
  buildTrouvableLocalizedUiCopyPack,
  getTrouvableUiCopyTranslationEntries,
  resolveTrouvableCopy,
  type TrouvableUiCopyTranslationEntry
} from "../../components/menu/trouvableMenuControls.ts";

export type PublicMenuUiCopyTranslationEntry = TrouvableUiCopyTranslationEntry;

export type PublicMenuUiCopyReadiness = {
  isReady: boolean;
  missingKeys: string[];
  ignoredKeys: string[];
  dynamicSource: "exact" | "language" | "legacy-flat" | "none";
  usedNeutralFallback: boolean;
};

export type PublicMenuUiCopyTranslationPlan = {
  entries: PublicMenuUiCopyTranslationEntry[];
  estimatedCharacters: number;
  sourceLocale: string;
  readiness: PublicMenuUiCopyReadiness;
};

function objectInput(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function localeBucketKey(locale: string): string {
  return normalizePublicMenuLocale(locale);
}

function matchingLocaleBucketKey(
  localizedUiCopy: Record<string, unknown>,
  locale: string
): string {
  const normalized = localeBucketKey(locale).toLowerCase();
  return (
    Object.keys(localizedUiCopy).find(
      (key) => localeBucketKey(key).toLowerCase() === normalized
    ) ?? localeBucketKey(locale)
  );
}

export function getPublicMenuUiCopyTranslationEntries(
  settings: Pick<PublicMenuSettings, "defaultLocale" | "publicMenuStyle">
): PublicMenuUiCopyTranslationEntry[] {
  // Trouvable is the shared public menu copy contract used by the premium menu,
  // Google review card, and immersive model viewer. Future styles can branch here
  // with their own complete copy contract when they expose additional UI.
  return getTrouvableUiCopyTranslationEntries(settings.defaultLocale);
}

export function buildPublicMenuLocalizedUiCopyPack(
  entries: PublicMenuUiCopyTranslationEntry[],
  translations: string[]
): Record<string, unknown> {
  return buildTrouvableLocalizedUiCopyPack(entries, translations);
}

export function mergeGeneratedLocalizedUiCopy(
  existingLocalizedUiCopy: Record<string, unknown> | undefined,
  locale: string,
  generatedPack: Record<string, unknown>
): Record<string, unknown> {
  const existing = objectInput(existingLocalizedUiCopy);
  const bucketKey = matchingLocaleBucketKey(existing, locale);
  const existingBucket = objectInput(existing[bucketKey]);
  return {
    ...existing,
    [bucketKey]: {
      ...existingBucket,
      ...generatedPack
    }
  };
}

export function publicMenuUiCopyReadiness(
  _settings: Pick<PublicMenuSettings, "defaultLocale" | "publicMenuStyle">,
  locale: string,
  localizedUiCopy?: Record<string, unknown>
): PublicMenuUiCopyReadiness {
  const { resolution } = resolveTrouvableCopy(
    normalizePublicMenuLocale(locale),
    localizedUiCopy
  );
  return {
    isReady: resolution.uiCopyComplete && !resolution.usedNeutralFallback,
    missingKeys: resolution.missingKeys,
    ignoredKeys: resolution.ignoredKeys,
    dynamicSource: resolution.dynamicSource,
    usedNeutralFallback: resolution.usedNeutralFallback
  };
}

export function estimatePublicMenuUiCopyCharacters(
  settings: Pick<PublicMenuSettings, "defaultLocale" | "publicMenuStyle">,
  locale: string,
  localizedUiCopy?: Record<string, unknown>
): number {
  const readiness = publicMenuUiCopyReadiness(settings, locale, localizedUiCopy);
  if (readiness.isReady) return 0;
  return getPublicMenuUiCopyTranslationEntries(settings).reduce(
    (total, entry) => total + entry.text.length,
    0
  );
}

export function buildPublicMenuUiCopyTranslationPlan(args: {
  settings: Pick<PublicMenuSettings, "defaultLocale" | "publicMenuStyle">;
  locale: string;
  localizedUiCopy?: Record<string, unknown>;
}): PublicMenuUiCopyTranslationPlan {
  const readiness = publicMenuUiCopyReadiness(
    args.settings,
    args.locale,
    args.localizedUiCopy
  );
  if (readiness.isReady) {
    return {
      entries: [],
      estimatedCharacters: 0,
      sourceLocale: args.settings.defaultLocale,
      readiness
    };
  }

  const entries = getPublicMenuUiCopyTranslationEntries(args.settings);
  return {
    entries,
    estimatedCharacters: entries.reduce((total, entry) => total + entry.text.length, 0),
    sourceLocale: args.settings.defaultLocale,
    readiness
  };
}
