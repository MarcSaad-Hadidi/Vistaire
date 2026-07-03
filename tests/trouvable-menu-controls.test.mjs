import test from "node:test";
import assert from "node:assert/strict";

import { getGreetingForTime } from "../lib/menu/greeting.ts";
import {
  formatTrouvablePriceLabel,
  getTrouvableCopy,
  getTrouvableCurrencyOptions,
  getTrouvableCurrencyOption,
  getTrouvableCurrencyOptionLabel,
  getTrouvableGreetingForDate,
  getTrouvableGreeting,
  getTrouvableGreetingPeriod,
  getTrouvableLanguageOptions,
  getTrouvableLanguagePresentation,
  getTrouvableLanguageShortCode,
  getTrouvableTextDirection,
  normalizeTrouvableCurrency,
  normalizeTrouvableTheme,
  parseTrouvablePriceLabel,
  resolveTrouvableCopy,
  buildNavigableMenuSections,
  getAdjacentMenuSection
} from "../components/menu/trouvableMenuControls.ts";

const SLEEP_GREETING_PATTERN =
  /bonne nuit|good night|buona notte|gute nacht|تصبح على خير|sleep well|dormez bien|have a good night/i;

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
    "Bienvenue"
  );
  assert.equal(
    getTrouvableGreeting("en", getTrouvableGreetingPeriod(new Date(2026, 5, 30, 19))),
    "Good evening"
  );
  assert.equal(
    getTrouvableGreeting("en", getTrouvableGreetingPeriod(new Date(2026, 5, 30, 2))),
    "Good evening"
  );
});

test("restaurant greeting never uses sleep or good-night copy", () => {
  const locales = ["fr-CA", "en-CA", "es-ES", "it-IT", "de-DE", "ar"];
  const hours = [2, 8, 14, 19, 23];

  for (const locale of locales) {
    for (const hour of hours) {
      const date = new Date(2026, 6, 2, hour, 0, 0);
      const greeting = getTrouvableGreetingForDate(locale, "UTC", date);
      assert.equal(
        SLEEP_GREETING_PATTERN.test(greeting),
        false,
        `${locale} at ${hour}h returned "${greeting}"`
      );
    }
  }
});

test("Trouvable copy supports Spanish, Italian, and Arabic without falling back to English", () => {
  assert.equal(getTrouvableCopy("es-ES").moreDetails, "Ver detalles");
  assert.equal(getTrouvableCopy("es-ES").threeD, "VER EN 3D");
  assert.equal(getTrouvableCopy("es-ES").swipeLabel, "Deslizar");
  assert.equal(getTrouvableCopy("it-IT").moreDetails, "Vedi dettagli");
  assert.equal(getTrouvableCopy("it-IT").threeD, "VEDI IN 3D");
  assert.equal(getTrouvableCopy("it-IT").swipeLabel, "Scorri");
  assert.equal(getTrouvableCopy("ar").moreDetails, "\u0639\u0631\u0636 \u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644");
  assert.equal(getTrouvableCopy("ar").threeD, "\u0639\u0631\u0636 3D");
  assert.equal(getTrouvableCopy("ar").swipeLabel, "\u0645\u0631\u0631");
  assert.equal(getTrouvableCopy("fr-CA").reviewPost, "Publier l'avis");
});

test("Trouvable copy reads exact dynamic localized UI copy before built-ins", () => {
  const copy = getTrouvableCopy("de-DE", {
    "de-DE": {
      moreDetails: "Details ansehen",
      searchPlaceholder: "Gericht, Zutat oder Tag suchen...",
      swipeLabel: "Wischen",
      tableLabel: "Tisch",
      tablePlaceholder: "Z. B. 12",
      threeD: "IN 3D ANSEHEN"
    }
  });

  assert.equal(copy.moreDetails, "Details ansehen");
  assert.equal(copy.searchPlaceholder, "Gericht, Zutat oder Tag suchen...");
  assert.equal(copy.swipeLabel, "Wischen");
  assert.equal(copy.tableLabel, "Tisch");
  assert.equal(copy.tablePlaceholder, "Z. B. 12");
  assert.equal(copy.threeD, "IN 3D ANSEHEN");
});

test("Trouvable copy reads base-language dynamic UI copy for non-built-in locales", () => {
  const copy = getTrouvableCopy("pt-BR", {
    pt: {
      filterButton: "Filtrar",
      immersiveFilterLabel: "3D / RA",
      moreDetails: "Ver detalhes",
      swipeLabel: "Deslizar",
      threeD: "VER EM 3D"
    }
  });

  assert.equal(copy.filterButton, "Filtrar");
  assert.equal(copy.immersiveFilterLabel, "3D / RA");
  assert.equal(copy.moreDetails, "Ver detalhes");
  assert.equal(copy.swipeLabel, "Deslizar");
  assert.equal(copy.threeD, "VER EM 3D");
});

test("Trouvable copy merges missing dynamic keys from the locale fallback", () => {
  const copy = getTrouvableCopy("es-MX", {
    es: {
      moreDetails: "Abrir detalles"
    }
  });

  assert.equal(copy.moreDetails, "Abrir detalles");
  assert.equal(copy.filterButton, "Filtrar");
  assert.equal(copy.threeD, "VER EN 3D");
});

test("Trouvable copy exposes documented neutral fallback metadata for missing UI packs", () => {
  const { copy, resolution } = resolveTrouvableCopy("ja-JP");

  assert.equal(copy.moreDetails, "View details");
  assert.equal(resolution.dynamicSource, "none");
  assert.equal(resolution.builtInLocale, "en");
  assert.equal(resolution.usedNeutralFallback, true);
});

