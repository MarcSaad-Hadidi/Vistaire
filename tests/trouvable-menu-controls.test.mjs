import test from "node:test";
import assert from "node:assert/strict";

import {
  formatTrouvablePriceLabel,
  getTrouvableCopy,
  getTrouvableCurrencyOption,
  getTrouvableCurrencyOptionLabel,
  getTrouvableGreetingForDate,
  getTrouvableGreeting,
  getTrouvableGreetingPeriod,
  getTrouvableLanguageOptions,
  getTrouvableTextDirection,
  normalizeTrouvableCurrency,
  normalizeTrouvableTheme,
  parseTrouvablePriceLabel
} from "../components/menu/trouvableMenuControls.ts";

test("Trouvable price labels parse CAD menu prices and format configured currencies", () => {
  assert.equal(parseTrouvablePriceLabel("14,99 $"), 14.99);
  assert.equal(parseTrouvablePriceLabel("$17.95"), 17.95);
  assert.equal(formatTrouvablePriceLabel("14,99 $", "CAD", "fr"), "14,99 $");
  assert.equal(formatTrouvablePriceLabel("14,99 $", "USD", "en"), "US$10.94");
  assert.equal(formatTrouvablePriceLabel("14,99 $", "EUR", "fr"), "10,19 €");
});

test("Trouvable controls normalize unsupported persisted values safely", () => {
  assert.equal(normalizeTrouvableCurrency("USD"), "USD");
  assert.equal(normalizeTrouvableCurrency("GBP"), "GBP");
  assert.equal(normalizeTrouvableCurrency("invalid"), "CAD");
  assert.equal(normalizeTrouvableTheme("light"), "light");
  assert.equal(normalizeTrouvableTheme("sepia"), "dark");
});

test("Trouvable greeting period follows local client time buckets", () => {
  assert.equal(
    getTrouvableGreeting("fr", getTrouvableGreetingPeriod(new Date(2026, 5, 30, 8))),
    "Bonjour"
  );
  assert.equal(
    getTrouvableGreeting("fr", getTrouvableGreetingPeriod(new Date(2026, 5, 30, 14))),
    "Bon après-midi"
  );
  assert.equal(
    getTrouvableGreeting("en", getTrouvableGreetingPeriod(new Date(2026, 5, 30, 19))),
    "Good evening"
  );
  assert.equal(
    getTrouvableGreeting("en", getTrouvableGreetingPeriod(new Date(2026, 5, 30, 2))),
    "Good night"
  );
});

test("Trouvable copy supports Spanish, Italian, and Arabic without falling back to English", () => {
  assert.equal(getTrouvableCopy("es-ES").moreDetails, "Mas detalles");
  assert.equal(getTrouvableCopy("es-ES").threeD, "VER EN 3D");
  assert.equal(getTrouvableCopy("it-IT").moreDetails, "Piu dettagli");
  assert.equal(getTrouvableCopy("it-IT").threeD, "VEDI IN 3D");
  assert.equal(getTrouvableCopy("ar").moreDetails, "\u062a\u0641\u0627\u0635\u064a\u0644 \u0623\u0643\u062b\u0631");
  assert.equal(getTrouvableCopy("ar").threeD, "\u0639\u0631\u0636 3D");
  assert.equal(getTrouvableCopy("fr-CA").reviewPost, "Publier l'avis");
});

test("Trouvable greeting uses the active public locale and restaurant timezone", () => {
  const morning = new Date("2026-07-02T08:00:00.000Z");
  const afternoon = new Date("2026-07-02T14:00:00.000Z");
  const evening = new Date("2026-07-02T19:00:00.000Z");
  const night = new Date("2026-07-02T02:00:00.000Z");

  assert.equal(getTrouvableGreetingForDate("es-ES", "UTC", morning), "Buenos dias");
  assert.equal(getTrouvableGreetingForDate("fr-CA", "UTC", afternoon), "Bon après-midi");
  assert.equal(getTrouvableGreetingForDate("it-IT", "UTC", afternoon), "Buon pomeriggio");
  assert.equal(getTrouvableGreetingForDate("ar", "UTC", evening), "\u0645\u0633\u0627\u0621 \u0627\u0644\u062e\u064a\u0631");
  assert.equal(getTrouvableGreetingForDate("ar", "UTC", night), "\u062a\u0635\u0628\u062d \u0639\u0644\u0649 \u062e\u064a\u0631");
});

test("Trouvable language and currency labels follow the active locale", () => {
  const settings = {
    supportedLocales: ["fr-CA", "en-CA", "es-ES", "it-IT", "ar"],
    supportedCurrencies: ["CAD", "USD", "EUR"]
  };
  const spanishLabels = getTrouvableLanguageOptions(settings, "es-ES");
  const arabicLabels = getTrouvableLanguageOptions(settings, "ar");

  assert.match(
    spanishLabels.find((option) => option.locale === "fr-CA")?.label ?? "",
    /franc/i
  );
  assert.match(
    spanishLabels.find((option) => option.locale === "es-ES")?.label ?? "",
    /espa/i
  );
  assert.match(
    arabicLabels.find((option) => option.locale === "ar")?.label ?? "",
    /\u0627\u0644\u0639\u0631\u0628\u064a/
  );
  assert.match(
    getTrouvableCurrencyOptionLabel(getTrouvableCurrencyOption("CAD"), "es-ES"),
    /canad/i
  );
  assert.equal(getTrouvableTextDirection("ar"), "rtl");
  assert.equal(getTrouvableTextDirection("it-IT"), "ltr");
});
