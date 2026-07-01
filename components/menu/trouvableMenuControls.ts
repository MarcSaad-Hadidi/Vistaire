import {
  LOCALE_LANGUAGE_TAG,
  normalizeLocale,
  type Locale
} from "../../lib/i18n.ts";
import {
  convertMenuPriceCents,
  formatMenuPrice,
  formatMenuPriceCents,
  type MenuExchangeRates
} from "../../lib/currency/formatMenuPrice.ts";
import { getGreetingForTime } from "../../lib/menu/greeting.ts";
import type { PublicMenuDish } from "../../lib/menu/publicMenuCore.ts";
import {
  normalizePublicMenuCurrencyPreference,
  normalizePublicMenuLocalePreference,
  normalizePublicMenuThemePreference,
  publicLocaleToShortLocale,
  publicLocaleToLanguageTag,
  type PublicMenuCurrency,
  type PublicMenuSettings
} from "../../lib/menu/publicMenuSettings.ts";

export type TrouvableLocale = Locale;
export type TrouvableCurrency = PublicMenuCurrency;
export type TrouvableTheme = "dark" | "light";
export type TrouvableGreetingPeriod = "morning" | "afternoon" | "evening" | "night";

export const TROUVABLE_LOCALE_STORAGE_KEY = "vistaire:trouvable-menu-locale";
export const TROUVABLE_CURRENCY_STORAGE_KEY = "vistaire:trouvable-menu-currency";
export const TROUVABLE_THEME_STORAGE_KEY = "vistaire:trouvable-menu-theme";

export const TROUVABLE_CURRENCY_OPTIONS: Array<{
  code: TrouvableCurrency;
  label: Record<TrouvableLocale, string>;
  symbol: string;
}> = [
  {
    code: "CAD",
    label: { en: "Canadian dollar", fr: "Dollar canadien" },
    symbol: "$"
  },
  {
    code: "USD",
    label: { en: "US dollar", fr: "Dollar américain" },
    symbol: "$"
  },
  { code: "EUR", label: { en: "Euro", fr: "Euro" }, symbol: "€" }
];

export const TROUVABLE_STATIC_CAD_RATES: Partial<Record<TrouvableCurrency, number>> = {
  CAD: 1,
  USD: 0.73,
  EUR: 0.68
};

const CATEGORY_TRANSLATIONS: Record<string, Partial<Record<TrouvableLocale, string>>> = {
  "bols & salades": { en: "Bowls & salads" },
  boissons: { en: "Drinks" },
  burgers: { en: "Burgers" },
  desserts: { en: "Desserts" },
  entrees: { en: "Starters" },
  "entrées": { en: "Starters" },
  pizzas: { en: "Pizzas" },
  plats: { en: "Dishes" },
  "plats maison": { en: "House dishes" },
  salades: { en: "Salads" },
  seafood: { fr: "Fruits de mer" },
  signatures: { en: "Signatures" }
};

