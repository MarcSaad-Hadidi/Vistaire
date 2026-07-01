export const PUBLIC_MENU_LOCALE_OPTIONS = [
  { value: "fr-CA", label: "Francais (Canada)" },
  { value: "en-CA", label: "English (Canada)" },
  { value: "fr-FR", label: "Francais (France)" },
  { value: "en-US", label: "English (United States)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "es-ES", label: "Espanol" },
  { value: "es-MX", label: "Espanol (Mexico)" },
  { value: "pt-BR", label: "Portugues (Brasil)" },
  { value: "pt-PT", label: "Portugues (Portugal)" },
  { value: "it-IT", label: "Italiano" },
  { value: "de-DE", label: "Deutsch" },
  { value: "nl-NL", label: "Nederlands" },
  { value: "ar", label: "العربية" },
  { value: "zh-Hans", label: "中文 (简体)" },
  { value: "zh-Hant", label: "中文 (繁體)" },
  { value: "ja-JP", label: "日本語" },
  { value: "ko-KR", label: "한국어" },
  { value: "hi-IN", label: "हिन्दी" },
  { value: "bn-BD", label: "বাংলা" },
  { value: "pa-IN", label: "ਪੰਜਾਬੀ" },
  { value: "ur-PK", label: "اردو" },
  { value: "tr-TR", label: "Turkce" },
  { value: "ru-RU", label: "Русский" },
  { value: "uk-UA", label: "Українська" },
  { value: "pl-PL", label: "Polski" },
  { value: "ro-RO", label: "Romana" },
  { value: "el-GR", label: "Ελληνικά" },
  { value: "he-IL", label: "עברית" },
  { value: "vi-VN", label: "Tieng Viet" },
  { value: "th-TH", label: "ไทย" },
  { value: "id-ID", label: "Bahasa Indonesia" },
  { value: "ms-MY", label: "Bahasa Melayu" },
  { value: "tl-PH", label: "Filipino" },
  { value: "sv-SE", label: "Svenska" },
  { value: "da-DK", label: "Dansk" },
  { value: "no-NO", label: "Norsk" },
  { value: "fi-FI", label: "Suomi" },
  { value: "cs-CZ", label: "Cestina" },
  { value: "hu-HU", label: "Magyar" }
] as const;
export const PUBLIC_MENU_LOCALES = PUBLIC_MENU_LOCALE_OPTIONS.map(
  (option) => option.value
);
export type PublicMenuLocale = string;

// Keep the picker SSR-safe: Node and browsers expose different Intl currency catalogs.
export const PUBLIC_MENU_CURRENCIES = [
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
];
export type PublicMenuCurrency = string;

export const PUBLIC_MENU_THEME_MODES = ["dark", "light"] as const;
export type PublicMenuThemeMode = (typeof PUBLIC_MENU_THEME_MODES)[number];

export const PUBLIC_MENU_PRICE_DISPLAY_MODES = ["auto", "integer", "decimal"] as const;
export type PublicMenuPriceDisplayMode = (typeof PUBLIC_MENU_PRICE_DISPLAY_MODES)[number];

export const PUBLIC_MENU_STYLE_OPTIONS = ["trouvable", "maison-elyse"] as const;
export type PublicMenuStyle = (typeof PUBLIC_MENU_STYLE_OPTIONS)[number];

export type PublicMenuSettings = {
  defaultLocale: PublicMenuLocale;
  supportedLocales: PublicMenuLocale[];
  baseCurrency: PublicMenuCurrency;
  defaultCurrency: PublicMenuCurrency;
  supportedCurrencies: PublicMenuCurrency[];
  publicMenuStyle: PublicMenuStyle;
  timezone: string;
  defaultThemeMode: PublicMenuThemeMode;
  allowThemeToggle: boolean;
  allowCurrencySelector: boolean;
  allowLanguageSelector: boolean;
  taxIncluded: boolean;
  priceDisplayMode: PublicMenuPriceDisplayMode;
};

export type PublicMenuShortLocale = "fr" | "en";

type NormalizeSettingsOptions = {
  legacyMenuLanguages?: unknown;
};

const DEFAULT_TIMEZONE = "America/Toronto";

export const DEFAULT_PUBLIC_MENU_SETTINGS: PublicMenuSettings = {
  defaultLocale: "fr-CA",
  supportedLocales: ["fr-CA"],
  baseCurrency: "CAD",
  defaultCurrency: "CAD",
  supportedCurrencies: ["CAD"],
  publicMenuStyle: "trouvable",
  timezone: DEFAULT_TIMEZONE,
  defaultThemeMode: "dark",
  allowThemeToggle: true,
  allowCurrencySelector: true,
  allowLanguageSelector: true,
  taxIncluded: true,
  priceDisplayMode: "auto"
};

function objectInput(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

function stringInput(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function arrayInput(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return value.split(",");
    }
  }
  return null;
}

function getArray(candidate: Record<string, unknown>, keys: string[]): unknown[] | null {
  for (const key of keys) {
    const value = arrayInput(candidate[key]);
    if (value) return value;
  }
  return null;
}

function getString(candidate: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = stringInput(candidate[key]);
    if (value) return value;
  }
  return "";
}

