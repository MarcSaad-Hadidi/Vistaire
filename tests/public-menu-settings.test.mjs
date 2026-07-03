import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  clearExchangeRatesCacheForTests,
  getExchangeRates
} from "../lib/currency/exchangeRatesCore.ts";
import {
  convertMenuPriceCents,
  formatMenuPrice
} from "../lib/currency/formatMenuPrice.ts";
import { getGreetingForTime } from "../lib/menu/greeting.ts";
import {
  PUBLIC_MENU_CURRENCIES,
  normalizePublicMenuSettings,
  normalizePublicMenuLocalePreference,
  validatePublicMenuSettingsInput
} from "../lib/menu/publicMenuSettings.ts";
import {
  getTrouvableLanguageOptions,
  isTrouvableLocaleSupported
} from "../components/menu/trouvableMenuControls.ts";

test("demo menu preserves French and English supported locales", async () => {
  const source = await readFile(
    new URL("../lib/menu/publicMenu.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /const DEMO_PUBLIC_MENU_SETTINGS/);
  assert.match(source, /supportedLocales:\s*\[\s*"fr-CA",\s*"en-CA"\s*\]/);
  assert.match(source, /settings:\s*DEMO_PUBLIC_MENU_SETTINGS/);
});

test("getPublicMenuBySlug reads the same effective menu_ui_configs settings as owner", async () => {
  const source = await readFile(
    new URL("../lib/menu/publicMenu.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /publicMenuSettingsFallbackFromUiConfigRows/);
  assert.doesNotMatch(source, /publicMenuSettingsFromPublishedUiConfigRows/);
});

test("getPublicMenuBySlug keeps ui_config freshness metadata for menu settings precedence", async () => {
  const source = await readFile(
    new URL("../lib/menu/publicMenu.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /publicMenuSettingsFallbackFromUiConfigRows/);
});

test("normalizes public menu settings with legacy menu languages", () => {
  const settings = normalizePublicMenuSettings({}, { legacyMenuLanguages: ["fr", "en"] });

  assert.deepEqual(settings.supportedLocales, ["fr-CA", "en-CA"]);
  assert.equal(settings.defaultLocale, "fr-CA");
  assert.equal(settings.baseCurrency, "CAD");
  assert.deepEqual(settings.supportedCurrencies, ["CAD"]);
  assert.equal(settings.publicMenuStyle, "trouvable");
});

test("validates default locale and currencies against supported values", () => {
  assert.deepEqual(
    validatePublicMenuSettingsInput({
      supportedLocales: ["fr-CA"],
      defaultLocale: "en-CA"
    }),
    { ok: false, error: "La langue par defaut doit etre activee." }
  );

  assert.deepEqual(
    validatePublicMenuSettingsInput({
      supportedCurrencies: ["CAD"],
      baseCurrency: "USD"
    }),
    { ok: false, error: "La devise de base doit etre activee." }
  );

  assert.deepEqual(
    validatePublicMenuSettingsInput({
      publicMenuStyle: "retro"
    }),
    { ok: false, error: "Style du menu public invalide." }
  );
});

test("normalizes explicit public menu style choices", () => {
  assert.equal(
    normalizePublicMenuSettings({ publicMenuStyle: "maison-elyse" }).publicMenuStyle,
    "maison-elyse"
  );
  assert.equal(
    normalizePublicMenuSettings({ publicMenuStyle: "trouvable" }).publicMenuStyle,
    "trouvable"
  );
});

test("public menu currency picker uses a deterministic SSR-safe catalog", () => {
  assert.deepEqual(PUBLIC_MENU_CURRENCIES, [
    "CAD",
    "USD",
    "EUR",
    "GBP",
    "AUD",
    "JPY",
    "CHF",
    "CNY",
    "MXN",
    "BRL"
  ]);
});

test("accepts valid locale tags and ISO currency codes beyond the default catalog", () => {
  const result = validatePublicMenuSettingsInput({
    supportedLocales: ["fr-CA", "es-MX", "ja-JP"],
    defaultLocale: "ja-JP",
    supportedCurrencies: ["CAD", "JPY", "GBP"],
    baseCurrency: "GBP",
    defaultCurrency: "JPY"
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value.supportedLocales, ["fr-CA", "es-MX", "ja-JP"]);
  assert.deepEqual([...result.value.supportedCurrencies].sort(), ["CAD", "GBP", "JPY"]);
  assert.equal(result.value.baseCurrency, "GBP");
  assert.equal(result.value.defaultCurrency, "JPY");
});

test("resolves short language choices to configured locale tags", () => {
  const settings = normalizePublicMenuSettings({
    supportedLocales: ["fr-FR", "en-US"],
    defaultLocale: "fr-FR"
  });

  assert.equal(normalizePublicMenuLocalePreference("en", settings), "en-US");
  assert.equal(normalizePublicMenuLocalePreference("fr", settings), "fr-FR");
  assert.equal(isTrouvableLocaleSupported("en", settings), true);
  assert.equal(isTrouvableLocaleSupported("fr", settings), true);
  assert.deepEqual(getTrouvableLanguageOptions(settings), [
    { locale: "fr-FR", publicLocale: "fr-FR", label: "Francais (France) (fr-FR)" },
    { locale: "en-US", publicLocale: "en-US", label: "English (United States) (en-US)" }
  ]);
});

test("Trouvable language options keep every configured public locale", () => {
  const settings = normalizePublicMenuSettings({
    supportedLocales: ["fr-CA", "en-CA", "es-ES", "it-IT"],
    defaultLocale: "fr-CA"
  });

  assert.deepEqual(
    getTrouvableLanguageOptions(settings).map((option) => option.locale),
    ["fr-CA", "en-CA", "es-ES", "it-IT"]
  );
  assert.equal(normalizePublicMenuLocalePreference("es-ES", settings), "es-ES");
});

test("converts and formats structured menu prices with explicit rates", () => {
  const converted = convertMenuPriceCents({
    priceCents: 2000,
    sourceCurrency: "CAD",
    targetCurrency: "USD",
    baseCurrency: "CAD",
    rates: { CAD: 1, USD: 0.75, EUR: 0.68 }
  });

  assert.equal(converted, 1500);
  assert.equal(
    formatMenuPrice({
      priceCents: 2000,
      sourceCurrency: "CAD",
      targetCurrency: "USD",
      baseCurrency: "CAD",
      locale: "en",
      rates: { CAD: 1, USD: 0.75, EUR: 0.68 }
    }),
    "US$15"
  );
});

test("greeting follows locale and restaurant timezone", () => {
  const date = new Date("2026-07-01T12:00:00.000Z");

  assert.equal(getGreetingForTime(date, "fr-CA", "America/Toronto"), "Bonjour");
  assert.equal(getGreetingForTime(date, "en-CA", "Europe/Paris"), "Good afternoon");
});

test("exchange rates fetch Frankfurter once per hourly cache window and always include base", async () => {
  clearExchangeRatesCacheForTests();
  let calls = 0;
  const fetcher = async (url) => {
    calls += 1;
    assert.match(String(url), /base=CAD/);
    assert.match(String(url), /quotes=USD%2CEUR|quotes=USD,EUR/);
    return {
      ok: true,
      async json() {
        return { date: "2026-06-30", rates: { USD: 0.73, EUR: 0.68 } };
      }
    };
  };

  const first = await getExchangeRates({
    baseCurrency: "CAD",
    supportedCurrencies: ["CAD", "USD", "EUR"],
    fetcher,
    now: 1_000
  });
  const second = await getExchangeRates({
    baseCurrency: "CAD",
    supportedCurrencies: ["CAD", "USD", "EUR"],
    fetcher,
    now: 2_000
  });

  assert.equal(calls, 1);
  assert.equal(first.provider, "frankfurter");
  assert.equal(second.cached, true);
  assert.deepEqual(first.rates, { CAD: 1, USD: 0.73, EUR: 0.68 });

  const refreshed = await getExchangeRates({
    baseCurrency: "CAD",
    supportedCurrencies: ["CAD", "USD", "EUR"],
    fetcher,
    now: 3_601_000
  });

  assert.equal(calls, 2);
  assert.equal(refreshed.cached, false);
});

test("exchange rates fall back briefly instead of returning zero rates when provider omits quotes", async () => {
  clearExchangeRatesCacheForTests();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return {
      ok: true,
      async json() {
        return { date: "2026-06-30", rates: {} };
      }
    };
  };
  const result = await getExchangeRates({
    baseCurrency: "CAD",
    supportedCurrencies: ["CAD", "USD", "EUR"],
    fetcher,
    now: 10_000
  });
  const cachedFallback = await getExchangeRates({
    baseCurrency: "CAD",
    supportedCurrencies: ["CAD", "USD", "EUR"],
    fetcher,
    now: 20_000
  });
  const retriedFallback = await getExchangeRates({
    baseCurrency: "CAD",
    supportedCurrencies: ["CAD", "USD", "EUR"],
    fetcher,
    now: 920_001
  });

  assert.equal(result.provider, "fallback");
  assert.deepEqual(result.rates, { CAD: 1 });
  assert.equal(cachedFallback.cached, true);
  assert.equal(retriedFallback.cached, false);
  assert.equal(calls, 2);
});

test("exchange rates parse Frankfurter v2 row responses", async () => {
  clearExchangeRatesCacheForTests();
  const result = await getExchangeRates({
    baseCurrency: "CAD",
    supportedCurrencies: ["CAD", "USD", "EUR", "JPY"],
    fetcher: async () => ({
      ok: true,
      async json() {
        return [
          { date: "2026-07-01", base: "CAD", quote: "EUR", rate: 0.61585 },
          { date: "2026-07-01", base: "CAD", quote: "JPY", rate: 114.14 },
          { date: "2026-07-01", base: "CAD", quote: "USD", rate: 0.70278 }
        ];
      }
    }),
    now: 30_000
  });

  assert.equal(result.provider, "frankfurter");
  assert.deepEqual(result.rates, {
    CAD: 1,
    EUR: 0.61585,
    JPY: 114.14,
    USD: 0.70278
  });
  assert.equal(result.updatedAt, "2026-07-01T00:00:00.000Z");
});
