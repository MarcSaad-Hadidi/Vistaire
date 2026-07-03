import type { Locale } from "../i18n.ts";
import {
  formatPriceCentsForMenu,
  type DisplayPriceMode
} from "../owner/price.ts";
import { normalizeModelAssetBytes } from "../owner/modelAssetSize.ts";
import {
  normalizePublicMenuCurrency,
  normalizePublicMenuLocale,
  normalizePublicMenuSettings,
  type PublicMenuCurrency,
  type PublicMenuPriceDisplayMode,
  type PublicMenuSettings
} from "./publicMenuSettings.ts";

export type PublicMenuDish = {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId?: string;
  category: string;
  categoryDescription?: string;
  priceLabel: string;
  priceCents: number;
  priceCurrency: PublicMenuCurrency;
  baseCurrency: PublicMenuCurrency;
  displayPriceMode: PublicMenuPriceDisplayMode;
  originalPriceCents?: number;
  calories?: number;
  spiceLevel?: number;
  dietaryType?: string;
  imageUrl: string;
  thumbnailUrl: string;
  hasPhoto: boolean;
  photoStatus: "ready" | "missing" | "planned" | "draft" | "unknown";
  hasImmersive: boolean;
  has3d: boolean;
  hasAr: boolean;
  hasIosAr: boolean;
  hasAndroidAr: boolean;
  model3dUrl: string;
  webModel3dUrl: string;
  webModel3dBytes: number;
  arModel3dUrl: string;
  arModel3dBytes: number;
  usdzUrl: string;
  arUsdzUrl: string;
  arUsdzBytes: number;
  posterUrl: string;
  modelAssetVersion?: string;
  modelAssetSha256?: string;
  modelUpdatedAt?: string;
  preparedGlbJobId?: string;
  preparedGlbStoragePath?: string;
  modelStatus:
    | "ready"
    | "missing"
    | "draft"
    | "unknown"
    | "web_ready_usdz_pending"
    | "pending_manual_usdz"
    | "usdz_conversion_failed";
  available: boolean;
  ingredients: string[];
  allergens: string[];
  options: string[];
  houseNote: string;
  tags: string[];
};

export type GoogleReviewConfig = {
  enabled: boolean;
  googleReviewUrl: string;
  googleRating?: number;
  googleReviewCount?: number;
  presentationOnly?: boolean;
};

export type GoogleReviewCta = {
  href: string;
  googleRating?: number;
  googleReviewCount?: number;
};

export type PublicMenu = {
  restaurantId: string;
  menuId?: string;
  menuName?: string;
  slug: string;
  name: string;
  location: string;
  cuisineType: string;
  googleReview: GoogleReviewConfig;
  settings: PublicMenuSettings;
  activeLocale?: string;
  translationStatus?: {
    locale: string;
    status: "source" | "missing" | "pending" | "in_progress" | "up_to_date" | "stale" | "error";
  };
  localizedUiCopy?: Record<string, unknown>;
  publicMenuStyleExplicit?: boolean;
  source: "supabase" | "demo";
  dishes: PublicMenuDish[];
};

export type PublicMenuContextQuery = {
  lang?: Locale | string;
  table?: string;
  zone?: string;
  view?: string;
};

export type PublicMenuCategory = {
  id: string;
  label: string;
  description: string;
  tone: "blue" | "green" | "yellow" | "red";
  count: number;
};

export type PublicMenuRow = Record<string, unknown>;

const PUBLIC_MENU_OPTION_FIELD_KEYS = [
  "options",
  "option_list",
  "extras",
  "accompaniments"
];

const CATEGORY_DEFINITIONS = [
  {
    id: "entrees",
    label: "Entrées",
    description: "Pour commencer doucement",
    tone: "blue"
  },
  {
    id: "plats",
    label: "Plats",
    description: "Nos assiettes maison",
    tone: "green"
  },
  {
    id: "plats-signatures",
    label: "Signatures",
    description: "Les plats de la maison",
    tone: "green"
  },
  {
    id: "desserts",
    label: "Desserts",
    description: "Une touche sucrée",
    tone: "yellow"
  },
  {
    id: "cocktails",
    label: "Cocktails",
    description: "Classiques et creations du bar",
    tone: "red"
  },
  {
    id: "boissons",
    label: "Boissons",
    description: "Frais et simple",
    tone: "red"
  }
] as const;

const DEFAULT_CATEGORY = {
  id: "carte",
  label: "Carte",
  description: "La sélection du moment",
  tone: "blue"
} as const;