function getBoolean(
  candidate: Record<string, unknown>,
  keys: string[],
  fallback: boolean
): boolean {
  for (const key of keys) {
    const value = candidate[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
  }
  return fallback;
}

function hasAnyKey(candidate: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(candidate, key));
}

function uniqueValues<T extends string>(
  values: readonly T[],
  allowedOrder: readonly string[]
): T[] {
  const seen = new Set<T>();
  const filtered = values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });

  return [...filtered].sort(
    (a, b) => {
      const aIndex = allowedOrder.indexOf(a);
      const bIndex = allowedOrder.indexOf(b);
      if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
      if (aIndex >= 0) return -1;
      if (bIndex >= 0) return 1;
      return a.localeCompare(b);
    }
  );
}

export function publicLocaleToShortLocale(
  locale: PublicMenuLocale
): PublicMenuShortLocale {
  return locale.toLowerCase().startsWith("fr") ? "fr" : "en";
}

export function publicLocaleToLanguageTag(locale: PublicMenuShortLocale): PublicMenuLocale {
  return locale === "en" ? "en-CA" : "fr-CA";
}

export function publicLocaleMatchesShortLocale(
  locale: PublicMenuLocale,
  shortLocale: PublicMenuShortLocale
): boolean {
  return publicLocaleToShortLocale(locale) === shortLocale;
}

export function normalizePublicMenuLocale(
  value: unknown,
  fallback: PublicMenuLocale = DEFAULT_PUBLIC_MENU_SETTINGS.defaultLocale
): PublicMenuLocale {
  const normalized = stringInput(value).toLowerCase().replace("_", "-");
  if (normalized === "en") return "en-CA";
  if (normalized === "fr") return "fr-CA";
  try {
    return new Intl.Locale(normalized).toString();
  } catch {
    return fallback;
  }
}

function isPublicMenuLocaleInput(value: unknown): boolean {
  const normalized = stringInput(value).toLowerCase().replace("_", "-");
  if (!normalized) return false;
  if (normalized === "en" || normalized === "fr") return true;
  try {
    new Intl.Locale(normalized);
    return true;
  } catch {
    return false;
  }
}

function normalizeLocaleList(value: unknown, fallback: PublicMenuLocale[]): PublicMenuLocale[] {
  const rawValues = arrayInput(value);
  if (!rawValues) return fallback;
  const normalized = rawValues
    .map((item) => normalizePublicMenuLocale(item, "" as PublicMenuLocale))
    .filter((item): item is PublicMenuLocale => Boolean(item));
  return normalized.length > 0
    ? uniqueValues(normalized, PUBLIC_MENU_LOCALES)
    : fallback;
}

export function normalizePublicMenuCurrency(
  value: unknown,
  fallback: PublicMenuCurrency = DEFAULT_PUBLIC_MENU_SETTINGS.baseCurrency
): PublicMenuCurrency {
  const normalized = stringInput(value).toUpperCase();
  return isPublicMenuCurrencyInput(normalized) ? normalized : fallback;
}

