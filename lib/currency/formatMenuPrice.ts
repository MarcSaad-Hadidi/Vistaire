import {
  LOCALE_LANGUAGE_TAG,
  normalizeLocale,
  type Locale
} from "../i18n.ts";
import {
  normalizePublicMenuCurrency,
  type PublicMenuCurrency,
  type PublicMenuPriceDisplayMode
} from "../menu/publicMenuSettings.ts";

export type MenuExchangeRates = {
  base: PublicMenuCurrency;
  rates: Partial<Record<PublicMenuCurrency, number>>;
  provider?: string;
  updatedAt?: string;
  cached?: boolean;
};

export type MenuPriceInput = {
  priceCents: number;
  sourceCurrency: PublicMenuCurrency | string;
  targetCurrency: PublicMenuCurrency | string;
  locale: Locale | string;
  rates?: Partial<Record<PublicMenuCurrency, number>>;
  baseCurrency?: PublicMenuCurrency | string;
  displayPriceMode?: PublicMenuPriceDisplayMode;
  fallbackLabel?: string;
};

export function convertMenuPriceCents(args: {
  priceCents: number;
  sourceCurrency: PublicMenuCurrency | string;
  targetCurrency: PublicMenuCurrency | string;
  baseCurrency?: PublicMenuCurrency | string;
  rates?: Partial<Record<PublicMenuCurrency, number>>;
}): number | null {
  if (!Number.isFinite(args.priceCents) || args.priceCents <= 0) return null;
  const sourceCurrency = normalizePublicMenuCurrency(args.sourceCurrency);
  const targetCurrency = normalizePublicMenuCurrency(args.targetCurrency);
  const baseCurrency = normalizePublicMenuCurrency(args.baseCurrency, sourceCurrency);
  if (sourceCurrency === targetCurrency) return Math.round(args.priceCents);

  const rates = args.rates ?? {};
  const sourceRate = sourceCurrency === baseCurrency ? 1 : Number(rates[sourceCurrency]);
  const targetRate = targetCurrency === baseCurrency ? 1 : Number(rates[targetCurrency]);
  if (!Number.isFinite(sourceRate) || sourceRate <= 0) return null;
  if (!Number.isFinite(targetRate) || targetRate <= 0) return null;

  return Math.round((args.priceCents / sourceRate) * targetRate);
}

export function formatMenuPriceCents(args: {
  priceCents: number;
  currency: PublicMenuCurrency | string;
  locale: Locale | string;
  displayPriceMode?: PublicMenuPriceDisplayMode;
}): string {
  const cents = Math.round(args.priceCents);
  const mode = args.displayPriceMode ?? "auto";
  const showDecimals =
    mode === "decimal" || (mode === "auto" && Math.abs(cents) % 100 !== 0);
  const locale = normalizeLocale(args.locale);
  return new Intl.NumberFormat(LOCALE_LANGUAGE_TAG[locale], {
    style: "currency",
    currency: normalizePublicMenuCurrency(args.currency),
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0
  }).format(cents / 100);
}

export function formatMenuPrice(args: MenuPriceInput): string {
  const targetCurrency = normalizePublicMenuCurrency(args.targetCurrency);
  const converted = convertMenuPriceCents(args);
  if (converted === null) return args.fallbackLabel ?? "";
  return formatMenuPriceCents({
    priceCents: converted,
    currency: targetCurrency,
    locale: args.locale,
    displayPriceMode: args.displayPriceMode
  });
}