const RESTAURANT_ID_KEYS = [
  "restaurant_id",
  "restaurantId",
  "restaurant_uuid",
  "restaurant"
];

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getString(row: PublicMenuRow, candidates: string[], fallback = ""): string {
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function getNumber(row: PublicMenuRow, candidates: string[], fallback = 0): number {
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

function getBoolean(row: PublicMenuRow, candidates: string[]): boolean | null {
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "available") return true;
      if (
        normalized === "false" ||
        normalized === "unavailable" ||
        normalized === "archived" ||
        normalized === "paused"
      ) {
        return false;
      }
    }
  }
  return null;
}

function objectInput(input: unknown): PublicMenuRow {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as PublicMenuRow)
    : {};
}

function getObject(row: PublicMenuRow, candidates: string[]): PublicMenuRow {
  for (const key of candidates) {
    const value = row[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as PublicMenuRow;
    }
    if (typeof value === "string" && value.trim()) {
      try {
        const parsed: unknown = JSON.parse(value);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as PublicMenuRow;
        }
      } catch {
        // Non-JSON metadata is ignored.
      }
    }
  }
  return {};
}

function isAllowedGoogleReviewUrl(parsed: URL): boolean {
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "search.google.com") {
    return (
      parsed.pathname === "/local/writereview" &&
      Boolean(parsed.searchParams.get("placeid")?.trim())
    );
  }
  if (hostname === "g.page") {
    return parsed.pathname
      .split("/")
      .filter(Boolean)
      .some((segment) => segment.toLowerCase() === "review");
  }
  return false;
}

function cleanGoogleReviewUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";

  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol === "https:" && !parsed.username && !parsed.password) {
      return isAllowedGoogleReviewUrl(parsed) ? parsed.toString() : "";
    }
  } catch {
    return "";
  }

  return "";
}

function cleanGoogleRating(value: unknown): number | undefined {
  const rating =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) return undefined;
  return Math.round(rating * 10) / 10;
}

function cleanGoogleReviewCount(value: unknown): number | undefined {
  const count =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(count) || count < 0) return undefined;
  return Math.min(10_000_000, Math.floor(count));
}

export function normalizeGoogleReviewConfig(
  input: unknown
): GoogleReviewConfig {
  const candidate = objectInput(input);
  const googleReviewUrl = cleanGoogleReviewUrl(
    getString(candidate, ["googleReviewUrl", "google_review_url", "url"], "")
  );
  const googleRating = cleanGoogleRating(
    candidate.googleRating ?? candidate.google_rating
  );
  const googleReviewCount = cleanGoogleReviewCount(
    candidate.googleReviewCount ?? candidate.google_review_count
  );
  const presentationOnly =
    getBoolean(candidate, ["presentationOnly", "presentation_only"]) ?? false;

  return {
    enabled: getBoolean(candidate, ["enabled"]) ?? false,
    googleReviewUrl,
    ...(googleRating === undefined ? {} : { googleRating }),
    ...(googleReviewCount === undefined ? {} : { googleReviewCount }),
    ...(presentationOnly ? { presentationOnly } : {})
  };
}

export function getGoogleReviewCta(
  config: GoogleReviewConfig | null | undefined
): GoogleReviewCta | null {
  const normalized = normalizeGoogleReviewConfig(config);
  if (!normalized.enabled || !normalized.googleReviewUrl) return null;

  return {
    href: normalized.googleReviewUrl,
    ...(normalized.googleRating === undefined
      ? {}
      : { googleRating: normalized.googleRating }),
    ...(normalized.googleReviewCount === undefined
      ? {}
      : { googleReviewCount: normalized.googleReviewCount })
  };
}

function googleReviewConfigFromRestaurantRow(
  row: PublicMenuRow
): GoogleReviewConfig {
  const nested = objectInput(
    row.googleReview ?? row.google_review ?? row.google_reviews
  );

  return normalizeGoogleReviewConfig({
    enabled:
      nested.enabled ??
      row.google_review_enabled ??
      row.googleReviewEnabled ??
      row.google_reviews_enabled,
    googleReviewUrl:
      nested.googleReviewUrl ??
      nested.google_review_url ??
      nested.url ??
      row.google_review_url ??
      row.googleReviewUrl ??
      row.google_reviews_url,
    googleRating:
      nested.googleRating ??
      nested.google_rating ??
      row.google_rating ??
      row.googleRating,
    googleReviewCount:
      nested.googleReviewCount ??
      nested.google_review_count ??
      row.google_review_count ??
      row.googleReviewCount
  });
}