test("Trouvable dynamic UI copy cannot replace function-valued copy with strings", () => {
  const copy = getTrouvableCopy("de-DE", {
    "de-DE": {
      activeFilters: "Kaputte Filter",
      filterButton: "Filtern",
      quantityLabel: "Kaputte Menge",
      resultStatus: "Kaputter Status",
      waiterReady: "Kaputter Service"
    }
  });

  assert.equal(copy.filterButton, "Filtern");
  assert.equal(typeof copy.activeFilters, "function");
  assert.equal(typeof copy.quantityLabel, "function");
  assert.equal(typeof copy.resultStatus, "function");
  assert.equal(typeof copy.waiterReady, "function");
});

test("Trouvable greeting uses the active public locale and restaurant timezone", () => {
  const morning = new Date("2026-07-02T08:00:00.000Z");
  const afternoon = new Date("2026-07-02T14:00:00.000Z");
  const evening = new Date("2026-07-02T19:00:00.000Z");
  const night = new Date("2026-07-02T02:00:00.000Z");

  assert.equal(getTrouvableGreetingForDate("es-ES", "UTC", morning), "Buenos días");
  assert.equal(getTrouvableGreetingForDate("fr-CA", "UTC", afternoon), "Bienvenue");
  assert.equal(getTrouvableGreetingForDate("it-IT", "UTC", afternoon), "Benvenuto");
  assert.equal(getTrouvableGreetingForDate("de-DE", "UTC", morning), "Guten Morgen");
  assert.equal(getTrouvableGreetingForDate("de-DE", "UTC", evening), "Guten Abend");
  assert.equal(getTrouvableGreetingForDate("ar", "UTC", evening), "\u0645\u0633\u0627\u0621 \u0627\u0644\u062e\u064a\u0631");
  assert.equal(getTrouvableGreetingForDate("ar", "UTC", night), "\u0645\u0633\u0627\u0621 \u0627\u0644\u062e\u064a\u0631");
});

test("Trouvable language and currency labels follow the active locale", () => {
  const settings = {
    supportedLocales: ["fr-CA", "en-CA", "es-ES", "it-IT", "ar"],
    supportedCurrencies: ["CAD", "USD", "EUR"]
  };
  const spanishLabels = getTrouvableLanguageOptions(settings, "es-ES");
  const arabicLabels = getTrouvableLanguageOptions(settings, "ar");

  assert.equal(
    spanishLabels.find((option) => option.locale === "fr-CA")?.nativeName,
    "Français"
  );
  assert.equal(
    spanishLabels.find((option) => option.locale === "es-ES")?.nativeName,
    "Español"
  );
  assert.equal(
    arabicLabels.find((option) => option.locale === "ar")?.nativeName,
    "\u0627\u0644\u0639\u0631\u0628\u064a\u0629"
  );
  assert.equal(getTrouvableLanguagePresentation("fr-CA").code, "FR-CA");
  assert.equal(getTrouvableLanguageShortCode("fr-CA"), "FR");
  assert.equal(getTrouvableLanguageShortCode("en-CA"), "EN");
  assert.equal(getTrouvableLanguageShortCode("ar"), "AR");
  assert.match(
    getTrouvableCurrencyOptionLabel(getTrouvableCurrencyOption("CAD"), "es-ES"),
    /canad/i
  );
  assert.equal(getTrouvableTextDirection("ar"), "rtl");
  assert.equal(getTrouvableTextDirection("it-IT"), "ltr");
});

test("Trouvable selectors expose every configured public locale and currency", () => {
  const settings = {
    defaultLocale: "fr-CA",
    supportedLocales: ["fr-CA", "en-CA", "es-ES", "it-IT", "de-DE", "ar"],
    supportedCurrencies: ["CAD", "USD", "EUR", "GBP"]
  };

  assert.deepEqual(
    getTrouvableLanguageOptions(settings, "fr-CA").map((option) => option.publicLocale),
    ["fr-CA", "en-CA", "es-ES", "it-IT", "de-DE", "ar"]
  );
  assert.deepEqual(
    getTrouvableCurrencyOptions(settings).map((option) => option.code),
    ["CAD", "USD", "EUR", "GBP"]
  );
});

test("Trouvable menu section navigation includes All first and clamps at edges", () => {
  const sections = buildNavigableMenuSections("all", [
    "Dejeuner",
    "all",
    "Dejeuner",
    "Entrees",
    "Plats"
  ]);

  assert.deepEqual(sections, ["all", "Dejeuner", "Entrees", "Plats"]);
  assert.equal(getAdjacentMenuSection(sections, "all", 1), "Dejeuner");
  assert.equal(getAdjacentMenuSection(sections, "Dejeuner", -1), "all");
  assert.equal(getAdjacentMenuSection(sections, "Dejeuner", 1), "Entrees");
  assert.equal(getAdjacentMenuSection(sections, "all", -1), null);
  assert.equal(getAdjacentMenuSection(sections, "Plats", 1), null);
});

test("getGreetingForTime localizes restaurant greetings by locale", () => {
  const afternoon = new Date("2026-07-02T14:00:00.000Z");
  const night = new Date("2026-07-02T02:00:00.000Z");

  assert.equal(getGreetingForTime(afternoon, "fr-CA", "UTC"), "Bienvenue");
  assert.equal(getGreetingForTime(afternoon, "en-CA", "UTC"), "Welcome");
  assert.equal(getGreetingForTime(night, "fr-CA", "UTC"), "Bonsoir");
  assert.equal(getGreetingForTime(night, "en-CA", "UTC"), "Good evening");
});
