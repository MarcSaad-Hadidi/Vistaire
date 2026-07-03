import test from "node:test";
import assert from "node:assert/strict";

import { getGreetingForTime } from "../lib/menu/greeting.ts";
import {
  TROUVABLE_COPY,
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

const TEMPLATE_KEYS = new Map([
  ["activeFilters", "{count}"],
  ["ingredientsCount", "{count}"],
  ["quantityDecrease", "{name}"],
  ["quantityIncrease", "{name}"],
  ["quantityLabel", "{name}"],
  ["resultStatus", "{view} {count}"],
  ["waiterReady", "{table}"]
]);

function buildCompleteLocalizedUiPack(prefix, value = TROUVABLE_COPY.en, path = "") {
  if (typeof value === "string") return `${prefix}:${path}`;
  if (typeof value === "function") {
    const token = TEMPLATE_KEYS.get(path);
    assert.ok(token, `missing template tokens for ${path}`);
    return `${prefix}:${path}:${token}`;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      buildCompleteLocalizedUiPack(prefix, nestedValue, path ? `${path}.${key}` : key)
    ])
  );
}

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

test("Trouvable copy merges base and exact Greek UI buckets without order loss", () => {
  const copy = getTrouvableCopy("el-GR", {
    el: {
      searchLabel: "\u0391\u03bd\u03b1\u03b6\u03ae\u03c4\u03b7\u03c3\u03b7",
      threeD: "\u03a0\u03a1\u039f\u0392\u039f\u039b\u0397 \u03a3\u0395 3D"
    },
    "el-GR": {
      swipeLabel: "\u03a3\u03cd\u03c1\u03b5\u03c4\u03b5"
    }
  });

  assert.equal(copy.searchLabel, "\u0391\u03bd\u03b1\u03b6\u03ae\u03c4\u03b7\u03c3\u03b7");
  assert.equal(copy.swipeLabel, "\u03a3\u03cd\u03c1\u03b5\u03c4\u03b5");
  assert.equal(copy.threeD, "\u03a0\u03a1\u039f\u0392\u039f\u039b\u0397 \u03a3\u0395 3D");
});