function getStringList(row: PublicMenuRow, candidates: string[]): string[] {
  for (const key of candidates) {
    const value = row[key];
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean);
    }
    if (typeof value === "string" && value.trim()) {
      const trimmed = value.trim();
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => String(item ?? "").trim())
            .filter(Boolean);
        }
      } catch {
        // Plain comma/semicolon/newline lists are accepted below.
      }
      return trimmed
        .split(/[,;\n]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function getStringListFromSources(
  row: PublicMenuRow,
  metadata: PublicMenuRow,
  candidates: string[]
): string[] {
  const metadataList = getStringList(metadata, candidates);
  return metadataList.length > 0 ? metadataList : getStringList(row, candidates);
}

function mergeStringLists(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const list of lists) {
    for (const item of list) {
      const value = String(item ?? "").trim();
      const key = value.toLowerCase();
      if (!value || seen.has(key)) continue;
      seen.add(key);
      values.push(value);
    }
  }
  return values;
}

function isSafePublicMediaUrl(url: string): boolean {
  if (!url) return false;
  if (url.includes("\\")) return false;
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) {
    return true;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function getSafeString(row: PublicMenuRow, candidates: string[]): string {
  const url = getString(row, candidates, "");
  return isSafePublicMediaUrl(url) ? url : "";
}

function getSafeStringFromSources(
  row: PublicMenuRow,
  metadata: PublicMenuRow,
  candidates: string[]
): string {
  return getSafeString(row, candidates) || getSafeString(metadata, candidates);
}

function getNumberFromSources(
  row: PublicMenuRow,
  metadata: PublicMenuRow,
  candidates: string[]
): number {
  return getNumber(row, candidates, 0) || getNumber(metadata, candidates, 0);
}

function displayPriceMode(value: unknown): DisplayPriceMode {
  return value === "integer" || value === "decimal" || value === "auto"
    ? value
    : "auto";
}

function getDisplayPriceMode(row: PublicMenuRow, metadata: PublicMenuRow): PublicMenuPriceDisplayMode {
  return displayPriceMode(
    metadata.displayPriceMode ??
      metadata.display_price_mode ??
      row.displayPriceMode ??
      row.display_price_mode
  ) as PublicMenuPriceDisplayMode;
}

function getPriceCents(row: PublicMenuRow): number {
  const priceCents = getNumber(row, ["price_cents", "priceCents"], 0);
  if (priceCents > 0) return Math.round(priceCents);
  const value = getNumber(row, ["price", "amount", "price_cad"], 0);
  return value > 0 ? Math.round(value * 100) : 0;
}

function formatPrice(row: PublicMenuRow, settings: PublicMenuSettings): string {
  const metadata = getObject(row, ["metadata", "meta"]);
  const priceCents = getPriceCents(row);
  const currency = normalizePublicMenuCurrency(
    getString(row, ["currency"], settings.baseCurrency),
    settings.baseCurrency
  );
  if (priceCents > 0) {
    return formatPriceCentsForMenu(priceCents, currency, {
      displayPriceMode: getDisplayPriceMode(row, metadata)
    });
  }

  return "";
}

function categoryDefinition(category: string) {
  const normalized = slugify(category);
  return (
    CATEGORY_DEFINITIONS.find((definition) => definition.id === normalized) ??
    null
  );
}

function normalizeCategory(category: string): string {
  const definition = categoryDefinition(category);
  return definition?.label ?? (category.trim() || DEFAULT_CATEGORY.label);
}

function categoryDefinitionById(categoryId: string) {
  return (
    CATEGORY_DEFINITIONS.find((definition) => definition.id === categoryId) ??
    null
  );
}

function publicMenuCategoryId(dish: PublicMenuDish): string {
  const categoryId = dish.categoryId?.trim();
  if (categoryId) return categoryId;
  const category = dish.category || DEFAULT_CATEGORY.label;
  return (
    categoryDefinition(category)?.id ??
    slugify(category) ??
    DEFAULT_CATEGORY.id
  );
}

function publicMenuCategoryLabel(dishes: PublicMenuDish[]): string {
  const latestLabel = [...dishes]
    .reverse()
    .find((dish) => dish.category.trim())?.category;
  const label = latestLabel || DEFAULT_CATEGORY.label;
  return dishes.some((dish) => dish.categoryDescription)
    ? label
    : normalizeCategory(label);
}

function isDishAvailable(row: PublicMenuRow): boolean {
  const available = getBoolean(row, [
    "available",
    "is_available",
    "isAvailable",
    "enabled",
    "active",
    "status"
  ]);
  return available !== false;
}

function includeDishRow(
  row: PublicMenuRow,
  options: { includeUnavailableDishes?: boolean } = {}
): boolean {
  return options.includeUnavailableDishes || isDishAvailable(row);
}

function dishSortOrder(row: PublicMenuRow, index: number): number {
  const sortOrder = getNumber(row, ["sort_order", "sortOrder", "position"], 0);
  return sortOrder > 0 ? sortOrder : 10_000 + index;
}

function rowMatchesValue(
  row: PublicMenuRow,
  candidates: string[],
  expected: string
): boolean {
  if (!expected) return false;
  return candidates.some((key) => String(row[key] ?? "") === expected);
}

function rowRestaurantId(row: PublicMenuRow): string {
  return getString(row, RESTAURANT_ID_KEYS, "");
}

function getOptionalNumberFromSources(
  row: PublicMenuRow,
  metadata: PublicMenuRow,
  candidates: string[]
): number | undefined {
  const value = getNumberFromSources(row, metadata, candidates);
  return value > 0 ? value : undefined;
}

function mapDishRow(
  row: PublicMenuRow,
  index: number,
  settings: PublicMenuSettings
): PublicMenuDish {
  const metadata = getObject(row, ["metadata", "meta"]);
  const name = getString(row, ["name", "dish_name", "title"], "Plat");
  const categoryId = getString(row, ["category_id", "categoryId"], "");
  const priceCents = getPriceCents(row);
  const priceCurrency = normalizePublicMenuCurrency(
    getString(row, ["currency"], settings.baseCurrency),
    settings.baseCurrency
  );
  const originalPriceCents = getOptionalNumberFromSources(row, metadata, [
    "original_price_cents",
    "originalPriceCents",
    "promo_original_price_cents",
    "promoOriginalPriceCents"
  ]);
  const calories = getOptionalNumberFromSources(row, metadata, ["calories"]);
  const spiceLevel = getOptionalNumberFromSources(row, metadata, [
    "spiceLevel",
    "spice_level",
    "spicy"
  ]);
  const dietaryType = getString(
    metadata,
    ["dietaryType", "dietary_type", "veg", "vegetarian"],
    ""
  );
  const imageUrl = getSafeStringFromSources(row, metadata, [
    "image",
    "image_url",
    "imageUrl",
    "photo_url",
    "photoUrl"
  ]);
  const thumbnailUrl =
    getSafeStringFromSources(row, metadata, [
      "thumbnail_url",
      "thumbnailUrl"
    ]) || imageUrl;
  const model3dUrl = getSafeStringFromSources(row, metadata, ["model3dUrl", "model3d_url"]);
  const webModel3dUrl =
    getSafeStringFromSources(row, metadata, ["webModel3dUrl", "web_model_3d_url"]) ||
    model3dUrl;
  const arModel3dUrl = getSafeStringFromSources(row, metadata, [
    "arModel3dUrl",
    "ar_model_3d_url"
  ]);
  const usdzUrl = getSafeStringFromSources(row, metadata, ["usdzUrl", "usdz_url"]);
  const arUsdzUrl =
    getSafeStringFromSources(row, metadata, [
      "arUsdzUrl",
      "ar_usdz_url",
      "iosUsdzUrl",
      "ios_usdz_url"
    ]) || usdzUrl;
  const webModel3dBytes = normalizeModelAssetBytes(
    getNumberFromSources(row, metadata, [
      "webModel3dBytes",
      "web_model_3d_bytes",
      "webGlbBytes",
      "web_glb_bytes",
      "meshoptBytes",
      "meshopt_bytes"
    ])
  );
  const arModel3dBytes = normalizeModelAssetBytes(
    getNumberFromSources(row, metadata, [
      "arModel3dBytes",
      "ar_model_3d_bytes",
      "arLiteGlbBytes",
      "ar_lite_glb_bytes",
      "arLiteBytes",
      "ar_lite_bytes"
    ])
  );
  const arUsdzBytes = normalizeModelAssetBytes(
    getNumberFromSources(row, metadata, [
      "arUsdzBytes",
      "ar_usdz_bytes",
      "iosUsdzBytes",
      "ios_usdz_bytes",
      "usdzBytes",
      "usdz_bytes"
    ])
  );
  const posterUrl = getSafeStringFromSources(row, metadata, [
    "poster_url",
    "posterUrl",
    "model_poster_url",
    "modelPosterUrl"
  ]);
  const preparedGlbJobId = getString(metadata, ["preparedGlbJobId", "prepared_glb_job_id"], "");
  const preparedGlbStoragePath = getString(metadata, [
    "preparedGlbStoragePath",
    "prepared_glb_storage_path"
  ]);
  const modelAssetVersion = getString(metadata, ["modelAssetVersion", "model_asset_version"], "");
  const modelAssetSha256 = getString(metadata, ["modelAssetSha256", "model_asset_sha256"], "");
  const modelUpdatedAt = getString(metadata, ["modelUpdatedAt", "model_updated_at"], "");
  const hasImmersiveFlag = getBoolean(row, ["has_immersive_view", "hasImmersiveView"]);
  const has3d = Boolean(model3dUrl || webModel3dUrl || arModel3dUrl || hasImmersiveFlag);
  const hasIosAr = Boolean(arUsdzUrl || usdzUrl);
  const hasAndroidAr = Boolean(arModel3dUrl);
  const hasAr = hasIosAr || hasAndroidAr;
  const slug = slugify(
    getString(row, ["slug", "dish_slug", "dishSlug"], name)
  );

  return {
    id: getString(row, ["id", "dish_id", "slug", "dish_slug"], `dish-${index}`),
    slug: slug || `dish-${index}`,
    name,
    description: getString(row, ["short_description", "shortDescription", "description", "desc", "summary"], ""),
    ...(categoryId ? { categoryId } : {}),
    category:
      getString(
        row,
        ["category_name", "categoryName", "category", "category_slug"],
        DEFAULT_CATEGORY.label
      ) || DEFAULT_CATEGORY.label,
    categoryDescription: getString(row, ["category_description", "categoryDescription"], ""),
    priceLabel: formatPrice(row, settings),
    priceCents,
    priceCurrency,
    baseCurrency: settings.baseCurrency,
    displayPriceMode: getDisplayPriceMode(row, metadata),
    ...(originalPriceCents ? { originalPriceCents } : {}),
    ...(calories ? { calories } : {}),
    ...(spiceLevel ? { spiceLevel } : {}),
    ...(dietaryType ? { dietaryType } : {}),
    imageUrl,
    thumbnailUrl,
    hasPhoto: Boolean(imageUrl),
    photoStatus:
      getString(metadata, ["photoStatus", "photo_status"], "") === "ready" || imageUrl
        ? "ready"
        : getString(metadata, ["photoStatus", "photo_status"], "") === "planned"
          ? "planned"
          : getString(row, ["photo_status", "photoStatus"], "") === "draft"
            ? "draft"
            : "missing",
    hasImmersive: has3d || hasAr,
    has3d,
    hasAr,
    hasIosAr,
    hasAndroidAr,
    model3dUrl,
    webModel3dUrl,
    webModel3dBytes,
    arModel3dUrl,
    arModel3dBytes,
    usdzUrl,
    arUsdzUrl,
    arUsdzBytes,
    posterUrl,
    ...(modelAssetVersion ? { modelAssetVersion } : {}),
    ...(modelAssetSha256 ? { modelAssetSha256 } : {}),
    ...(modelUpdatedAt ? { modelUpdatedAt } : {}),
    preparedGlbJobId,
    preparedGlbStoragePath,
    modelStatus:
      getString(metadata, ["modelStatus", "model_status"], "") === "ready"
        ? "ready"
        : getString(metadata, ["modelStatus", "model_status"], "") === "web_ready_usdz_pending"
          ? "web_ready_usdz_pending"
          : getString(metadata, ["modelStatus", "model_status"], "") === "pending_manual_usdz"
            ? "pending_manual_usdz"
            : getString(metadata, ["modelStatus", "model_status"], "") === "usdz_conversion_failed"
              ? "usdz_conversion_failed"
              : has3d || hasAr
                ? "ready"
                : "missing",
    available: isDishAvailable(row),
    ingredients: getStringListFromSources(row, metadata, ["ingredients", "ingredient_list"]),
    allergens: getStringListFromSources(row, metadata, ["allergens", "allergenes", "allergen_list"]),
    options: mergeStringLists(
      getStringList(row, PUBLIC_MENU_OPTION_FIELD_KEYS.slice(0, 2)),
      getStringList(row, PUBLIC_MENU_OPTION_FIELD_KEYS.slice(2, 3)),
      getStringList(row, PUBLIC_MENU_OPTION_FIELD_KEYS.slice(3, 4)),
      getStringList(metadata, PUBLIC_MENU_OPTION_FIELD_KEYS.slice(0, 2)),
      getStringList(metadata, PUBLIC_MENU_OPTION_FIELD_KEYS.slice(2, 3)),
      getStringList(metadata, PUBLIC_MENU_OPTION_FIELD_KEYS.slice(3, 4))
    ),
    houseNote:
      getString(metadata, ["chefNote", "chef_note", "houseNote", "house_note"], "") ||
      getString(row, [
        "house_note",
        "houseNote",
        "chef_note",
        "chefNote",
        "note"
      ]),
    tags: mergeStringLists(
      getStringListFromSources(row, metadata, ["tags", "labels"]),
      getStringList(metadata, ["badges"]),
      getBoolean(row, ["is_signature", "isSignature"]) ? ["Signature"] : [],
      getBoolean(row, ["is_recommended", "isRecommended"]) ? ["Recommande"] : []
    )
  };
}

function rowMatchesMenu(row: PublicMenuRow, menuId: string): boolean {
  return !menuId || getString(row, ["menu_id", "menuId"], "") === menuId;
}

function rowMatchesRestaurant(row: PublicMenuRow, restaurantId: string): boolean {
  return !restaurantId || getString(row, RESTAURANT_ID_KEYS, "") === restaurantId;
}

type MenuSettingsCandidate = {
  rawSettings: PublicMenuRow;
  updatedAtMs: number | null;
};

function parseUpdatedAtMs(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowUpdatedAtMs(row: PublicMenuRow): number | null {
  return parseUpdatedAtMs(row.updated_at ?? row.updatedAt);
}

function settingsCandidateFromLegacyInput(value: unknown): MenuSettingsCandidate | null {
  const input = objectInput(value);
  const nestedSettings = objectInput(input.settings);
  const rawSettings =
    Object.keys(nestedSettings).length > 0 ? nestedSettings : input;
  if (Object.keys(rawSettings).length === 0) return null;

  return {
    rawSettings,
    updatedAtMs: parseUpdatedAtMs(input.updatedAt ?? input.updated_at)
  };
}

function settingsCandidateFromMenuRow(
  menuRow?: PublicMenuRow | null
): MenuSettingsCandidate | null {
  const row = menuRow ?? {};
  const nativeSettings = getObject(row, ["settings_json", "settingsJson"]);
  const metadata = getObject(row, ["metadata", "meta"]);
  const metadataSettings = getObject(metadata, [
    "publicMenuSettings",
    "public_menu_settings",
    "settings"
  ]);
  const rawSettings =
    Object.keys(nativeSettings).length > 0
      ? nativeSettings
      : Object.keys(metadataSettings).length > 0
        ? metadataSettings
        : {};
  if (Object.keys(rawSettings).length === 0) return null;

  return {
    rawSettings,
    updatedAtMs: rowUpdatedAtMs(row)
  };
}

function resolveMenuSettingsCandidate(args: {
  menuRow?: PublicMenuRow | null;
  legacyPublicMenuSettings?: unknown;
}): MenuSettingsCandidate {
  const menuCandidate = settingsCandidateFromMenuRow(args.menuRow);
  const uiConfigCandidate = settingsCandidateFromLegacyInput(
    args.legacyPublicMenuSettings
  );

  if (menuCandidate && uiConfigCandidate) {
    if (
      menuCandidate.updatedAtMs !== null &&
      uiConfigCandidate.updatedAtMs !== null
    ) {
      return uiConfigCandidate.updatedAtMs > menuCandidate.updatedAtMs
        ? uiConfigCandidate
        : menuCandidate;
    }
    // Once menus.settings_json exists, owner saves target the menu row first.
    // Without comparable timestamps, do not let a legacy UI config mask it.
    return menuCandidate;
  }

  return menuCandidate ?? uiConfigCandidate ?? { rawSettings: {}, updatedAtMs: null };
}

function menuSettingsFromRows(args: {
  menuRow?: PublicMenuRow | null;
  legacyPublicMenuSettings?: unknown;
  legacyMenuLanguages?: unknown;
}): PublicMenuSettings {
  const rawSettings = resolveMenuSettingsCandidate(args).rawSettings;
  const isEmptySettings = Object.keys(rawSettings).length === 0;
  return normalizePublicMenuSettings(rawSettings, {
    legacyMenuLanguages: isEmptySettings ? args.legacyMenuLanguages : undefined
  });
}

function settingsInputHasPublicMenuStyle(rawSettings: PublicMenuRow): boolean {
  return (
    Object.prototype.hasOwnProperty.call(rawSettings, "publicMenuStyle") ||
    Object.prototype.hasOwnProperty.call(rawSettings, "public_menu_style") ||
    Object.prototype.hasOwnProperty.call(rawSettings, "menuStyle") ||
    Object.prototype.hasOwnProperty.call(rawSettings, "menu_style") ||
    Object.prototype.hasOwnProperty.call(rawSettings, "menuExperience") ||
    Object.prototype.hasOwnProperty.call(rawSettings, "menu_experience")
  );
}

function menuRowHasPublicMenuStyle(
  menuRow?: PublicMenuRow | null,
  legacyPublicMenuSettings?: unknown
): boolean {
  return settingsInputHasPublicMenuStyle(
    resolveMenuSettingsCandidate({
      menuRow,
      legacyPublicMenuSettings
    }).rawSettings
  );
}

export function getPublicMenuRowSlug(row: PublicMenuRow): string {
  const name = getString(row, ["name", "restaurant_name"], "");
  return getString(row, ["slug", "restaurant_slug"], slugify(name));
}

export function buildSupabasePublicMenu(
  rawSlug: string,
  restaurantRow: PublicMenuRow,
  dishRows: PublicMenuRow[],
  options: {
    includeUnavailableDishes?: boolean;
    legacyPublicMenuSettings?: unknown;
    legacyMenuLanguages?: unknown;
  } = {}
): PublicMenu {
  const slug = getPublicMenuRowSlug(restaurantRow) || slugify(rawSlug);
  const restaurantId = getString(restaurantRow, ["id", "restaurant_id"], "");
  const settings = menuSettingsFromRows({
    legacyPublicMenuSettings: options.legacyPublicMenuSettings,
    legacyMenuLanguages: options.legacyMenuLanguages
  });
  const rowsById = restaurantId
    ? dishRows.filter((row) =>
        rowMatchesValue(row, RESTAURANT_ID_KEYS, restaurantId)
      )
    : [];
  const rowsBySlug = dishRows.filter((row) =>
    rowMatchesValue(row, ["restaurant_slug", "restaurantSlug"], slug)
  );
  const slugRowsWithoutConflictingId = rowsBySlug.filter((row) => {
    const dishRestaurantId = rowRestaurantId(row);
    return !dishRestaurantId || dishRestaurantId === restaurantId;
  });
  const scopedRows =
    restaurantId
      ? rowsById.length > 0
        ? rowsById
        : slugRowsWithoutConflictingId
      : rowsBySlug;

  const dishes = scopedRows
    .filter((row) => includeDishRow(row, options))
    .map((row, index) => ({ row, index, order: dishSortOrder(row, index) }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .slice(0, 200)
    .map(({ row, index }) => mapDishRow(row, index, settings));

  return {
    restaurantId,
    slug,
    name: getString(restaurantRow, ["name", "restaurant_name"], "Restaurant"),
    location: getString(restaurantRow, ["location", "city", "address"], ""),
    cuisineType: getString(restaurantRow, ["cuisine_type", "cuisineType"], ""),
    googleReview: googleReviewConfigFromRestaurantRow(restaurantRow),
    settings,
    publicMenuStyleExplicit: settingsInputHasPublicMenuStyle(
      resolveMenuSettingsCandidate({
        legacyPublicMenuSettings: options.legacyPublicMenuSettings
      }).rawSettings
    ),
    source: "supabase",
    dishes
  };
}

export function buildRelationalSupabasePublicMenu(args: {
  slug: string;
  restaurantRow: PublicMenuRow;
  menuRow?: PublicMenuRow | null;
  categoryRows?: PublicMenuRow[];
  dishRows?: PublicMenuRow[];
  includeUnavailableDishes?: boolean;
  legacyPublicMenuSettings?: unknown;
  legacyMenuLanguages?: unknown;
}): PublicMenu {
  const slug = getPublicMenuRowSlug(args.restaurantRow) || slugify(args.slug);
  const restaurantId = getString(args.restaurantRow, ["id", "restaurant_id"], "");
  const menuId = getString(args.menuRow ?? {}, ["id", "menu_id"], "");
  const settings = menuSettingsFromRows({
    menuRow: args.menuRow,
    legacyPublicMenuSettings: args.legacyPublicMenuSettings,
    legacyMenuLanguages: args.legacyMenuLanguages
  });
  const categoryRows = (args.categoryRows ?? [])
    .filter((row) => rowMatchesRestaurant(row, restaurantId))
    .filter((row) => rowMatchesMenu(row, menuId))
    .map((row, index) => ({
      row,
      id: getString(row, ["id", "category_id"], ""),
      order: getNumber(row, ["display_order", "displayOrder", "sort_order", "position"], index + 1)
    }))
    .sort((a, b) => a.order - b.order);
  const categoryById = new Map(categoryRows.map((entry) => [entry.id, entry]));
  const categoryOrderById = new Map(categoryRows.map((entry, index) => [entry.id, index + 1]));

  const dishes = (args.dishRows ?? [])
    .filter((row) => rowMatchesRestaurant(row, restaurantId))
    .filter((row) => rowMatchesMenu(row, menuId))
    .filter((row) => includeDishRow(row, args))
    .map((row, index) => {
      const categoryId = getString(row, ["category_id", "categoryId"], "");
      const category = categoryById.get(categoryId);
      const categoryRow = category?.row ?? {};
      return {
        row: {
          ...row,
          category_name:
            getString(categoryRow, ["name", "label"], "") ||
            getString(row, ["category_name", "categoryName", "category"], DEFAULT_CATEGORY.label),
          category_description: getString(categoryRow, ["description"], ""),
          category_slug: getString(categoryRow, ["slug"], "")
        },
        index,
        order:
          (categoryOrderById.get(categoryId) ?? 1000) * 10_000 +
          dishSortOrder(row, index)
      };
    })
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .slice(0, 200)
    .map(({ row, index }) => mapDishRow(row, index, settings));

  return {
    restaurantId,
    menuId: getString(args.menuRow ?? {}, ["id", "menu_id", "menuId"], "") || undefined,
    menuName: getString(args.menuRow ?? {}, ["name", "menu_name", "title"], "") || undefined,
    slug,
    name: getString(args.restaurantRow, ["name", "restaurant_name"], "Restaurant"),
    location: getString(args.restaurantRow, ["location", "city", "address"], ""),
    cuisineType: getString(args.restaurantRow, ["cuisine_type", "cuisineType"], ""),
    googleReview: googleReviewConfigFromRestaurantRow(args.restaurantRow),
    settings,
    publicMenuStyleExplicit: menuRowHasPublicMenuStyle(
      args.menuRow,
      args.legacyPublicMenuSettings
    ),
    source: "supabase",
    dishes
  };
}

export function getPublicMenuCategoryGroups(
  dishes: PublicMenuDish[]
): Map<string, PublicMenuDish[]> {
  const insertionGroups = new Map<string, PublicMenuDish[]>();
  const hasRelationalDescriptions = dishes.some((dish) => dish.categoryDescription);
  for (const dish of dishes) {
    const categoryId = publicMenuCategoryId(dish);
    const list = insertionGroups.get(categoryId) ?? [];
    list.push(dish);
    insertionGroups.set(categoryId, list);
  }

  if (hasRelationalDescriptions) return insertionGroups;

  const orderedGroups = new Map<string, PublicMenuDish[]>();
  for (const definition of CATEGORY_DEFINITIONS) {
    const dishesForCategory = insertionGroups.get(definition.id);
    if (dishesForCategory?.length) {
      orderedGroups.set(definition.id, dishesForCategory);
    }
  }
  for (const [categoryId, dishesForCategory] of insertionGroups) {
    if (!orderedGroups.has(categoryId) && dishesForCategory.length) {
      orderedGroups.set(categoryId, dishesForCategory);
    }
  }
  return orderedGroups;
}

export function getVisiblePublicMenuCategories(
  dishes: PublicMenuDish[]
): PublicMenuCategory[] {
  const groups = getPublicMenuCategoryGroups(dishes);
  return Array.from(groups.entries()).map(([id, categoryDishes]) => {
    const label = publicMenuCategoryLabel(categoryDishes);
    const definition = categoryDefinitionById(id) ?? categoryDefinition(label);
    return {
      id: id || definition?.id || slugify(label) || DEFAULT_CATEGORY.id,
      label,
      description:
        [...categoryDishes].reverse().find((dish) => dish.categoryDescription)?.categoryDescription ??
        definition?.description ??
        DEFAULT_CATEGORY.description,
      tone: definition?.tone ?? DEFAULT_CATEGORY.tone,
      count: categoryDishes.length
    };
  });
}

export function getPublicMenuDishBySlug(
  menu: PublicMenu,
  rawDishSlug: string
): PublicMenuDish | null {
  const dishSlug = slugify(rawDishSlug);
  if (!dishSlug) return null;

  return (
    menu.dishes.find(
      (dish) =>
        slugify(dish.slug) === dishSlug ||
        slugify(dish.name) === dishSlug ||
        slugify(dish.id) === dishSlug
    ) ?? null
  );
}

export function buildPublicDishPath(
  rawMenuSlug: string,
  rawDishSlug: string,
  query?: PublicMenuContextQuery
): string {
  const menuSlug = slugify(rawMenuSlug);
  const dishSlug = slugify(rawDishSlug);
  if (!menuSlug || !dishSlug) return "/demo";

  const params = new URLSearchParams();
  const table = query?.table?.toString().trim();
  const zone = query?.zone?.toString().trim();
  const view = query?.view?.toString().trim();
  const rawLang = query?.lang?.toString().trim();
  if (rawLang) params.set("lang", normalizePublicMenuLocale(rawLang));
  if (table) params.set("table", table.slice(0, 24));
  if (zone) params.set("zone", zone.slice(0, 24));
  if (view) params.set("view", view.slice(0, 24));

  const suffix = params.toString();
  const path = `/menu/${encodeURIComponent(menuSlug)}/dishes/${encodeURIComponent(dishSlug)}`;
  return suffix ? `${path}?${suffix}` : path;
}

export function isFreshHomemadeMenu(menu: PublicMenu): boolean {
  return menu.slug === "resto-marc" || slugify(menu.name) === "resto-marc";
}