export const TROUVABLE_COPY = {
  fr: {
    activeCategoryAll: "La carte",
    add: "Ajouter",
    addToSelection: "Ajouter à ma sélection",
    all: "Tout",
    activeFilterPrefix: "Filtre actif",
    activeFilters: (count: number) => `${count} filtres`,
    allergens: "Allergènes",
    askWaiter: "Demander au serveur",
    available: "Disponible",
    backToMenu: "Retour au menu",
    categories: "CATÉGORIES",
    categoryAria: "Catégories",
    clearSearch: "Effacer",
    close: "Fermer",
    closeFilters: "Fermer les filtres",
    closeDetail: "Fermer le détail",
    closeLanguage: "Fermer le choix de langue",
    closeSelection: "Fermer la sélection",
    closeWaiter: "Fermer la demande serveur",
    currencyAria: "Choisir la devise du menu",
    currencyCopy: "Les prix sont convertis localement à partir du prix CAD du menu.",
    currencyKicker: "Devise",
    currencyTitle: "Devise du menu",
    details: "Détails",
    emptySelectionBody: "Ajoutez un plat pour préparer une demande au serveur.",
    emptySelectionTitle: "Votre sélection est vide.",
    estimatedTotal: "Total estimé",
    filterAllAria: "Afficher tous les plats",
    filterAvailableAria: "Filtrer les plats disponibles",
    filterImmersiveAria: "Filtrer les plats avec expérience 3D ou AR",
    filterNonVegAria: "Filtrer les plats non végétariens détectés",
    filterRecommendedAria: "Filtrer les plats signatures ou recommandés",
    filterVegAria: "Filtrer les plats végétariens détectés",
    filterApply: "Appliquer",
    filterButton: "Filtrer",
    filterFallback: "Filtre",
    filterGroupLabel: "Filtres",
    filterKicker: "Trouvable",
    filterTitle: "Filtres",
    filtersAria: "Filtres rapides",
    dairyFree: "Sans lactose",
    eggFree: "Sans oeufs",
    fishFree: "Sans poisson",
    glutenFree: "Sans gluten",
    nutFree: "Sans fruits \u00e0 coque",
    gridAria: "Afficher en grille",
    greeting: {
      afternoon: "Bon après-midi",
      evening: "Bonsoir",
      morning: "Bonjour",
      night: "Bonne nuit"
    },
    heroAction: "Voir la carte",
    heroBlurb: "Cuisine maison, accents chaleureux et service à table.",
    houseNote: "Note maison",
    immersiveUnavailable: "Vue 3D non disponible pour ce plat.",
    ingredients: "Ingrédients",
    ingredientsCount: (count: number) =>
      `${count} ingrédient${count > 1 ? "s" : ""}`,
    languageAria: "Choisir la langue du menu",
    languageCopy: "Le menu garde les noms de plats tels que fournis quand aucune traduction n'existe.",
    languageKicker: "Langue",
    languageTitle: "Langue du menu",
    listAria: "Afficher en liste",
    localOrderHint:
      "Aucune commande n'est envoyée automatiquement. Montrez cette demande à l'équipe.",
    menuAria: "Carte Trouvable",
    menuContextFallback: "Menu à table",
    modelPreparing: "Préparation de la vue immersive...",
    modelUnavailable: "Vue 3D temporairement indisponible.",
    arBrowserHelp:
      "Si \"Afficher devant moi\" ne s'ouvre pas, ouvrez cette fiche dans Safari ou Chrome, puis relancez la 3D.",
    arBrowserLink: "Ouvrir dans le navigateur",
    moreDetails: "Plus de détails",
    nextDish: "Plat suivant",
    nonVeg: "Non-végé",
    noResultsBody: "Essayez une autre recherche ou retirez un filtre.",
    noResultsTitle: "Aucun plat ne correspond.",
    options: "Options",
    popular: "Populaire",
    previousDish: "Plat précédent",
    priceToConfirm: "Prix à confirmer",
    prepareRequest: "Préparer la demande",
    quantityDecrease: (name: string) => `Diminuer la quantité de ${name}`,
    quantityIncrease: (name: string) => `Augmenter la quantité de ${name}`,
    quantityLabel: (name: string) => `Quantité de ${name}`,
    recommendation: "Recommandé",
    reset: "Réinitialiser",
    resetFilters: "R\u00e9initialiser les filtres",
    resultStatus: (view: string, count: number) =>
      `Vue ${view}, ${count} plat${count > 1 ? "s" : ""} affiché${count > 1 ? "s" : ""}`,
    review: "LAISSER UN AVIS",
    reviewClose: "Fermer l'avis",
    reviewComment: "Votre commentaire",
    reviewExperiencePlaceholder: "Comment s'est passée votre visite ?",
    reviewExperienceStars: "Note de l'expérience",
    reviewExperienceTitle: "Noter votre expérience",
    reviewMissing: "Lien Google Review non configuré pour ce restaurant.",
    reviewOpened: "Google Review ouvert dans un nouvel onglet.",
    reviewPlaceholder: "Comment était le goût ?",
    reviewPost: "POST REVIEW",
    reviewStars: "Note du plat",
    reviewTitle: "Noter ce plat",
    searchLabel: "Recherche",
    searchPlaceholder: "Rechercher un plat, ingrédient, tag...",
    selection: "Sélection",
    selectionKicker: "Sélection locale",
    selectionTitle: "Votre sélection",
    server: "Serveur",
    sesameFree: "Sans s\u00e9same",
    shellfishFree: "Sans crustac\u00e9s",
    signature: "Signature",
    soyFree: "Sans soja",
    soldOut: "Indispo",
    spicy: "Plat épicé",
    swipeList: "Balayer ↔",
    tableToConfirm: "Table à confirmer",
    themeDarkAria: "Activer le mode sombre",
    themeLightAria: "Activer le mode clair",
    threeD: "VOIR EN 3D",
    toConfirm: "À confirmer",
    viewAr: "Voir devant moi",
    viewGrid: "grille",
    viewList: "liste",
    viewModeAria: "Mode d'affichage",
    waiterKicker: "Service à table",
    waiterReady: (table: string) => `${table} - demande prête localement.`,
    waiterTitle: "Demander au serveur",
    waiterTopic: "Objet de la demande",
    waiterTopics: {
      allergen: "Question allergène",
      recommendation: "Demander une recommandation",
      selection: "Demander ma sélection"
    },
    veg: "Végé"
  },
  en: {
    activeCategoryAll: "Menu",
    add: "Add",
    addToSelection: "Add to selection",
    all: "All",
    activeFilterPrefix: "Active filter",
    activeFilters: (count: number) => `${count} filters`,
    allergens: "Allergens",
    askWaiter: "Ask waiter",
    available: "Available",
    backToMenu: "Back to menu",
    categories: "CATEGORIES",
    categoryAria: "Categories",
    clearSearch: "Clear",
    close: "Close",
    closeFilters: "Close filters",
    closeDetail: "Close details",
    closeLanguage: "Close language chooser",
    closeSelection: "Close selection",
    closeWaiter: "Close waiter request",
    currencyAria: "Choose menu currency",
    currencyCopy: "Prices are converted locally from the CAD menu price.",
    currencyKicker: "Currency",
    currencyTitle: "Menu currency",
    details: "Details",
    emptySelectionBody: "Add a dish to prepare a waiter request.",
    emptySelectionTitle: "Your selection is empty.",
    estimatedTotal: "Estimated total",
    filterAllAria: "Show all dishes",
    filterAvailableAria: "Filter available dishes",
    filterImmersiveAria: "Filter dishes with 3D or AR",
    filterNonVegAria: "Filter detected non-vegetarian dishes",
    filterRecommendedAria: "Filter signature or recommended dishes",
    filterVegAria: "Filter detected vegetarian dishes",
    filterApply: "Apply",
    filterButton: "Filter",
    filterFallback: "Filter",
    filterGroupLabel: "Filters",
    filterKicker: "Trouvable",
    filterTitle: "Filters",
    filtersAria: "Quick filters",
    dairyFree: "Dairy-free",
    eggFree: "Egg-free",
    fishFree: "Fish-free",
    glutenFree: "Gluten-free",
    nutFree: "Nut-free",
    gridAria: "Show grid view",
    greeting: {
      afternoon: "Good Afternoon",
      evening: "Good Evening",
      morning: "Good Morning",
      night: "Good Night"
    },
    heroAction: "View menu",
    heroBlurb: "House cooking, warm accents and table service.",
    houseNote: "House note",
    immersiveUnavailable: "3D view is not available for this dish.",
    ingredients: "Ingredients",
    ingredientsCount: (count: number) =>
      `${count} ingredient${count > 1 ? "s" : ""}`,
    languageAria: "Choose menu language",
    languageCopy: "Dish names stay as provided when no translation exists.",
    languageKicker: "Language",
    languageTitle: "Menu language",
    listAria: "Show list view",
    localOrderHint:
      "No order is sent automatically. Show this request to the team.",
    menuAria: "Trouvable menu",
    menuContextFallback: "Table menu",
    modelPreparing: "Preparing the immersive view...",
    modelUnavailable: "3D view is temporarily unavailable.",
    arBrowserHelp:
      "If \"View in my space\" does not open, open this dish in Safari or Chrome, then launch 3D again.",
    arBrowserLink: "Open in browser",
    moreDetails: "More details",
    nextDish: "Next dish",
    nonVeg: "Non-veg",
    noResultsBody: "Try another search or remove a filter.",
    noResultsTitle: "No dish matches.",
    options: "Options",
    popular: "Popular",
    previousDish: "Previous dish",
    priceToConfirm: "Price to confirm",
    prepareRequest: "Prepare request",
    quantityDecrease: (name: string) => `Decrease quantity of ${name}`,
    quantityIncrease: (name: string) => `Increase quantity of ${name}`,
    quantityLabel: (name: string) => `Quantity of ${name}`,
    recommendation: "Recommended",
    reset: "Reset",
    resetFilters: "Reset filters",
    resultStatus: (view: string, count: number) =>
      `${view} view, ${count} dish${count > 1 ? "es" : ""} shown`,
    review: "TAP TO REVIEW",
    reviewClose: "Close review",
    reviewComment: "Your comment",
    reviewExperiencePlaceholder: "How was your visit?",
    reviewExperienceStars: "Experience rating",
    reviewExperienceTitle: "Rate your experience",
    reviewMissing: "Google Review link is not configured for this restaurant.",
    reviewOpened: "Google Review opened in a new tab.",
    reviewPlaceholder: "How was the taste?",
    reviewPost: "POST REVIEW",
    reviewStars: "Dish rating",
    reviewTitle: "Rate this Dish",
    searchLabel: "Search",
    searchPlaceholder: "Search dish, ingredient, tag...",
    selection: "Selection",
    selectionKicker: "Local selection",
    selectionTitle: "Your selection",
    server: "Waiter",
    sesameFree: "Sesame-free",
    shellfishFree: "Shellfish-free",
    signature: "Signature",
    soyFree: "Soy-free",
    soldOut: "Sold out",
    spicy: "Spicy dish",
    swipeList: "Swipe List ↔",
    tableToConfirm: "Table to confirm",
    themeDarkAria: "Turn on dark mode",
    themeLightAria: "Turn on light mode",
    threeD: "VIEW IN 3D",
    toConfirm: "To confirm",
    viewAr: "View in my space",
    viewGrid: "grid",
    viewList: "list",
    viewModeAria: "Display mode",
    waiterKicker: "Table service",
    waiterReady: (table: string) => `${table} - request ready locally.`,
    waiterTitle: "Ask waiter",
    waiterTopic: "Request topic",
    waiterTopics: {
      allergen: "Allergen question",
      recommendation: "Ask for a recommendation",
      selection: "Ask about my selection"
    },
    veg: "Veg"
  }
} as const;

