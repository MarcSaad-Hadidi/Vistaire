import type { Locale } from "../i18n.ts";
import {
  formatPriceCentsForMenu,
  type DisplayPriceMode
} from "../owner/price.ts";
import { normalizeModelAssetBytes } from "../owner/modelAssetSize.ts";
import {
  hasMeaningfulPublicMenuSettings,
  normalizePublicMenuCurrency,
  normalizePublicMenuLocale,
  normalizePublicMenuSettings,
  type PublicMenuCurrency,
  type PublicMenuPriceDisplayMode,
  type PublicMenuSettings
} from "./publicMenuSettings.ts";
import {
  customAllergensFromLegacyValues,
  normalizeAllergenData,
  type DishAllergenDeclaration
} from "./allergens.ts";
import { capitalizeListItems } from "./listText.ts";

export type PublicMenuDish = {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId?: string;
  category: string;
  categorySlug?: string;
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
  cardUrl: string;
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
  viewerGlbStatus?: string;
  viewerGlbBytes?: number;
  usdzRuntimeStatus?: string;
  usdzRuntimeBytes?: number;
  usdzOptimizationRequestedProfile?: string;
  usdzOptimizationProfile?: string;
  usdzOptimizationSelectedRecipe?: string;
  usdzOptimizationProfileFallbackApplied?: boolean;
  usdzOptimizationRecipeFallbackApplied?: boolean;
  usdzOptimizationReductionPercent?: number;
  usdzGeometryOptimization?: string;
  usdzTriangleCountBefore?: number;
  usdzTriangleCountAfter?: number;
  usdzGeometryReductionPercent?: number;
  usdzPhysicalScaleStatus?: string;
  usdzPhysicalScaleDishKind?: string;
  usdzPhysicalScaleDimension?: string;
  usdzPhysicalScaleHeightAfterMeters?: number;
  usdzPhysicalScaleWidthAfterMeters?: number;
  usdzPhysicalScaleDepthAfterMeters?: number;
  usdzPhysicalScaleFootprintAfterMeters?: number;
  usdzPhysicalScaleCenteredX?: boolean;
  usdzPhysicalScaleCenteredY?: boolean;
  usdzPhysicalScaleGrounded?: boolean;
  usdzPhysicalScaleScaleFactor?: number;
  usdzPhysicalScaleWarnings?: string[];
  usdzTextureCount?: number;
  usdzChangedTextures?: number;
  usdzOptimizationAttemptCount?: number;
  usdzSourceBytes?: number;
  usdzSourceOriginalName?: string;
  usdzSourceStored?: boolean;
  quickLookQaStatus?: string;
  modelStatus:
    | "ready"
    | "missing"
    | "draft"
    | "unknown"
    | "web_ready_usdz_pending"
    | "pending_manual_usdz"
    | "usdz_conversion_failed";
  available: boolean;
  isSignature?: boolean;
  isRecommended?: boolean;
  ingredients: string[];
  allergens: string[];
  customAllergens?: string[];
  allergenDeclarations?: DishAllergenDeclaration[];
  allergenLegacyValues?: string[];
  allergenReviewRequired?: boolean;
  options: string[];
  houseNote: string;
  tags: string[];
};

export type PublicDishImageSurface = "thumbnail" | "card" | "display";

export function getPublicDishImageUrl(
  dish: Pick<PublicMenuDish, "imageUrl" | "thumbnailUrl" | "cardUrl">,
  surface: PublicDishImageSurface
): string {
  if (surface === "thumbnail") return dish.thumbnailUrl || dish.imageUrl;
  if (surface === "card") return dish.cardUrl || dish.imageUrl;
  return dish.imageUrl;
}

/**
 * Historical translation hashes were generated before presentation-only list
 * capitalization. Keep the raw lists in a server-side WeakMap instead of on
 * the dish object: dishes cross the Server/Client boundary and even
 * non-enumerable symbol properties trigger Next's serializability warnings.
 */
export type PublicMenuDishTranslationSourceLists = Readonly<{
  ingredients: readonly string[];
  options: readonly string[];
}>;

