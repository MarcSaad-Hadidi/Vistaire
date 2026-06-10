export type PublicMenuDish = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  priceLabel: string;
  imageUrl: string;
  thumbnailUrl: string;
  hasPhoto: boolean;
  photoStatus: "ready" | "missing" | "draft" | "unknown";
  hasImmersive: boolean;
  has3d: boolean;
  hasAr: boolean;
  hasIosAr: boolean;
  hasAndroidAr: boolean;
  model3dUrl: string;
  webModel3dUrl: string;
  arModel3dUrl: string;
  usdzUrl: string;
  arUsdzUrl: string;
  posterUrl: string;
  modelStatus: "ready" | "missing" | "draft" | "unknown";
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
};

export type GoogleReviewCta = {
  href: string;
  googleRating?: number;
  googleReviewCount?: number;
};

export type PublicMenu = {
  restaurantId: string;
  slug: string;
  name: string;
  location: string;
  cuisineType: string;
  googleReview: GoogleReviewConfig;
  source: "supabase" | "demo";
  dishes: PublicMenuDish[];
};

export type PublicMenuContextQuery = {
  table?: string;
  zone?: string;
};

export type PublicMenuCategory = {
  id: string;
  label: string;
  description: string;
  tone: "blue" | "green" | "yellow" | "red";
  count: number;
};

export type PublicMenuRow = Record<string, unknown>;

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

  return {
    enabled: getBoolean(candidate, ["enabled"]) ?? false,
    googleReviewUrl,
    ...(googleRating === undefined ? {} : { googleRating }),
    ...(googleReviewCount === undefined ? {} : { googleReviewCount })
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

function isSafePublicMediaUrl(url: string): boolean {
  if (!url) return false;
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

function formatPrice(row: PublicMenuRow): string {
  const value = getNumber(row, ["price", "amount", "price_cad"], 0);
  if (!value) return "";
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD"
  }).format(value);
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

function mapDishRow(row: PublicMenuRow, index: number): PublicMenuDish {
  const name = getString(row, ["name", "dish_name", "title"], "Plat");
  const imageUrl = getSafeString(row, [
    "image",
    "image_url",
    "imageUrl",
    "photo_url",
    "photoUrl"
  ]);
  const thumbnailUrl =
    getSafeString(row, [
      "thumbnail_url",
      "thumbnailUrl"
    ]) || imageUrl;
  const model3dUrl = getSafeString(row, ["model3d_url", "model3dUrl"]);
  const webModel3dUrl =
    getSafeString(row, ["web_model_3d_url", "webModel3dUrl"]) || model3dUrl;
  const arModel3dUrl = getSafeString(row, [
    "ar_model_3d_url",
    "arModel3dUrl"
  ]);
  const usdzUrl = getSafeString(row, ["usdz_url", "usdzUrl"]);
  const arUsdzUrl =
    getSafeString(row, [
      "ar_usdz_url",
      "arUsdzUrl",
      "ios_usdz_url",
      "iosUsdzUrl"
    ]) || usdzUrl;
  const posterUrl = getSafeString(row, [
    "poster_url",
    "posterUrl",
    "model_poster_url",
    "modelPosterUrl"
  ]);
  const has3d = Boolean(model3dUrl || webModel3dUrl || arModel3dUrl);
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
    description: getString(row, ["description", "desc", "summary"], ""),
    category: normalizeCategory(
      getString(
        row,
        ["category_name", "categoryName", "category", "category_slug"],
        DEFAULT_CATEGORY.label
      )
    ),
    priceLabel: formatPrice(row),
    imageUrl,
    thumbnailUrl,
    hasPhoto: Boolean(imageUrl),
    photoStatus: imageUrl ? "ready" : "missing",
    hasImmersive: has3d || hasAr,
    has3d,
    hasAr,
    hasIosAr,
    hasAndroidAr,
    model3dUrl,
    webModel3dUrl,
    arModel3dUrl,
    usdzUrl,
    arUsdzUrl,
    posterUrl,
    modelStatus: has3d || hasAr ? "ready" : "missing",
    available: isDishAvailable(row),
    ingredients: getStringList(row, ["ingredients", "ingredient_list"]),
    allergens: getStringList(row, ["allergens", "allergenes", "allergen_list"]),
    options: getStringList(row, ["options", "option_list"]),
    houseNote: getString(row, [
      "house_note",
      "houseNote",
      "chef_note",
      "chefNote",
      "note"
    ]),
    tags: getStringList(row, ["tags", "badges", "labels"])
  };
}

export function getPublicMenuRowSlug(row: PublicMenuRow): string {
  const name = getString(row, ["name", "restaurant_name"], "");
  return getString(row, ["slug", "restaurant_slug"], slugify(name));
}

export function buildSupabasePublicMenu(
  rawSlug: string,
  restaurantRow: PublicMenuRow,
  dishRows: PublicMenuRow[]
): PublicMenu {
  const slug = getPublicMenuRowSlug(restaurantRow) || slugify(rawSlug);
  const restaurantId = getString(restaurantRow, ["id", "restaurant_id"], "");
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
    .filter(isDishAvailable)
    .map((row, index) => ({ row, index, order: dishSortOrder(row, index) }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .slice(0, 200)
    .map(({ row, index }) => mapDishRow(row, index));

  return {
    restaurantId,
    slug,
    name: getString(restaurantRow, ["name", "restaurant_name"], "Restaurant"),
    location: getString(restaurantRow, ["location", "city", "address"], ""),
    cuisineType: getString(restaurantRow, ["cuisine_type", "cuisineType"], ""),
    googleReview: googleReviewConfigFromRestaurantRow(restaurantRow),
    source: "supabase",
    dishes
  };
}

export function getPublicMenuCategoryGroups(
  dishes: PublicMenuDish[]
): Map<string, PublicMenuDish[]> {
  const insertionGroups = new Map<string, PublicMenuDish[]>();
  for (const dish of dishes) {
    const category = normalizeCategory(dish.category || DEFAULT_CATEGORY.label);
    const list = insertionGroups.get(category) ?? [];
    list.push(dish);
    insertionGroups.set(category, list);
  }

  const orderedGroups = new Map<string, PublicMenuDish[]>();
  for (const definition of CATEGORY_DEFINITIONS) {
    const dishesForCategory = insertionGroups.get(definition.label);
    if (dishesForCategory?.length) {
      orderedGroups.set(definition.label, dishesForCategory);
    }
  }
  for (const [category, dishesForCategory] of insertionGroups) {
    if (!orderedGroups.has(category) && dishesForCategory.length) {
      orderedGroups.set(category, dishesForCategory);
    }
  }
  return orderedGroups;
}

export function getVisiblePublicMenuCategories(
  dishes: PublicMenuDish[]
): PublicMenuCategory[] {
  const groups = getPublicMenuCategoryGroups(dishes);
  return Array.from(groups.entries()).map(([label, categoryDishes]) => {
    const definition = categoryDefinition(label);
    return {
      id: definition?.id ?? slugify(label) ?? DEFAULT_CATEGORY.id,
      label,
      description: definition?.description ?? DEFAULT_CATEGORY.description,
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
  if (table) params.set("table", table.slice(0, 24));
  if (zone) params.set("zone", zone.slice(0, 24));

  const suffix = params.toString();
  const path = `/menu/${encodeURIComponent(menuSlug)}/dishes/${encodeURIComponent(dishSlug)}`;
  return suffix ? `${path}?${suffix}` : path;
}

export function isFreshHomemadeMenu(menu: PublicMenu): boolean {
  return menu.slug === "resto-marc" || slugify(menu.name) === "resto-marc";
}
