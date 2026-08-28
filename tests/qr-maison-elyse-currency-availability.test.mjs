import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { isCurrencyConversionAvailable } from "../lib/currency/formatMenuPrice.ts";

function canConvert(targetCurrency, rates) {
  return isCurrencyConversionAvailable({
    sourceCurrency: "CAD",
    targetCurrency,
    baseCurrency: "CAD",
    rates
  });
}

test("Maison currency exposes CAD USD EUR only when real rates are usable", () => {
  const validRates = { CAD: 1, USD: 0.73, EUR: 0.64 };

  assert.equal(canConvert("CAD", validRates), true);
  assert.equal(canConvert("USD", validRates), true);
  assert.equal(canConvert("EUR", validRates), true);
});

test("Maison currency fallback provider keeps only conversions that are truthful", () => {
  const providerFallback = { CAD: 1 };

  assert.equal(canConvert("CAD", providerFallback), true);
  assert.equal(canConvert("USD", providerFallback), false);
  assert.equal(canConvert("EUR", providerFallback), false);
  assert.equal(canConvert("USD", { CAD: 1, USD: 0 }), false);
  assert.equal(canConvert("EUR", { CAD: 1, EUR: Number.NaN }), false);
  assert.equal(canConvert("USD", { CAD: 1 }), false);
  assert.equal(canConvert("EUR", { CAD: 1 }), false);
});

test("same-currency display stays valid without an FX quote while cross-currency does not", () => {
  assert.equal(
    isCurrencyConversionAvailable({
      sourceCurrency: "USD",
      targetCurrency: "USD",
      baseCurrency: "CAD",
      rates: {}
    }),
    true
  );
  assert.equal(
    isCurrencyConversionAvailable({
      sourceCurrency: "USD",
      targetCurrency: "CAD",
      baseCurrency: "CAD",
      rates: { CAD: 1, USD: 0.73 }
    }),
    true
  );
  assert.equal(
    isCurrencyConversionAvailable({
      sourceCurrency: "USD",
      targetCurrency: "CAD",
      baseCurrency: "CAD",
      rates: { CAD: 1 }
    }),
    false
  );
});

test("Maison menu and direct dish detail consume the shared availability contract", async () => {
  const [menuSource, detailSource] = await Promise.all([
    readFile("components/menu/MaisonElyseQrMenu.tsx", "utf8"),
    readFile("components/menu/MaisonElyseDishDetail.tsx", "utf8")
  ]);

  assert.match(menuSource, /isCurrencyConversionAvailable/);
  assert.match(menuSource, /availableCurrencyOptions/);
  assert.match(menuSource, /availableCurrencyOptions\.map\(\(option\)/);
  assert.doesNotMatch(menuSource, /Boolean\(exchangeRates\)/);
  assert.match(detailSource, /resolveAvailableDishCurrency/);
  assert.match(detailSource, /isCurrencyConversionAvailable/);
  assert.match(detailSource, /TROUVABLE_CURRENCY_STORAGE_KEY/);
});