const publicMenuDishTranslationSourceLists = new WeakMap<
  PublicMenuDish,
  PublicMenuDishTranslationSourceLists
>();

export function registerPublicMenuDishTranslationSourceLists(
  dish: PublicMenuDish,
  sourceLists: PublicMenuDishTranslationSourceLists
): void {
  publicMenuDishTranslationSourceLists.set(dish, sourceLists);
}

export function getPublicMenuDishTranslationSourceLists(
  dish: PublicMenuDish
): PublicMenuDishTranslationSourceLists | undefined {
  return publicMenuDishTranslationSourceLists.get(dish);
}

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

export type PublicMenuTranslationStatus = {
  locale: string;
  status: "source" | "missing" | "pending" | "in_progress" | "up_to_date" | "stale" | "error";
  reason?: string;
  entityType?: "menu" | "category" | "dish";
  entityId?: string;
  entityLabel?: string;
  field?: string;
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
  translationStatus?: PublicMenuTranslationStatus;
  translationLocales?: PublicMenuTranslationStatus[];
  localizedUiCopy?: Record<string, unknown>;
  publicMenuStyleExplicit?: boolean;
  source: "supabase" | "demo";
  dishes: PublicMenuDish[];
};

export type PublicMenuContextQuery = {
  lang?: Locale | string;
  currency?: string;
  table?: string;
  zone?: string;
  view?: string;
};

export type PublicMenuCategory = {
  id: string;
  label: string;
  slug?: string;
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

function getExplicitStringListFromSources(
  row: PublicMenuRow,
  metadata: PublicMenuRow,
  candidates: string[]
): { values: string[]; present: boolean } {
  const metadataKey = candidates.find((key) =>
    Object.prototype.hasOwnProperty.call(metadata, key)
  );
  if (metadataKey) {
    return { values: getStringList(metadata, [metadataKey]), present: true };
  }
  const rowKey = candidates.find((key) =>
    Object.prototype.hasOwnProperty.call(row, key)
  );
  if (rowKey) {
    return { values: getStringList(row, [rowKey]), present: true };
  }
  return { values: [], present: false };
}

function getAllergenDeclarationSource(
  row: PublicMenuRow,
  metadata: PublicMenuRow
): unknown {
  const keys = [
    "allergen_declarations",
    "allergenDeclarations",
    "allergenDeclaration",
    "allergen_declaration"
  ];
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  }
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(metadata, key)) return metadata[key];
  }
  return undefined;
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
  const rowSortOrder = getNumber(
    row,
    ["display_order", "displayOrder", "sort_order", "sortOrder", "position"],
    0
  );
  const metadataSortOrder = getNumber(
    getObject(row, ["metadata", "meta"]),
    ["display_order", "displayOrder", "sort_order", "sortOrder", "position"],
    0
  );
  const sortOrder = rowSortOrder > 0 ? rowSortOrder : metadataSortOrder;
  if (sortOrder > 0) return sortOrder;
  const rowHasPersistedOrder = [
    "display_order",
    "displayOrder",
    "sort_order",
    "sortOrder",
    "position"
  ].some((key) => Object.prototype.hasOwnProperty.call(row, key));
  const metadata = getObject(row, ["metadata", "meta"]);
  const metadataHasPersistedOrder = [
    "display_order",
    "displayOrder",
    "sort_order",
    "sortOrder",
    "position"
  ].some((key) => Object.prototype.hasOwnProperty.call(metadata, key));
  return rowHasPersistedOrder || metadataHasPersistedOrder
    ? 10_000
    : 10_000 + index;
}

function dishStableSortKey(row: PublicMenuRow, index: number): string {
  return getString(row, ["id", "dish_id", "slug", "dish_slug"], `dish-${index}`);
}

