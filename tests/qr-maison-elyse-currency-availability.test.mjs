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
  assert.match(detailSource, /explicitCurrency \?\? storedCurrency \?\? undefined/);
});

test("Maison phone-preview dish loaders stay localized for all supported languages", async () => {
  const menuSource = await readFile("components/menu/MaisonElyseQrMenu.tsx", "utf8");

  for (const loadingText of [
    "Chargement de la fiche...",
    "Loading dish details...",
    "Cargando los detalles del plato...",
    "Caricamento dei dettagli del piatto...",
    "Gerichtdetails werden geladen...",
    "Φόρτωση λεπτομερειών πιάτου...",
    "جارٍ تحميل تفاصيل الطبق..."
  ]) {
    assert.ok(menuSource.includes(loadingText), `missing loader: ${loadingText}`);
  }
  assert.match(menuSource, /role="status" aria-live="polite"/);
  assert.doesNotMatch(menuSource, /loading:\s*\(\)\s*=>\s*null/);
});

test("Maison preserves historical FR EN detail copy while non-FR EN copy stays localized", async () => {
  const [detailSource, localizationSource] = await Promise.all([
    readFile("components/menu/MaisonElyseDishDetail.tsx", "utf8"),
    readFile("lib/menu/maisonElyseLocalization.ts", "utf8")
  ]);

  for (const historicalCopy of [
    "Image du plat ${dishName}",
    "Note du chef",
    "Voir en 3D",
    "Voir le plat en 3D",
    "Navigation fiche plat",
    "Dish image: ${dishName}",
    "Chef's note",
    "View in 3D",
    "View the dish in 3D",
    "Dish navigation"
  ]) {
    assert.ok(detailSource.includes(historicalCopy), `missing historical copy: ${historicalCopy}`);
  }
  for (const localizedBackToMenu of [
    "Volver a la carta",
    "Torna alla carta",
    "Zurück zur Speisekarte",
    "Επιστροφή στο μενού",
    "العودة إلى القائمة"
  ]) {
    assert.ok(
      localizationSource.includes(localizedBackToMenu),
      `missing localized detail navigation: ${localizedBackToMenu}`
    );
  }
});

test("Maison Arabic shared content is RTL without mirroring Maison or Google Review layout", async () => {
  const [menuSource, detailSource, allergenSource, googleReviewSource] = await Promise.all([
    readFile("components/menu/MaisonElyseQrMenu.tsx", "utf8"),
    readFile("components/menu/MaisonElyseDishDetail.tsx", "utf8"),
    readFile("components/menu/AllergenDisclosure.tsx", "utf8"),
    readFile("components/menu/GoogleReviewCard.tsx", "utf8")
  ]);

  assert.match(menuSource, /data-text-direction=\{textDirection\}/);
  assert.match(menuSource, /lang=\{activeLocale\}[\s\S]{0,80}dir="ltr"/);
  assert.match(detailSource, /<main[\s\S]{0,220}dir="ltr"/);
  assert.match(detailSource, /dir=\{textDirection\}/);

  assert.match(allergenSource, /case "ar":[\s\S]{0,80}مسببات حساسية أخرى/);
  assert.match(allergenSource, /className=\{styles\.group\} dir="ltr"/);
  assert.match(allergenSource, /<dt dir=\{direction\}>\{label\}<\/dt>/);
  assert.match(allergenSource, /<dd dir=\{direction\}>\{values\.join\(", "\)\}<\/dd>/);
  assert.match(allergenSource, /<h2 id="allergen-disclosure-title" dir=\{direction\}>/);

  assert.match(googleReviewSource, /const textDirection = getTextDirection\(resolvedLocale\)/);
  assert.match(googleReviewSource, /data-google-review-card="true"[\s\S]{0,180}dir="ltr"/);
  assert.match(googleReviewSource, /className=\{styles\.googleReviewCopy\} dir=\{textDirection\}/);
  assert.match(googleReviewSource, /<span key=\{item\} dir=\{textDirection\}>/);
});

test("Sauge keeps book chrome LTR and gives text its own bidi direction", async () => {
  const [bookSource, pagesSource] = await Promise.all([
    readFile("components/menu/unique/sauge-noire/SaugeNoireBookMenu.tsx", "utf8"),
    readFile("components/menu/unique/sauge-noire/SaugeNoireMenuPages.tsx", "utf8")
  ]);

  assert.match(bookSource, /root\.dir = "ltr"/);
  assert.match(bookSource, /<main[\s\S]{0,320}dir="ltr"/);
  assert.match(bookSource, /data-text-direction=\{copyLocale\(activeLocaleValue\) === "ar" \? "rtl" : "ltr"\}/);
  assert.doesNotMatch(
    bookSource,
    /root\.dir = copyLocale\(language\) === "ar" \? "rtl" : "ltr"/
  );
  assert.match(pagesSource, /data-sauge-typography-role="title" dir="auto"/);
  assert.match(pagesSource, /<h2 dir="auto">\{dish\.name\}<\/h2>/);
  assert.match(pagesSource, /<span dir="auto">\{dish\.name\}<\/span>/);
});

test("Maison dietary filters use the resolved locale copy instead of the FR EN allergen registry labels", async () => {
  const menuSource = await readFile("components/menu/MaisonElyseQrMenu.tsx", "utf8");

  for (const mapping of [
    "dairyFree: resolved.dairyFree",
    "eggFree: resolved.eggFree",
    "fishFree: resolved.fishFree",
    "glutenFree: resolved.glutenFree",
    "nutFree: resolved.nutFree",
    "sesameFree: resolved.sesameFree",
    "shellfishFree: resolved.shellfishFree",
    "soyFree: resolved.soyFree"
  ]) {
    assert.ok(menuSource.includes(mapping), `missing localized filter mapping: ${mapping}`);
  }
  assert.doesNotMatch(menuSource, /ALLERGEN_FILTER_LABELS/);
  assert.doesNotMatch(menuSource, /option\.labels\[localeLanguage\(activeLocale\)\]/);
});