function isPublicMenuCurrencyInput(value: unknown): boolean {
  const normalized = stringInput(value).toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) return false;
  try {
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalized
    }).format(1);
    return true;
  } catch {
    return false;
  }
}

function normalizeCurrencyList(
  value: unknown,
  fallback: PublicMenuCurrency[]
): PublicMenuCurrency[] {
  const rawValues = arrayInput(value);
  if (!rawValues) return fallback;
  const normalized = rawValues
    .map((item) => normalizePublicMenuCurrency(item, "" as PublicMenuCurrency))
    .filter((item): item is PublicMenuCurrency => Boolean(item));
  return normalized.length > 0
    ? uniqueValues(normalized, PUBLIC_MENU_CURRENCIES)
    : fallback;
}

export function isValidPublicMenuTimezone(value: unknown): value is string {
  const timezone = stringInput(value);
  if (!timezone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function normalizeTimezone(value: unknown): string {
  const timezone = stringInput(value);
  return isValidPublicMenuTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
}

function normalizeThemeMode(value: unknown): PublicMenuThemeMode {
  return value === "light" ? "light" : "dark";
}

function normalizePriceDisplayMode(value: unknown): PublicMenuPriceDisplayMode {
  return value === "integer" || value === "decimal" ? value : "auto";
}

export function normalizePublicMenuStyle(value: unknown): PublicMenuStyle {
  return value === "maison-elyse" ? "maison-elyse" : "trouvable";
}

function legacyLanguagesToLocales(value: unknown): PublicMenuLocale[] | null {
  const rawValues = arrayInput(value);
  if (!rawValues) return null;
  const locales = normalizeLocaleList(rawValues, []);
  return locales.length > 0 ? locales : null;
}

export function publicMenuSettingsToLegacyMenuLanguages(
  settings: Pick<PublicMenuSettings, "supportedLocales">
): PublicMenuShortLocale[] {
  const legacyLanguages = settings.supportedLocales
    .filter((locale) => /^fr\b/i.test(locale) || /^en\b/i.test(locale))
    .map(publicLocaleToShortLocale);
  return uniqueValues(legacyLanguages, ["fr", "en"]);
}

export function serializePublicMenuSettings(
  settings: PublicMenuSettings
): PublicMenuSettings {
  return {
    defaultLocale: settings.defaultLocale,
    supportedLocales: [...settings.supportedLocales],
    baseCurrency: settings.baseCurrency,
    defaultCurrency: settings.defaultCurrency,
    supportedCurrencies: [...settings.supportedCurrencies],
    publicMenuStyle: settings.publicMenuStyle,
    timezone: settings.timezone,
    defaultThemeMode: settings.defaultThemeMode,
    allowThemeToggle: settings.allowThemeToggle,
    allowCurrencySelector: settings.allowCurrencySelector,
    allowLanguageSelector: settings.allowLanguageSelector,
    taxIncluded: settings.taxIncluded,
    priceDisplayMode: settings.priceDisplayMode
  };
}

export function normalizePublicMenuSettings(
  input: unknown,
  options: NormalizeSettingsOptions = {}
): PublicMenuSettings {
  const candidate = objectInput(input);
  const candidateIsEmpty = Object.keys(candidate).length === 0;
  const legacyLocales = legacyLanguagesToLocales(options.legacyMenuLanguages);
  const defaultSettings = DEFAULT_PUBLIC_MENU_SETTINGS;

  const supportedLocales = normalizeLocaleList(
    getArray(candidate, ["supportedLocales", "supported_locales", "locales"]) ??
      (candidateIsEmpty ? legacyLocales : null) ??
      defaultSettings.supportedLocales,
    defaultSettings.supportedLocales
  );
  const defaultLocaleCandidate = getString(candidate, [
    "defaultLocale",
    "default_locale",
    "locale"
  ]);
  const defaultLocale = supportedLocales.includes(
    normalizePublicMenuLocale(defaultLocaleCandidate, supportedLocales[0] ?? "fr-CA")
  )
    ? normalizePublicMenuLocale(defaultLocaleCandidate, supportedLocales[0] ?? "fr-CA")
    : supportedLocales[0] ?? "fr-CA";

  let supportedCurrencies = normalizeCurrencyList(
    getArray(candidate, [
      "supportedCurrencies",
      "supported_currencies",
      "currencies"
    ]) ?? defaultSettings.supportedCurrencies,
    defaultSettings.supportedCurrencies
  );
  const baseCurrencyCandidate = normalizePublicMenuCurrency(
    getString(candidate, ["baseCurrency", "base_currency", "currency"]),
    defaultSettings.baseCurrency
  );
  const baseCurrency = supportedCurrencies.includes(baseCurrencyCandidate)
    ? baseCurrencyCandidate
    : supportedCurrencies[0] ?? defaultSettings.baseCurrency;
  if (!supportedCurrencies.includes(baseCurrency)) {
    supportedCurrencies = uniqueValues(
      [...supportedCurrencies, baseCurrency],
      PUBLIC_MENU_CURRENCIES
    );
  }
  const defaultCurrencyCandidate = normalizePublicMenuCurrency(
    getString(candidate, ["defaultCurrency", "default_currency"]),
    baseCurrency
  );
  const defaultCurrency = supportedCurrencies.includes(defaultCurrencyCandidate)
    ? defaultCurrencyCandidate
    : baseCurrency;

  return serializePublicMenuSettings({
    defaultLocale,
    supportedLocales,
    baseCurrency,
    defaultCurrency,
    supportedCurrencies,
    publicMenuStyle: normalizePublicMenuStyle(
      getString(candidate, [
        "publicMenuStyle",
        "public_menu_style",
        "menuStyle",
        "menu_style",
        "menuExperience",
        "menu_experience"
      ])
    ),
    timezone: normalizeTimezone(getString(candidate, ["timezone", "timeZone"])),
    defaultThemeMode: normalizeThemeMode(
      getString(candidate, ["defaultThemeMode", "default_theme_mode", "themeMode"])
    ),
    allowThemeToggle: getBoolean(
      candidate,
      ["allowThemeToggle", "allow_theme_toggle"],
      defaultSettings.allowThemeToggle
    ),
    allowCurrencySelector: getBoolean(
      candidate,
      ["allowCurrencySelector", "allow_currency_selector"],
      defaultSettings.allowCurrencySelector
    ),
    allowLanguageSelector: getBoolean(
      candidate,
      ["allowLanguageSelector", "allow_language_selector"],
      defaultSettings.allowLanguageSelector
    ),
    taxIncluded: getBoolean(
      candidate,
      ["taxIncluded", "tax_included"],
      defaultSettings.taxIncluded
    ),
    priceDisplayMode: normalizePriceDisplayMode(
      getString(candidate, ["priceDisplayMode", "price_display_mode"])
    )
  });
}

function invalidValues(
  rawValues: unknown[] | null,
  validator: (value: unknown) => boolean
): string[] {
  if (!rawValues) return [];
  return rawValues
    .filter((value) => {
      const raw = stringInput(value);
      return !raw || !validator(raw);
    })
    .map((value) => String(value));
}

export function validatePublicMenuSettingsInput(
  input: unknown,
  options: NormalizeSettingsOptions = {}
): { ok: true; value: PublicMenuSettings } | { ok: false; error: string } {
  if (input !== undefined && input !== null && (typeof input !== "object" || Array.isArray(input))) {
    return { ok: false, error: "Settings menu invalides." };
  }

  const candidate = objectInput(input);
  const supportedLocaleInput = getArray(candidate, [
    "supportedLocales",
    "supported_locales",
    "locales"
  ]);
  const supportedCurrencyInput = getArray(candidate, [
    "supportedCurrencies",
    "supported_currencies",
    "currencies"
  ]);

  if (supportedLocaleInput && supportedLocaleInput.length === 0) {
    return { ok: false, error: "Choisissez au moins une langue de menu." };
  }
  const badLocales = invalidValues(
    supportedLocaleInput,
    isPublicMenuLocaleInput
  );
  if (badLocales.length > 0) {
    return { ok: false, error: `Langue non supportee: ${badLocales[0]}.` };
  }

  if (supportedCurrencyInput && supportedCurrencyInput.length === 0) {
    return { ok: false, error: "Choisissez au moins une devise de menu." };
  }
  const badCurrencies = invalidValues(
    supportedCurrencyInput,
    isPublicMenuCurrencyInput
  );
  if (badCurrencies.length > 0) {
    return { ok: false, error: `Devise non supportee: ${badCurrencies[0]}.` };
  }

  const settings = normalizePublicMenuSettings(candidate, options);
  if (
    hasAnyKey(candidate, ["defaultLocale", "default_locale", "locale"]) &&
    (!isPublicMenuLocaleInput(getString(candidate, ["defaultLocale", "default_locale", "locale"])) ||
      !settings.supportedLocales.includes(
        normalizePublicMenuLocale(getString(candidate, ["defaultLocale", "default_locale", "locale"]))
      ))
  ) {
    return { ok: false, error: "La langue par defaut doit etre activee." };
  }
  if (
    hasAnyKey(candidate, ["baseCurrency", "base_currency", "currency"]) &&
    (!isPublicMenuCurrencyInput(getString(candidate, ["baseCurrency", "base_currency", "currency"])) ||
      !settings.supportedCurrencies.includes(
        normalizePublicMenuCurrency(getString(candidate, ["baseCurrency", "base_currency", "currency"]))
      ))
  ) {
    return { ok: false, error: "La devise de base doit etre activee." };
  }
  if (
    hasAnyKey(candidate, ["defaultCurrency", "default_currency"]) &&
    (!isPublicMenuCurrencyInput(getString(candidate, ["defaultCurrency", "default_currency"])) ||
      !settings.supportedCurrencies.includes(
        normalizePublicMenuCurrency(getString(candidate, ["defaultCurrency", "default_currency"]))
      ))
  ) {
    return { ok: false, error: "La devise par defaut doit etre activee." };
  }
  if (
    hasAnyKey(candidate, ["timezone", "timeZone"]) &&
    !isValidPublicMenuTimezone(getString(candidate, ["timezone", "timeZone"]))
  ) {
    return { ok: false, error: "Timezone restaurant invalide." };
  }
  if (
    hasAnyKey(candidate, ["defaultThemeMode", "default_theme_mode", "themeMode"]) &&
    !PUBLIC_MENU_THEME_MODES.includes(
      getString(candidate, ["defaultThemeMode", "default_theme_mode", "themeMode"]) as PublicMenuThemeMode
    )
  ) {
    return { ok: false, error: "Theme par defaut invalide." };
  }
  if (
    hasAnyKey(candidate, [
      "publicMenuStyle",
      "public_menu_style",
      "menuStyle",
      "menu_style",
      "menuExperience",
      "menu_experience"
    ]) &&
    !PUBLIC_MENU_STYLE_OPTIONS.includes(
      getString(candidate, [
        "publicMenuStyle",
        "public_menu_style",
        "menuStyle",
        "menu_style",
        "menuExperience",
        "menu_experience"
      ]) as PublicMenuStyle
    )
  ) {
    return { ok: false, error: "Style du menu public invalide." };
  }

  return { ok: true, value: settings };
}

export function normalizePublicMenuLocalePreference(
  value: unknown,
  settings: PublicMenuSettings
): PublicMenuLocale {
  const locale = normalizePublicMenuLocale(value, settings.defaultLocale);
  if (settings.supportedLocales.includes(locale)) return locale;
  const shortLocale = publicLocaleToShortLocale(locale);
  return (
    settings.supportedLocales.find((supportedLocale) =>
      publicLocaleMatchesShortLocale(supportedLocale, shortLocale)
    ) ?? settings.defaultLocale
  );
}

export function normalizePublicMenuCurrencyPreference(
  value: unknown,
  settings: PublicMenuSettings
): PublicMenuCurrency {
  const currency = normalizePublicMenuCurrency(value, settings.defaultCurrency);
  return settings.supportedCurrencies.includes(currency)
    ? currency
    : settings.defaultCurrency;
}

export function normalizePublicMenuThemePreference(
  value: unknown,
  settings: PublicMenuSettings
): PublicMenuThemeMode {
  if (!settings.allowThemeToggle) return settings.defaultThemeMode;
  return value === "light" || value === "dark" ? value : settings.defaultThemeMode;
}