function compareDishEntries(
  a: { row: PublicMenuRow; index: number; order: number },
  b: { row: PublicMenuRow; index: number; order: number }
): number {
  return (
    a.order - b.order ||
    dishStableSortKey(a.row, a.index).localeCompare(
      dishStableSortKey(b.row, b.index),
      "en"
    ) ||
    a.index - b.index
  );
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

const PHOTO_SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const CARD_DERIVATIVE_MAX_DIMENSION = 768;

function hasValidV2CardDerivative(
  metadata: PublicMenuRow,
  restaurantId: string,
  photoSha256: string
): boolean {
  const derivatives = getObject(metadata, ["photoDerivatives", "photo_derivatives"]);
  const card = getObject(derivatives, ["card"]);
  const sourceSha256 = getString(card, ["sourceSha256", "source_sha256"], "").toLowerCase();
  const outputSha256 = getString(card, ["outputSha256", "output_sha256", "sha256"], "").toLowerCase();
  const legacySha256 = getString(card, ["sha256"], "").toLowerCase();
  const rawStoragePath = card.storagePath ?? card.storage_path;
  const storagePath = typeof rawStoragePath === "string" ? rawStoragePath : "";
  const normalizedPhotoSha256 = photoSha256.toLowerCase();
  const expectedStoragePath = `restaurants/${restaurantId}/photos/derivatives/${normalizedPhotoSha256}/dish-photo-v2/card-${outputSha256}.webp`;
  const width = getNumber(card, ["width"], 0);
  const height = getNumber(card, ["height"], 0);
  const bytes = getNumber(card, ["bytes"], 0);
  const generatedAt = getString(card, ["generatedAt", "generated_at"], "");

  return (
    card.schemaVersion === 2 &&
    card.recipeId === "dish-photo-v2" &&
    card.variant === "card" &&
    Boolean(restaurantId) &&
    PHOTO_SHA256_PATTERN.test(photoSha256) &&
    sourceSha256 === normalizedPhotoSha256 &&
    PHOTO_SHA256_PATTERN.test(outputSha256) &&
    (!legacySha256 || legacySha256 === outputSha256) &&
    storagePath === expectedStoragePath &&
    card.contentType === "image/webp" &&
    card.format === "webp" &&
    Number.isInteger(width) &&
    width > 0 &&
    width <= CARD_DERIVATIVE_MAX_DIMENSION &&
    Number.isInteger(height) &&
    height > 0 &&
    height <= CARD_DERIVATIVE_MAX_DIMENSION &&
    Number.isInteger(bytes) &&
    bytes > 0 &&
    Number.isFinite(Date.parse(generatedAt)) &&
    Boolean(getString(card, ["encoder"], ""))
  );
}

function canonicalDishPhotoVariantUrl(
  dishId: string,
  photoSha256: string,
  variant: "card"
): string {
  if (!PHOTO_SHA256_PATTERN.test(photoSha256)) return "";
  return `/api/public/menu-dishes/${dishId}/photo?v=${photoSha256.toLowerCase()}&variant=${variant}`;
}

function versionCanonicalDishPhotoUrl(
  imageUrl: string,
  dishId: string,
  photoSha256: string,
  variant?: "thumbnail" | "display"
): string {
  const canonicalPath = `/api/public/menu-dishes/${dishId}/photo`;
  let parsed: URL;
  try {
    parsed = new URL(imageUrl, "https://menu.vistaire.invalid");
  } catch {
    return imageUrl;
  }
  if (
    parsed.origin !== "https://menu.vistaire.invalid" ||
    parsed.pathname !== canonicalPath
  ) {
    return imageUrl;
  }
  const existingVersion = parsed.searchParams.get("v")?.trim() ?? "";
  const version = PHOTO_SHA256_PATTERN.test(photoSha256)
    ? photoSha256.toLowerCase()
    : PHOTO_SHA256_PATTERN.test(existingVersion)
      ? existingVersion.toLowerCase()
      : "";
  if (!version) return imageUrl;
  const params = new URLSearchParams(parsed.searchParams);
  params.set("v", version);
  if (variant) params.set("variant", variant);
  return `${canonicalPath}?${params.toString()}`;
}

function mapDishRow(
  row: PublicMenuRow,
  index: number,
  settings: PublicMenuSettings,
  restaurantId: string
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
  const dishId = getString(
    row,
    ["id", "dish_id", "slug", "dish_slug"],
    `dish-${index}`
  );
  const photoSha256 = getString(
    metadata,
    ["photoSha256", "photo_sha256"],
    ""
  );
  const rawImageUrl = getSafeStringFromSources(row, metadata, [
    "image",
    "image_url",
    "imageUrl",
    "photo_url",
    "photoUrl"
  ]);
  const imageUrl = versionCanonicalDishPhotoUrl(
    rawImageUrl,
    dishId,
    photoSha256,
    "display"
  );
  const rawThumbnailUrl =
    getSafeStringFromSources(row, metadata, [
      "thumbnail_url",
      "thumbnailUrl"
    ]) || rawImageUrl;
  const thumbnailUrl = versionCanonicalDishPhotoUrl(
    rawThumbnailUrl,
    dishId,
    photoSha256,
    "thumbnail"
  );
  const cardUrl = hasValidV2CardDerivative(metadata, restaurantId, photoSha256)
    ? canonicalDishPhotoVariantUrl(dishId, photoSha256, "card")
    : rawImageUrl;
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
  const viewerGlbStatus = getString(metadata, ["viewerGlbStatus"], "");
  const viewerGlbBytes = normalizeModelAssetBytes(
    getNumberFromSources(row, metadata, ["viewerGlbBytes"])
  );
  const usdzRuntimeStatus = getString(metadata, ["usdzRuntimeStatus"], "");
  const usdzRuntimeBytes = normalizeModelAssetBytes(
    getNumberFromSources(row, metadata, ["usdzRuntimeBytes"])
  );
  const usdzOptimizationRequestedProfile = getString(metadata, [
    "usdzOptimizationRequestedProfile"
  ], "");
  const usdzOptimizationProfile = getString(metadata, ["usdzOptimizationProfile"], "");
  const usdzOptimizationSelectedRecipe = getString(metadata, [
    "usdzOptimizationSelectedRecipe"
  ], "");
  const usdzOptimizationProfileFallbackApplied =
    getBoolean(metadata, ["usdzOptimizationProfileFallbackApplied"]) ?? undefined;
  const usdzOptimizationRecipeFallbackApplied =
    getBoolean(metadata, ["usdzOptimizationRecipeFallbackApplied"]) ?? undefined;
  const usdzOptimizationReductionPercent = getNumberFromSources(row, metadata, [
    "usdzOptimizationReductionPercent"
  ]);
  const usdzGeometryOptimization = getString(metadata, ["usdzGeometryOptimization"], "");
  const usdzTriangleCountBefore = getNumberFromSources(row, metadata, [
    "usdzTriangleCountBefore"
  ]);
  const usdzTriangleCountAfter = getNumberFromSources(row, metadata, [
    "usdzTriangleCountAfter"
  ]);
  const usdzGeometryReductionPercent = getNumberFromSources(row, metadata, [
    "usdzGeometryReductionPercent"
  ]);
  const usdzPhysicalScaleStatus = getString(metadata, ["usdzPhysicalScaleStatus"], "");
  const usdzPhysicalScaleDishKind = getString(metadata, ["usdzPhysicalScaleDishKind"], "");
  const usdzPhysicalScaleDimension = getString(metadata, ["usdzPhysicalScaleDimension"], "");
  const usdzPhysicalScaleHeightAfterMeters = getNumberFromSources(row, metadata, [
    "usdzPhysicalScaleHeightAfterMeters"
  ]);
  const usdzPhysicalScaleWidthAfterMeters = getNumberFromSources(row, metadata, [
    "usdzPhysicalScaleWidthAfterMeters"
  ]);
  const usdzPhysicalScaleDepthAfterMeters = getNumberFromSources(row, metadata, [
    "usdzPhysicalScaleDepthAfterMeters"
  ]);
  const usdzPhysicalScaleFootprintAfterMeters = getNumberFromSources(row, metadata, [
    "usdzPhysicalScaleFootprintAfterMeters"
  ]);
  const usdzPhysicalScaleCenteredX = getBoolean(metadata, ["usdzPhysicalScaleCenteredX"]) ?? undefined;
  const usdzPhysicalScaleCenteredY = getBoolean(metadata, ["usdzPhysicalScaleCenteredY"]) ?? undefined;
  const usdzPhysicalScaleGrounded = getBoolean(metadata, ["usdzPhysicalScaleGrounded"]) ?? undefined;
  const usdzPhysicalScaleScaleFactor = getNumberFromSources(row, metadata, [
    "usdzPhysicalScaleScaleFactor"
  ]);
  const usdzPhysicalScaleWarnings = getStringListFromSources(row, metadata, [
    "usdzPhysicalScaleWarnings"
  ]);
  const usdzTextureCount = getNumberFromSources(row, metadata, ["usdzTextureCount"]);
  const usdzChangedTextures = getNumberFromSources(row, metadata, ["usdzChangedTextures"]);
  const usdzOptimizationAttemptCount = getNumberFromSources(row, metadata, [
    "usdzOptimizationAttemptCount"
  ]);
  const usdzSourceBytes = normalizeModelAssetBytes(
    getNumberFromSources(row, metadata, ["usdzSourceBytes"])
  );
  const usdzSourceOriginalName = getString(metadata, ["usdzSourceOriginalName"], "");
  const usdzSourceStored = metadata.usdzSourceStored === true;
  const quickLookQaStatus = getString(metadata, ["quickLookQaStatus"], "");
  const modelAssetVersion = getString(metadata, ["modelAssetVersion", "model_asset_version"], "");
  const modelAssetSha256 = getString(metadata, ["modelAssetSha256", "model_asset_sha256"], "");
  const modelUpdatedAt = getString(metadata, ["modelUpdatedAt", "model_updated_at"], "");
  const storedModelStatus = getString(metadata, ["modelStatus", "model_status"], "");
  const isSignature = getBoolean(row, ["is_signature", "isSignature"]);
  const isRecommended = getBoolean(row, ["is_recommended", "isRecommended"]);
  const legacyAllergens = getStringListFromSources(row, metadata, [
    "allergens",
    "allergenes",
    "allergen_list"
  ]);
  const sourceIngredients = getStringListFromSources(row, metadata, [
    "ingredients",
    "ingredient_list"
  ]);
  const sourceOptions = mergeStringLists(
    getStringList(row, PUBLIC_MENU_OPTION_FIELD_KEYS.slice(0, 2)),
    getStringList(row, PUBLIC_MENU_OPTION_FIELD_KEYS.slice(2, 3)),
    getStringList(row, PUBLIC_MENU_OPTION_FIELD_KEYS.slice(3, 4)),
    getStringList(metadata, PUBLIC_MENU_OPTION_FIELD_KEYS.slice(0, 2)),
    getStringList(metadata, PUBLIC_MENU_OPTION_FIELD_KEYS.slice(2, 3)),
    getStringList(metadata, PUBLIC_MENU_OPTION_FIELD_KEYS.slice(3, 4))
  );
  const customAllergenSource = getExplicitStringListFromSources(row, metadata, [
    "customAllergens",
    "custom_allergens"
  ]);
  const customAllergens = customAllergenSource.present
    ? customAllergensFromLegacyValues(customAllergenSource.values)
    : undefined;
  const allergenData = normalizeAllergenData(
    getAllergenDeclarationSource(row, metadata),
    legacyAllergens
  );
  const has3d = Boolean(model3dUrl || webModel3dUrl || arModel3dUrl);
  const hasIosAr = Boolean(arUsdzUrl || usdzUrl);
  const hasAndroidAr = Boolean(arModel3dUrl);
  const hasAr = hasIosAr || hasAndroidAr;
  const slug = slugify(
    getString(row, ["slug", "dish_slug", "dishSlug"], name)
  );
  const categorySlug = getString(row, ["category_slug", "categorySlug"], "");

  const dish: PublicMenuDish = {
    id: dishId,
    slug: slug || `dish-${index}`,
    name,
    description: getString(row, ["short_description", "shortDescription", "description", "desc", "summary"], ""),
    ...(categoryId ? { categoryId } : {}),
    ...(categorySlug ? { categorySlug } : {}),
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
    cardUrl,
    hasPhoto: Boolean(imageUrl),
    photoStatus:
      imageUrl
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
    ...(viewerGlbStatus ? { viewerGlbStatus } : {}),
    viewerGlbBytes,
    ...(usdzRuntimeStatus ? { usdzRuntimeStatus } : {}),
    usdzRuntimeBytes,
    ...(usdzOptimizationRequestedProfile ? { usdzOptimizationRequestedProfile } : {}),
    ...(usdzOptimizationProfile ? { usdzOptimizationProfile } : {}),
    ...(usdzOptimizationSelectedRecipe ? { usdzOptimizationSelectedRecipe } : {}),
    ...(usdzOptimizationProfileFallbackApplied === undefined
      ? {}
      : { usdzOptimizationProfileFallbackApplied }),
    ...(usdzOptimizationRecipeFallbackApplied === undefined
      ? {}
      : { usdzOptimizationRecipeFallbackApplied }),
    usdzOptimizationReductionPercent,
    ...(usdzGeometryOptimization ? { usdzGeometryOptimization } : {}),
    usdzTriangleCountBefore,
    usdzTriangleCountAfter,
    usdzGeometryReductionPercent,
    ...(usdzPhysicalScaleStatus ? { usdzPhysicalScaleStatus } : {}),
    ...(usdzPhysicalScaleDishKind ? { usdzPhysicalScaleDishKind } : {}),
    ...(usdzPhysicalScaleDimension ? { usdzPhysicalScaleDimension } : {}),
    usdzPhysicalScaleHeightAfterMeters,
    usdzPhysicalScaleWidthAfterMeters,
    usdzPhysicalScaleDepthAfterMeters,
    usdzPhysicalScaleFootprintAfterMeters,
    ...(usdzPhysicalScaleCenteredX === undefined ? {} : { usdzPhysicalScaleCenteredX }),
    ...(usdzPhysicalScaleCenteredY === undefined ? {} : { usdzPhysicalScaleCenteredY }),
    ...(usdzPhysicalScaleGrounded === undefined ? {} : { usdzPhysicalScaleGrounded }),
    usdzPhysicalScaleScaleFactor,
    ...(usdzPhysicalScaleWarnings.length > 0 ? { usdzPhysicalScaleWarnings } : {}),
    usdzTextureCount,
    usdzChangedTextures,
    usdzOptimizationAttemptCount,
    usdzSourceBytes,
    ...(usdzSourceOriginalName ? { usdzSourceOriginalName } : {}),
    usdzSourceStored,
    ...(quickLookQaStatus ? { quickLookQaStatus } : {}),
    modelStatus:
      !has3d && !hasAr
        ? "missing"
        : storedModelStatus === "web_ready_usdz_pending"
          ? "web_ready_usdz_pending"
          : storedModelStatus === "pending_manual_usdz"
            ? "pending_manual_usdz"
            : storedModelStatus === "usdz_conversion_failed"
              ? "usdz_conversion_failed"
              : "ready",
    available: isDishAvailable(row),
    ...(isSignature ? { isSignature } : {}),
    ...(isRecommended ? { isRecommended } : {}),
    ingredients: capitalizeListItems(sourceIngredients),
    allergens: legacyAllergens,
    ...(customAllergens === undefined ? {} : { customAllergens }),
    allergenDeclarations: allergenData.declarations,
    allergenLegacyValues: allergenData.legacyValues,
    allergenReviewRequired: allergenData.reviewRequired,
    options: capitalizeListItems(sourceOptions),
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
      isSignature ? ["Signature"] : [],
      isRecommended ? ["Recommande"] : []
    )
  };
  registerPublicMenuDishTranslationSourceLists(dish, {
    ingredients: sourceIngredients,
    options: sourceOptions
  });
  return dish;
}

