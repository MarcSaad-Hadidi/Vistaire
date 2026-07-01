import {
  DEFAULT_PUBLIC_MENU_SETTINGS,
  normalizePublicMenuCurrency,
  type PublicMenuCurrency
} from "../menu/publicMenuSettings.ts";

export type ExchangeRateProvider = "frankfurter" | "fallback";

export type ExchangeRatesResult = {
  ok: true;
  base: PublicMenuCurrency;
  rates: Partial<Record<PublicMenuCurrency, number>>;
  provider: ExchangeRateProvider;
  updatedAt: string;
  cached: boolean;
};

const PROVIDER_REFRESH_TTL_MS = 60 * 60 * 1000;
const FALLBACK_RETRY_TTL_MS = 15 * 60 * 1000;
const FRANKFURTER_ENDPOINT = "https://api.frankfurter.dev/v2/rates";

type CacheEntry = ExchangeRatesResult & {
  expiresAt: number;
};

type FrankfurterRateRow = {
  base?: unknown;
  date?: unknown;
  quote?: unknown;
  rate?: unknown;
};

type FrankfurterRatesPayload =
  | {
      rates?: Record<string, unknown>;
      date?: unknown;
    }
  | FrankfurterRateRow[];

const memoryCache = new Map<string, CacheEntry>();

function cacheKey(base: PublicMenuCurrency, quotes: PublicMenuCurrency[]): string {
  return `${base}:${quotes.join(",")}`;
}

function normalizeQuotes(
  base: PublicMenuCurrency,
  quotes: readonly PublicMenuCurrency[]
): PublicMenuCurrency[] {
  const seen = new Set<PublicMenuCurrency>([base]);
  const normalized: PublicMenuCurrency[] = [];
  for (const quote of quotes) {
    const currency = normalizePublicMenuCurrency(quote, base);
    if (seen.has(currency)) continue;
    seen.add(currency);
    normalized.push(currency);
  }
  return normalized;
}

function fallbackRates(base: PublicMenuCurrency): ExchangeRatesResult {
  return {
    ok: true,
    base,
    rates: {
      [base]: 1
    },
    provider: "fallback",
    updatedAt: new Date().toISOString(),
    cached: false
  };
}

function resultWithCacheFlag(
  result: ExchangeRatesResult,
  cached: boolean
): ExchangeRatesResult {
  return { ...result, cached };
}

function parseFrankfurterRates(
  payload: FrankfurterRatesPayload,
  quotes: readonly PublicMenuCurrency[]
): {
  date?: string;
  rates: Partial<Record<PublicMenuCurrency, number>>;
} {
  const rates = {} as Partial<Record<PublicMenuCurrency, number>>;
  let date: string | undefined;

  if (Array.isArray(payload)) {
    for (const row of payload) {
      const quote =
        typeof row.quote === "string"
          ? normalizePublicMenuCurrency(row.quote, "" as PublicMenuCurrency)
          : "";
      if (!quotes.includes(quote)) continue;
      const value = Number(row.rate);
      if (Number.isFinite(value) && value > 0) rates[quote] = value;
      if (!date && typeof row.date === "string") date = row.date;
    }
    return { date, rates };
  }

  date = typeof payload.date === "string" ? payload.date : undefined;
  for (const quote of quotes) {
    const value = Number(payload.rates?.[quote]);
    if (Number.isFinite(value) && value > 0) rates[quote] = value;
  }
  return { date, rates };
}

export function clearExchangeRatesCacheForTests() {
  memoryCache.clear();
}

export async function getExchangeRates(args: {
  baseCurrency?: PublicMenuCurrency | string;
  supportedCurrencies?: readonly (PublicMenuCurrency | string)[];
  fetcher?: typeof fetch;
  now?: number;
} = {}): Promise<ExchangeRatesResult> {
  const base = normalizePublicMenuCurrency(
    args.baseCurrency,
    DEFAULT_PUBLIC_MENU_SETTINGS.baseCurrency
  );
  const supported = (
    args.supportedCurrencies ?? DEFAULT_PUBLIC_MENU_SETTINGS.supportedCurrencies
  ).map((currency) => normalizePublicMenuCurrency(currency, base));
  const quotes = normalizeQuotes(base, supported);
  const key = cacheKey(base, quotes);
  const now = args.now ?? Date.now();
  const cached = memoryCache.get(key);
  if (cached && cached.expiresAt > now) {
    return resultWithCacheFlag(cached, true);
  }

  if (quotes.length === 0) {
    const result = fallbackRates(base);
    memoryCache.set(key, { ...result, expiresAt: now + PROVIDER_REFRESH_TTL_MS });
    return result;
  }

  const url = new URL(FRANKFURTER_ENDPOINT);
  url.searchParams.set("base", base);
  url.searchParams.set("quotes", quotes.join(","));

  try {
    const response = await (args.fetcher ?? fetch)(url.toString(), {
      next: { revalidate: PROVIDER_REFRESH_TTL_MS / 1000 }
    } as RequestInit);
    if (!response.ok) throw new Error(`Frankfurter ${response.status}`);
    const payload = (await response.json()) as FrankfurterRatesPayload;
    const parsed = parseFrankfurterRates(payload, quotes);
    const rates = {
      [base]: 1
    } as Partial<Record<PublicMenuCurrency, number>>;
    for (const quote of quotes) {
      const value = Number(parsed.rates[quote]);
      if (Number.isFinite(value) && value > 0) rates[quote] = value;
    }
    if (quotes.some((quote) => rates[quote] === undefined)) {
      throw new Error("Frankfurter response missing requested rates");
    }
    const result: ExchangeRatesResult = {
      ok: true,
      base,
      rates,
      provider: "frankfurter",
      updatedAt: parsed.date
        ? new Date(`${parsed.date}T00:00:00.000Z`).toISOString()
        : new Date().toISOString(),
      cached: false
    };
    memoryCache.set(key, { ...result, expiresAt: now + PROVIDER_REFRESH_TTL_MS });
    return result;
  } catch {
    const result = fallbackRates(base);
    memoryCache.set(key, { ...result, expiresAt: now + FALLBACK_RETRY_TTL_MS });
    return result;
  }
}