test("Trouvable exact regional UI buckets do not become base-language fallbacks", () => {
  const { copy, resolution } = resolveTrouvableCopy("pt-PT", {
    pt: {
      filterButton: "Filtrar"
    },
    "pt-BR": {
      moreDetails: "Detalhes do Brasil"
    }
  });

  assert.equal(copy.filterButton, "Filtrar");
  assert.equal(copy.moreDetails, "View details");
  assert.equal(resolution.dynamicSource, "language");
  assert.equal(resolution.usedNeutralFallback, true);
  assert.ok(resolution.missingKeys.includes("moreDetails"));
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

test("Trouvable legacy flat UI copy can include nested copy groups", () => {
  const copy = getTrouvableCopy("pt-BR", {
    filterButton: "Filtrar",
    greeting: {
      morning: "Bom dia"
    },
    threeD: "VER EM 3D",
    waiterTopics: {
      selection: "Pedir minha seleção"
    }
  });

  assert.equal(copy.filterButton, "Filtrar");
  assert.equal(copy.greeting.morning, "Bom dia");
  assert.equal(copy.threeD, "VER EM 3D");
  assert.equal(copy.waiterTopics.selection, "Pedir minha seleção");
});

test("Trouvable copy exposes documented neutral fallback metadata for missing UI packs", () => {
  const { copy, resolution } = resolveTrouvableCopy("ja-JP");

  assert.equal(copy.moreDetails, "View details");
  assert.equal(resolution.dynamicSource, "none");
  assert.equal(resolution.builtInLocale, "en");
  assert.equal(resolution.usedNeutralFallback, true);
});

test("Trouvable complete dynamic UI packs avoid neutral fallback for non-built-in locales", () => {
  const { copy, resolution } = resolveTrouvableCopy("el-GR", {
    el: buildCompleteLocalizedUiPack("el")
  });

  assert.equal(TROUVABLE_COPY.en.googleReview.title, "Your experience matters");
  assert.equal(copy.moreDetails, "el:moreDetails");
  assert.equal(copy.greeting.evening, "el:greeting.evening");
  assert.equal(copy.googleReview.title, "el:googleReview.title");
  assert.equal(
    copy.googleReview.text,
    "el:googleReview.text"
  );
  assert.equal(copy.activeFilters(3), "el:activeFilters:3");
  assert.equal(copy.quantityLabel("Spanakopita"), "el:quantityLabel:Spanakopita");
  assert.equal(resolution.dynamicSource, "language");
  assert.equal(resolution.builtInLocale, "en");
  assert.equal(resolution.uiCopyComplete, true);
  assert.equal(resolution.usedNeutralFallback, false);
  assert.deepEqual(resolution.missingKeys, []);
  assert.deepEqual(resolution.ignoredKeys, []);
});

test("Trouvable partial dynamic UI packs report missing and ignored keys", () => {
  const { copy, resolution } = resolveTrouvableCopy("el-GR", {
    el: {
      greeting: {
        evening: "\u039a\u03b1\u03bb\u03b7\u03c3\u03c0\u03ad\u03c1\u03b1"
      },
      swipeLabel: "\u03a3\u03cd\u03c1\u03b5\u03c4\u03b5",
      typoLabel: "\u039b\u03ac\u03b8\u03bf\u03c2"
    }
  });

  assert.equal(copy.swipeLabel, "\u03a3\u03cd\u03c1\u03b5\u03c4\u03b5");
  assert.equal(copy.moreDetails, "View details");
  assert.equal(resolution.uiCopyComplete, false);
  assert.equal(resolution.usedNeutralFallback, true);
  assert.ok(resolution.missingKeys.includes("moreDetails"));
  assert.ok(resolution.missingKeys.includes("greeting.morning"));
  assert.ok(resolution.ignoredKeys.includes("typoLabel"));
});

test("Trouvable dynamic UI copy localizes function-valued labels with templates", () => {
  const copy = getTrouvableCopy("el-GR", {
    el: {
      activeFilters: "{count} \u03c6\u03af\u03bb\u03c4\u03c1\u03b1",
      filterButton: "\u03a6\u03af\u03bb\u03c4\u03c1\u03bf",
      quantityLabel: "\u03a0\u03bf\u03c3\u03cc\u03c4\u03b7\u03c4\u03b1 \u03b3\u03b9\u03b1 {name}",
      resultStatus: "\u03a0\u03c1\u03bf\u03b2\u03bf\u03bb\u03ae {view}, {count} \u03c0\u03b9\u03ac\u03c4\u03b1",
      waiterReady: "{table} - \u03c4\u03bf \u03b1\u03af\u03c4\u03b7\u03bc\u03b1 \u03b5\u03af\u03bd\u03b1\u03b9 \u03ad\u03c4\u03bf\u03b9\u03bc\u03bf."
    }
  });

  assert.equal(copy.filterButton, "\u03a6\u03af\u03bb\u03c4\u03c1\u03bf");
  assert.equal(typeof copy.activeFilters, "function");
  assert.equal(typeof copy.quantityLabel, "function");
  assert.equal(typeof copy.resultStatus, "function");
  assert.equal(typeof copy.waiterReady, "function");
  assert.equal(copy.activeFilters(2), "2 \u03c6\u03af\u03bb\u03c4\u03c1\u03b1");
  assert.equal(
    copy.quantityLabel("Spanakopita"),
    "\u03a0\u03bf\u03c3\u03cc\u03c4\u03b7\u03c4\u03b1 \u03b3\u03b9\u03b1 Spanakopita"
  );
  assert.equal(
    copy.resultStatus("grid", 4),
    "\u03a0\u03c1\u03bf\u03b2\u03bf\u03bb\u03ae grid, 4 \u03c0\u03b9\u03ac\u03c4\u03b1"
  );
  assert.equal(
    copy.waiterReady("Table 12"),
    "Table 12 - \u03c4\u03bf \u03b1\u03af\u03c4\u03b7\u03bc\u03b1 \u03b5\u03af\u03bd\u03b1\u03b9 \u03ad\u03c4\u03bf\u03b9\u03bc\u03bf."
  );
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

test("Trouvable greeting uses dynamic Greek restaurant UI copy when provided", () => {
  const evening = new Date("2026-07-02T19:00:00.000Z");

  assert.equal(
    getTrouvableGreetingForDate("el-GR", "UTC", evening, {
      el: {
        greeting: {
          evening: "\u039a\u03b1\u03bb\u03b7\u03c3\u03c0\u03ad\u03c1\u03b1",
          night: "\u039a\u03b1\u03bb\u03b7\u03c3\u03c0\u03ad\u03c1\u03b1"
        }
      }
    }),
    "\u039a\u03b1\u03bb\u03b7\u03c3\u03c0\u03ad\u03c1\u03b1"
  );
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
    supportedLocales: ["fr-CA", "en-CA", "es-ES", "it-IT", "de-DE", "el-GR", "ar"],
    supportedCurrencies: ["CAD", "USD", "EUR", "GBP"]
  };

  assert.deepEqual(
    getTrouvableLanguageOptions(settings, "fr-CA").map((option) => option.publicLocale),
    ["fr-CA", "en-CA", "es-ES", "it-IT", "de-DE", "el-GR", "ar"]
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