function rowMatchesMenu(row: PublicMenuRow, menuId: string): boolean {
  return !menuId || getString(row, ["menu_id", "menuId"], "") === menuId;
}

function rowMatchesRestaurant(row: PublicMenuRow, restaurantId: string): boolean {
  return !restaurantId || getString(row, RESTAURANT_ID_KEYS, "") === restaurantId;
}

type MenuSettingsCandidate = {
  rawSettings: PublicMenuRow;
  localizedUiCopy?: Record<string, unknown>;
  updatedAtMs: number | null;
  meaningful: boolean;
};

function parseUpdatedAtMs(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowUpdatedAtMs(row: PublicMenuRow): number | null {
  return parseUpdatedAtMs(row.updated_at ?? row.updatedAt);
}

function localizedUiCopyInput(value: unknown): Record<string, unknown> | undefined {
  const input = objectInput(value);
  return Object.keys(input).length > 0 ? input : undefined;
}

function getLocalizedUiCopy(candidate: PublicMenuRow, keys: string[]): Record<string, unknown> | undefined {
  for (const key of keys) {
    const value = localizedUiCopyInput(candidate[key]);
    if (value) return value;
  }
  return undefined;
}

function mergeLocalizedUiCopy(
  ...sources: Array<Record<string, unknown> | undefined>
): Record<string, unknown> | undefined {
  const merged: Record<string, unknown> = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      const existingObject = objectInput(merged[key]);
      const nextObject = objectInput(value);
      if (Object.keys(nextObject).length > 0) {
        merged[key] =
          Object.keys(existingObject).length > 0
            ? { ...existingObject, ...nextObject }
            : nextObject;
      } else if (
        typeof value === "string" ? value.trim() : value !== undefined && value !== null
      ) {
        merged[key] = value;
      }
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function settingsCandidateFromLegacyInput(value: unknown): MenuSettingsCandidate | null {
  const input = objectInput(value);
  const nestedSettings = objectInput(input.settings);
  const rawSettings =
    hasMeaningfulPublicMenuSettings(nestedSettings)
      ? nestedSettings
      : hasMeaningfulPublicMenuSettings(input)
        ? input
        : {};
  const meaningful = hasMeaningfulPublicMenuSettings(rawSettings);
  const localizedUiCopy = mergeLocalizedUiCopy(
    getLocalizedUiCopy(input, ["localizedUiCopy", "localized_ui_copy", "uiCopy", "ui_copy"]),
    getLocalizedUiCopy(rawSettings, ["localizedUiCopy", "localized_ui_copy", "uiCopy", "ui_copy"])
  );
  if (!meaningful && !localizedUiCopy) return null;

  return {
    rawSettings,
    localizedUiCopy,
    updatedAtMs: parseUpdatedAtMs(input.updatedAt ?? input.updated_at),
    meaningful
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
  const localizedUiCopy = mergeLocalizedUiCopy(
    getLocalizedUiCopy(row, ["localizedUiCopy", "localized_ui_copy", "uiCopy", "ui_copy"]),
    getLocalizedUiCopy(nativeSettings, ["localizedUiCopy", "localized_ui_copy", "uiCopy", "ui_copy"]),
    getLocalizedUiCopy(metadata, ["localizedUiCopy", "localized_ui_copy", "uiCopy", "ui_copy"]),
    getLocalizedUiCopy(metadataSettings, ["localizedUiCopy", "localized_ui_copy", "uiCopy", "ui_copy"])
  );
  const rawSettings =
    hasMeaningfulPublicMenuSettings(nativeSettings)
      ? nativeSettings
      : hasMeaningfulPublicMenuSettings(metadataSettings)
        ? metadataSettings
        : {};
  const meaningful = hasMeaningfulPublicMenuSettings(rawSettings);
  if (!meaningful && !localizedUiCopy) return null;

  return {
    rawSettings,
    localizedUiCopy,
    updatedAtMs: rowUpdatedAtMs(row),
    meaningful
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

  const meaningfulMenuCandidate = menuCandidate?.meaningful ? menuCandidate : null;
  const meaningfulUiConfigCandidate = uiConfigCandidate?.meaningful
    ? uiConfigCandidate
    : null;

  if (meaningfulMenuCandidate && meaningfulUiConfigCandidate) {
    // settings_json is the canonical store once it has a recognized public
    // setting. Legacy rows are only a recovery source for empty/invalid data.
    return {
      ...meaningfulMenuCandidate,
      localizedUiCopy: mergeLocalizedUiCopy(
        meaningfulUiConfigCandidate.localizedUiCopy,
        meaningfulMenuCandidate.localizedUiCopy
      )
    };
  }

  if (meaningfulMenuCandidate || meaningfulUiConfigCandidate) {
    const selected = meaningfulMenuCandidate ?? meaningfulUiConfigCandidate!;
    return {
      ...selected,
      localizedUiCopy: mergeLocalizedUiCopy(
        uiConfigCandidate?.localizedUiCopy,
        menuCandidate?.localizedUiCopy
      )
    };
  }

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

  const selected = menuCandidate ?? uiConfigCandidate ?? {
    rawSettings: {},
    updatedAtMs: null,
    meaningful: false
  };
  return {
    ...selected,
    localizedUiCopy: mergeLocalizedUiCopy(
      uiConfigCandidate?.localizedUiCopy,
      menuCandidate?.localizedUiCopy
    )
  };
}

function menuSettingsBundleFromRows(args: {
  menuRow?: PublicMenuRow | null;
  legacyPublicMenuSettings?: unknown;
  legacyMenuLanguages?: unknown;
}): { settings: PublicMenuSettings; localizedUiCopy?: Record<string, unknown> } {
  const candidate = resolveMenuSettingsCandidate(args);
  const rawSettings = candidate.rawSettings;
  const isEmptySettings = !hasMeaningfulPublicMenuSettings(rawSettings);
  return {
    settings: normalizePublicMenuSettings(rawSettings, {
      legacyMenuLanguages: isEmptySettings ? args.legacyMenuLanguages : undefined
    }),
    ...(candidate.localizedUiCopy ? { localizedUiCopy: candidate.localizedUiCopy } : {})
  };
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
  const menuSettings = menuSettingsBundleFromRows({
    legacyPublicMenuSettings: options.legacyPublicMenuSettings,
    legacyMenuLanguages: options.legacyMenuLanguages
  });
  const { settings } = menuSettings;
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
    .sort(compareDishEntries)
    .slice(0, 200)
    .map(({ row, index }) => mapDishRow(row, index, settings, restaurantId));

  return {
    restaurantId,
    slug,
    name: getString(restaurantRow, ["name", "restaurant_name"], "Restaurant"),
    location: getString(restaurantRow, ["location", "city", "address"], ""),
    cuisineType: getString(restaurantRow, ["cuisine_type", "cuisineType"], ""),
    googleReview: googleReviewConfigFromRestaurantRow(restaurantRow),
    settings,
    ...(menuSettings.localizedUiCopy
      ? { localizedUiCopy: menuSettings.localizedUiCopy }
      : {}),
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
  const menuSettings = menuSettingsBundleFromRows({
    menuRow: args.menuRow,
    legacyPublicMenuSettings: args.legacyPublicMenuSettings,
    legacyMenuLanguages: args.legacyMenuLanguages
  });
  const { settings } = menuSettings;
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
    .sort(compareDishEntries)
    .slice(0, 200)
    .map(({ row, index }) => mapDishRow(row, index, settings, restaurantId));

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
    ...(menuSettings.localizedUiCopy
      ? { localizedUiCopy: menuSettings.localizedUiCopy }
      : {}),
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
    const slug =
      categoryDishes.find((dish) => dish.categorySlug?.trim())?.categorySlug?.trim() ||
      undefined;
    return {
      id: id || definition?.id || slugify(label) || DEFAULT_CATEGORY.id,
      label,
      ...(slug ? { slug } : {}),
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
  const rawCurrency = query?.currency?.toString().trim();
  if (rawLang) params.set("lang", normalizePublicMenuLocale(rawLang));
  if (rawCurrency) params.set("currency", rawCurrency.toUpperCase().slice(0, 3));
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