export function normalizeTrouvableLocale(value: unknown): TrouvableLocale {
  return normalizeLocale(value);
}

export function normalizeTrouvableLocaleForSettings(
  value: unknown,
  settings: PublicMenuSettings
): TrouvableLocale {
  return publicLocaleToShortLocale(
    normalizePublicMenuLocalePreference(value, settings)
  );
}

export function normalizeTrouvableCurrency(
  value: unknown,
  settings?: PublicMenuSettings
): TrouvableCurrency {
  if (settings) {
    return normalizePublicMenuCurrencyPreference(value, settings);
  }
  const currency = typeof value === "string" ? value.toUpperCase() : "";
  return /^[A-Z]{3}$/.test(currency) ? currency : "CAD";
}

export function normalizeTrouvableTheme(
  value: unknown,
  settings?: PublicMenuSettings
): TrouvableTheme {
  if (settings) return normalizePublicMenuThemePreference(value, settings);
  return value === "light" ? "light" : "dark";
}

export function getTrouvableCopy(locale: TrouvableLocale) {
  return TROUVABLE_COPY[locale];
}

export function getTrouvableCurrencyOption(currency: TrouvableCurrency) {
  const option = TROUVABLE_CURRENCY_OPTIONS.find((item) => item.code === currency);
  if (option) return option;
  let symbol = currency;
  try {
    const parts = new Intl.NumberFormat("fr-CA", {
      currency,
      style: "currency"
    }).formatToParts(1);
    symbol = parts.find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    symbol = currency;
  }
  return {
    code: currency,
    label: { en: currency, fr: currency },
    symbol
  };
}

