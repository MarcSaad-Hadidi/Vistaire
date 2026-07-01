import { NextResponse } from "next/server";
import { getExchangeRates } from "@/lib/currency/exchangeRates";
import {
  normalizePublicMenuCurrency,
  type PublicMenuCurrency
} from "@/lib/menu/publicMenuSettings";

export const dynamic = "force-dynamic";

function parseQuotes(value: string | null, base: PublicMenuCurrency): PublicMenuCurrency[] {
  const rawValues = (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const seen = new Set<PublicMenuCurrency>();
  const quotes: PublicMenuCurrency[] = [];

  for (const rawValue of rawValues) {
    const currency = normalizePublicMenuCurrency(rawValue, base);
    if (seen.has(currency)) continue;
    seen.add(currency);
    quotes.push(currency);
  }

  return quotes.length > 0 ? quotes : [base];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = normalizePublicMenuCurrency(url.searchParams.get("base"));
  const supportedCurrencies = parseQuotes(url.searchParams.get("quotes"), base);
  const result = await getExchangeRates({
    baseCurrency: base,
    supportedCurrencies
  });

  return NextResponse.json(
    {
      ok: true,
      base: result.base,
      rates: result.rates,
      provider: result.provider,
      updatedAt: result.updatedAt,
      cached: result.cached
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600"
      }
    }
  );
}