export function getTrouvableCurrencyOptions(settings: PublicMenuSettings) {
  return settings.supportedCurrencies.map(getTrouvableCurrencyOption);
}

export function getTrouvableLanguageOptions(settings: PublicMenuSettings): Array<{
  locale: TrouvableLocale;
  label: string;
}> {
  return settings.supportedLocales.map((locale) => {
    const shortLocale = publicLocaleToShortLocale(locale);
    return {
      locale: shortLocale,
      label: shortLocale === "en" ? "English" : "Francais"
    };
  });
}

export function parseTrouvablePriceLabel(priceLabel: string): number | null {
  const match = priceLabel.match(/-?\d[\d\s.,]*/);
  if (!match) return null;

  let value = match[0].replace(/\s/g, "");
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      value = value.replace(/\./g, "").replace(",", ".");
    } else {
      value = value.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    value = value.replace(",", ".");
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function formatTrouvableAmount(
  cadAmount: number,
  currency: TrouvableCurrency,
  locale: TrouvableLocale,
  exchangeRates?: MenuExchangeRates
): string {
  if (exchangeRates) {
    return formatMenuPrice({
      priceCents: Math.round(cadAmount * 100),
      sourceCurrency: exchangeRates.base,
      targetCurrency: currency,
      locale,
      rates: exchangeRates.rates,
      baseCurrency: exchangeRates.base,
      fallbackLabel: formatMenuPriceCents({
        priceCents: Math.round(cadAmount * 100),
        currency: exchangeRates.base,
        locale
      })
    });
  }

  return new Intl.NumberFormat(LOCALE_LANGUAGE_TAG[locale], {
    currency,
    style: "currency"
  }).format(cadAmount * (TROUVABLE_STATIC_CAD_RATES[currency] ?? 1));
}

export function formatTrouvablePriceLabel(
  priceLabel: string,
  currency: TrouvableCurrency,
  locale: TrouvableLocale,
  exchangeRates?: MenuExchangeRates
): string {
  const cadAmount = parseTrouvablePriceLabel(priceLabel);
  return cadAmount === null
    ? priceLabel
    : formatTrouvableAmount(cadAmount, currency, locale, exchangeRates);
}

export function getTrouvableDishConvertedPriceCents(
  dish: PublicMenuDish,
  currency: TrouvableCurrency,
  exchangeRates?: MenuExchangeRates
): number | null {
  const baseCurrency = exchangeRates?.base ?? dish.baseCurrency;
  const rates = exchangeRates?.rates;
  return convertMenuPriceCents({
    priceCents: dish.priceCents,
    sourceCurrency: dish.priceCurrency,
    targetCurrency: currency,
    baseCurrency,
    rates
  });
}

export function formatTrouvableDishPrice(
  dish: PublicMenuDish,
  currency: TrouvableCurrency,
  locale: TrouvableLocale,
  exchangeRates?: MenuExchangeRates
): string {
  return formatMenuPrice({
    priceCents: dish.priceCents,
    sourceCurrency: dish.priceCurrency,
    targetCurrency: currency,
    locale,
    rates: exchangeRates?.rates,
    baseCurrency: exchangeRates?.base ?? dish.baseCurrency,
    displayPriceMode: dish.displayPriceMode,
    fallbackLabel: dish.priceLabel
  });
}

export function formatTrouvablePriceCents(
  priceCents: number,
  currency: TrouvableCurrency,
  locale: TrouvableLocale
): string {
  return formatMenuPriceCents({ priceCents, currency, locale });
}

export function getTrouvableGreetingPeriod(
  date: Date = new Date()
): TrouvableGreetingPeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export function getTrouvableGreeting(
  locale: TrouvableLocale,
  period: TrouvableGreetingPeriod
): string {
  return TROUVABLE_COPY[locale].greeting[period];
}

export function getTrouvableGreetingForDate(
  locale: TrouvableLocale,
  timezone: string,
  date: Date = new Date()
): string {
  return getGreetingForTime(date, publicLocaleToLanguageTag(locale), timezone);
}

export function translateTrouvableCategoryLabel(
  label: string,
  locale: TrouvableLocale
): string {
  const normalized = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return CATEGORY_TRANSLATIONS[normalized]?.[locale] ?? label;
}
