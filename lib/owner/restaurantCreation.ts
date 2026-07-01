import type {
  CreateRestaurantDishInput,
  CreateRestaurantDishPhotoStatus,
  CreateRestaurantInput,
  CreateRestaurantMenuLanguage,
  CreateRestaurantSectionInput,
  OwnerReadinessItem,
  OwnerRestaurant,
  OwnerRestaurantStatus
} from "@/lib/owner/types";
import {
  normalizePublicMenuSettings,
  publicMenuSettingsToLegacyMenuLanguages,
  serializePublicMenuSettings,
  validatePublicMenuSettingsInput,
  type PublicMenuSettings
} from "../menu/publicMenuSettings.ts";
import {
  normalizeDisplayPriceMode,
  parsePriceToCents
} from "./price.ts";

type SupabaseInsertError = {
  code?: string;
  message?: string;
};

type SupabaseRestaurantClient = {
  rpc?: (
    functionName: string,
    params: Record<string, unknown>
  ) => PromiseLike<{
    data: unknown;
    error: SupabaseInsertError | null;
  }>;
  from(table: string): {
    insert(row: Record<string, unknown>): {
      select(columns: string): {
        single(): PromiseLike<{
          data: Record<string, unknown> | null;
          error: SupabaseInsertError | null;
        }>;
      };
    };
    select(columns: string): {
      eq(column: string, value: unknown): {
        order(
          column: string,
          options: { ascending?: boolean }
        ): {
          limit(count: number): PromiseLike<{
            data: Record<string, unknown>[] | null;
            error: SupabaseInsertError | null;
          }>;
        };
      };
    };
    insert(rows: Record<string, unknown>[]): PromiseLike<{
      data: Record<string, unknown>[] | null;
      error: SupabaseInsertError | null;
    }>;
    update(row: Record<string, unknown>): {
      eq(
        column: string,
        value: unknown
      ): PromiseLike<{
        data: Record<string, unknown>[] | null;
        error: SupabaseInsertError | null;
      }>;
    };
  };
};

type SupabaseAdminResult =
  | { ok: true; client: SupabaseRestaurantClient }
  | { ok: false; reason: string };

export type CreateRestaurantRecordResult =
  | {
      ok: true;
      persisted: true;
      dataSource: "supabase";
      restaurant: OwnerRestaurant;
      restaurantPersisted: true;
      menuPersisted: boolean;
      categoriesPersisted: boolean;
      sectionsPersisted: boolean;
      dishesPersisted: boolean;
      persistedCategoryCount: number;
      persistedDishCount: number;
      menu?: Record<string, unknown>;
      mediaBasePath: string;
      mediaBasePathPersisted: boolean;
      qrCodesHref: string;
      warnings: string[];
    }
  | {
      ok: false;
      error: string;
      status: 400 | 409 | 502 | 503;
    };

type CreateRestaurantRecordDependencies = {
  admin: SupabaseAdminResult;
  getColumns: (table: string) => Promise<Set<string>>;
  env?: Record<string, string | undefined>;
};

const STATUS_LABELS: Record<OwnerRestaurantStatus, string> = {
  demo: "Presentation",
  active: "Actif",
  setup_needed: "A configurer",
  paused: "Pause",
  archived: "Archive"
};

const STATUS_VALUES = new Set<OwnerRestaurantStatus>([
  "demo",
  "active",
  "setup_needed",
  "paused",
  "archived"
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SITE_URL_ENV_KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
  "SITE_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL"
] as const;

const MENU_LANGUAGE_VALUES = new Set<CreateRestaurantMenuLanguage>(["fr", "en"]);
const MENU_SETTINGS_WARNING =
  "Les settings publics du menu n'ont pas pu etre persistes dans menus.settings_json.";

const PHOTO_STATUS_VALUES = new Set<CreateRestaurantDishPhotoStatus>([
  "ready",
  "planned",
  "missing"
]);

const DEFAULT_MENU_DISH_COLUMNS = new Set([
  "restaurant_id",
  "restaurant_slug",
  "name",
  "description",
  "category_name",
  "price",
  "available",
  "sort_order",
  "image_url",
  "thumbnail_url",
  "ingredients",
  "allergens",
  "options",
  "house_note",
  "tags",
  "photo_status"
]);

const SECTION_DESCRIPTION_WARNING =
  "Les sections sont persistees comme categories de plats; leurs descriptions restent dans le draft owner.";
const SECTION_WITHOUT_DISH_WARNING_PREFIX =
  "Les sections sans plat n'ont pas de ligne persistante dans menu_dishes et ne s'afficheront pas dans le menu public : ";
const RESTAURANT_MEDIA_BASE_PATH_COLUMNS = [
  "media_base_path",
  "mediaBasePath",
  "asset_folder",
  "assetFolder",
  "storage_path",
  "storagePath"
];
const MEDIA_BASE_PATH_UNSAVED_WARNING =
  "Chemin media calcule mais non sauvegarde dans restaurants : aucune colonne compatible detectee.";
const MEDIA_BASE_PATH_UPDATE_WARNING =
  "Chemin media calcule mais non sauvegarde dans restaurants : erreur Supabase pendant la mise a jour.";

function slugifyRestaurantSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildPublicMenuPath(slugOrName: string): string {
  const slug = slugifyRestaurantSlug(slugOrName);
  return slug ? `/menu/${encodeURIComponent(slug)}` : "/demo";
}

function buildRestaurantDashboardPath(restaurantIdOrSlug: string): string {
  const safeId = restaurantIdOrSlug.trim();
  return safeId
    ? `/owner/restaurants/${encodeURIComponent(safeId)}`
    : "/owner";
}

function getSiteOrigin(env: Record<string, string | undefined> = {}): string {
  for (const key of SITE_URL_ENV_KEYS) {
    const value = env[key];
    if (!value) continue;
    try {
      const withProtocol = /^https?:\/\//i.test(value)
        ? value
        : `https://${value}`;
      return new URL(withProtocol).origin;
    } catch {
      // Ignore malformed environment values and use the production fallback.
    }
  }
  return "https://www.vistaire.ca";
}

function buildPublicMenuUrl(
  slugOrName: string,
  env?: Record<string, string | undefined>
): string {
  return new URL(buildPublicMenuPath(slugOrName), getSiteOrigin(env)).toString();
}

function getString(
  row: Record<string, unknown>,
  candidates: string[],
  fallback = ""
): string {
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function normalizeStatus(value: string): OwnerRestaurantStatus {
  return STATUS_VALUES.has(value as OwnerRestaurantStatus)
    ? (value as OwnerRestaurantStatus)
    : "setup_needed";
}

function pickColumn(columns: Set<string>, candidates: string[]): string | null {
  return candidates.find((candidate) => columns.has(candidate)) ?? null;
}

function assignInsertValue(
  row: Record<string, unknown>,
  columns: Set<string>,
  candidates: string[],
  value: unknown
) {
  if (value === undefined || value === "") return;
  const column = columns.size > 0 ? pickColumn(columns, candidates) : candidates[0];
  if (column) row[column] = value;
}

function assignMenuDishValue(
  row: Record<string, unknown>,
  columns: Set<string>,
  candidates: string[],
  value: unknown
) {
  if (value === undefined || value === "") return;
  const column =
    columns.size > 0
      ? pickColumn(columns, candidates)
      : candidates.find((candidate) => DEFAULT_MENU_DISH_COLUMNS.has(candidate)) ?? null;
  if (column) row[column] = value;
}

function getStringArray(
  row: Record<string, unknown>,
  candidates: string[],
  maxItems = 12
): string[] {
  for (const key of candidates) {
    const value = row[key];
    const rawItems = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(",")
        : null;
    if (!rawItems) continue;

    const seen = new Set<string>();
    return rawItems
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => {
        if (!item) return false;
        const key = item.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, maxItems)
      .map((item) => item.slice(0, 80));
  }

  return [];
}

function getNumber(
  row: Record<string, unknown>,
  candidates: string[],
  fallback = 0
): number {
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

function getBoolean(
  row: Record<string, unknown>,
  candidates: string[],
  fallback: boolean
): boolean {
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "oui"].includes(normalized)) return true;
      if (["false", "0", "no", "non"].includes(normalized)) return false;
    }
  }
  return fallback;
}

function normalizeImageUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.includes("\\")) return "";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("\\")) {
    return trimmed.slice(0, 500);
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" && !parsed.username && !parsed.password) {
      return parsed.toString().slice(0, 500);
    }
  } catch {
    return "";
  }

  return "";
}

function normalizeMenuLanguages(candidate: Record<string, unknown>): CreateRestaurantMenuLanguage[] {
  const values = getStringArray(candidate, ["menuLanguages", "menu_languages"], 4);
  const languages = values.filter((value): value is CreateRestaurantMenuLanguage =>
    MENU_LANGUAGE_VALUES.has(value as CreateRestaurantMenuLanguage)
  );
  return languages.length > 0 ? languages : ["fr"];
}

function getMenuSettingsInput(candidate: Record<string, unknown>): unknown {
  return (
    candidate.publicMenuSettings ??
    candidate.menuSettings ??
    candidate.menu_settings ??
    candidate.settings_json ??
    candidate.settings
  );
}

function normalizeSections(
  candidate: Record<string, unknown>
): { ok: true; value: CreateRestaurantSectionInput[] } | { ok: false; error: string } {
  const rawSections = candidate.sections;
  if (rawSections === undefined) return { ok: true, value: [] };
  if (!Array.isArray(rawSections)) {
    return { ok: false, error: "Sections de menu invalides." };
  }

  const seen = new Set<string>();
  const sections: CreateRestaurantSectionInput[] = [];
  for (const rawSection of rawSections.slice(0, 24)) {
    if (!rawSection || typeof rawSection !== "object" || Array.isArray(rawSection)) {
      return { ok: false, error: "Section de menu invalide." };
    }

    const section = rawSection as Record<string, unknown>;
    const name = getString(section, ["name", "label", "title"], "").slice(0, 80);
    if (!name) return { ok: false, error: "Nom de section requis." };
    const dedupeKey = name.toLowerCase();
    if (seen.has(dedupeKey)) {
      return { ok: false, error: "Chaque section doit avoir un nom unique." };
    }
    seen.add(dedupeKey);

    const order = getNumber(section, ["order", "sortOrder", "position"], sections.length + 1);
    sections.push({
      name,
      description: getString(section, ["description", "body"], "").slice(0, 220),
      order: Number.isFinite(order) ? Math.max(1, Math.round(order)) : sections.length + 1
    });
  }

  return { ok: true, value: sections };
}

function normalizePhotoStatus(
  value: string,
  imageUrl: string
): CreateRestaurantDishPhotoStatus {
  if (PHOTO_STATUS_VALUES.has(value as CreateRestaurantDishPhotoStatus)) {
    return value as CreateRestaurantDishPhotoStatus;
  }
  return imageUrl ? "ready" : "planned";
}

function normalizeDishes(
  candidate: Record<string, unknown>,
  sections: CreateRestaurantSectionInput[]
): { ok: true; value: CreateRestaurantDishInput[] } | { ok: false; error: string } {
  const rawDishes = candidate.dishes;
  if (rawDishes === undefined) return { ok: true, value: [] };
  if (!Array.isArray(rawDishes)) {
    return { ok: false, error: "Plats invalides." };
  }

  const sectionNames = new Set(sections.map((section) => section.name.toLowerCase()));
  const dishes: CreateRestaurantDishInput[] = [];
  for (const rawDish of rawDishes.slice(0, 80)) {
    if (!rawDish || typeof rawDish !== "object" || Array.isArray(rawDish)) {
      return { ok: false, error: "Plat invalide." };
    }

    const dish = rawDish as Record<string, unknown>;
    const name = getString(dish, ["name", "title", "dishName"], "").slice(0, 120);
    const section = getString(dish, ["section", "category", "categoryName"], "").slice(0, 80);
    const rawPrice = getString(dish, ["price", "amount"], "");
    const parsedPrice = parsePriceToCents(rawPrice);
    const description = getString(dish, ["description", "summary"], "").slice(0, 360);
    const rawImageUrl = getString(
      dish,
      ["imageUrl", "image_url", "photoUrl", "photo_url"],
      ""
    ).slice(0, 500);
    const imageUrl = normalizeImageUrl(rawImageUrl);
    const photoStatus = normalizePhotoStatus(
      getString(dish, ["photoStatus", "photo_status"], ""),
      imageUrl
    );

    if (!name) return { ok: false, error: "Nom de plat requis." };
    if (!section || !sectionNames.has(section.toLowerCase())) {
      return { ok: false, error: "Chaque plat doit etre relie a une section existante." };
    }
    if (!parsedPrice.ok) {
      return { ok: false, error: parsedPrice.error };
    }
    if (!description) {
      return { ok: false, error: "Description courte requise pour chaque plat." };
    }
    if (rawImageUrl && !imageUrl) {
      return {
        ok: false,
        error: "URL photo invalide. Utilisez une URL https ou un chemin interne."
      };
    }

    dishes.push({
      name,
      section,
      price: parsedPrice.originalInput,
      displayPriceMode: normalizeDisplayPriceMode(
        getString(dish, ["displayPriceMode", "display_price_mode"], ""),
        parsedPrice.originalInput
      ),
      description,
      ...(imageUrl ? { imageUrl } : {}),
      ingredients: getStringArray(dish, ["ingredients", "ingredient_list"], 16),
      allergens: getStringArray(dish, ["allergens", "allergenes", "allergen_list"], 16),
      tags: getStringArray(dish, ["tags", "badges", "labels"], 10),
      options: getStringArray(dish, ["options", "option_list"], 12),
      chefNote: getString(dish, ["chefNote", "chef_note", "houseNote", "house_note"], "").slice(0, 220),
      available: getBoolean(dish, ["available", "isAvailable"], true),
      photoStatus
    });
  }

  return { ok: true, value: dishes };
}

function hasCreationWorkflowPayload(candidate: Record<string, unknown>): boolean {
  return (
    "sections" in candidate ||
    "dishes" in candidate ||
    "menuLanguages" in candidate ||
    "menu_languages" in candidate ||
    "publicMenuSettings" in candidate ||
    "menuSettings" in candidate ||
    "menu_settings" in candidate ||
    "settings_json" in candidate
  );
}

function buildMediaBasePath(restaurantId: string): string {
  return `restaurants/${restaurantId}/photos/`;
}

function buildOwnerQrCodesHref(restaurantId: string): string {
  return `${buildRestaurantDashboardPath(restaurantId)}/qr`;
}

function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function uniqueSlug(baseValue: string, used: Set<string>): string {
  const base = slugifyRestaurantSlug(baseValue) || "item";
  let slug = base;
  let suffix = 2;
  while (used.has(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(slug);
  return slug;
}

function buildTransactionalCreationPayload(
  input: CreateRestaurantInput,
  env?: Record<string, string | undefined>
) {
  const normalizedSlug = slugifyRestaurantSlug(input.slug || input.name);
  const publicMenuUrl = buildPublicMenuUrl(normalizedSlug, env);
  const publicMenuSettings = normalizePublicMenuSettings(input.publicMenuSettings, {
    legacyMenuLanguages: input.menuLanguages
  });
  const menuLanguages = publicMenuSettingsToLegacyMenuLanguages(publicMenuSettings);
  const categorySlugs = new Set<string>();
  const categories = (input.sections ?? []).map((section, index) => ({
    client_id: section.id || `section-${index + 1}`,
    name: section.name,
    slug: uniqueSlug(section.slug || section.name, categorySlugs),
    description: section.description ?? "",
    display_order: section.order ?? index + 1
  }));
  const categorySlugByName = new Map(
    categories.map((category, index) => [
      (input.sections?.[index]?.name ?? category.name).trim().toLowerCase(),
      category.slug
    ])
  );
  const dishSlugs = new Set<string>();
  const dishes = (input.dishes ?? []).map((dish, index) => {
    const parsedPrice = parsePriceToCents(dish.price);
    if (!parsedPrice.ok) {
      throw new Error(parsedPrice.error);
    }
    const badges = dish.tags ?? [];
    const normalizedBadges = badges.map(normalizeLabel);
    const displayPriceMode = normalizeDisplayPriceMode(
      dish.displayPriceMode,
      parsedPrice.originalInput
    );
    const imageUrl = dish.imageUrl ?? "";
    const photoStatus = imageUrl ? "ready" : dish.photoStatus ?? "planned";

    return {
      name: dish.name,
      slug: uniqueSlug(dish.name, dishSlugs),
      category_slug:
        categorySlugByName.get(dish.section.trim().toLowerCase()) ?? categories[0]?.slug ?? "",
      short_description: dish.description,
      description: dish.description,
      price_cents: parsedPrice.cents,
      currency: publicMenuSettings.baseCurrency,
      image_url: imageUrl,
      is_available: dish.available ?? true,
      is_signature: normalizedBadges.includes("signature"),
      is_recommended:
        normalizedBadges.includes("recommande") || normalizedBadges.includes("recommended"),
      has_immersive_view: false,
      allergens: dish.allergens ?? [],
      display_order: index + 1,
      metadata: {
        ingredients: dish.ingredients ?? [],
        options: dish.options ?? [],
        tags: dish.tags ?? [],
        badges,
        chefNote: dish.chefNote ?? "",
        houseNote: dish.chefNote ?? "",
        photoStatus,
        menuLanguages,
        originalPriceInput: parsedPrice.originalInput,
        displayPriceMode,
        createdFromOwnerWizard: true
      }
    };
  });

  return {
    restaurant: {
      name: input.name,
      slug: normalizedSlug,
      location: input.location,
      city: input.location,
      cuisine_type: input.cuisineType,
      status: input.status,
      contact_name: input.contactName,
      contact_email: input.contactEmail,
      contact_phone: input.contactPhone ?? "",
      google_review_url: input.googleReviewUrl ?? "",
      google_review_enabled: Boolean(input.googleReviewUrl),
      notes: input.notes ?? "",
      public_menu_url: publicMenuUrl
    },
    menu: {
      name: "Menu principal",
      slug: "principal",
      status: "published",
      is_primary: true,
      settings_json: serializePublicMenuSettings(publicMenuSettings)
    },
    categories,
    dishes,
    ui_config: {
      theme: "fresh-homemade",
      status: "draft",
      config_json: {
        createdFromOwnerWizard: true,
        menuLanguages,
        publicMenuStyle: publicMenuSettings.publicMenuStyle
      }
    }
  };
}

function getResponseObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

async function createRestaurantRecordWithRpc(
  input: CreateRestaurantInput,
  dependencies: CreateRestaurantRecordDependencies,
  rpc: NonNullable<SupabaseRestaurantClient["rpc"]>
): Promise<CreateRestaurantRecordResult> {
  let payload: ReturnType<typeof buildTransactionalCreationPayload>;
  try {
    payload = buildTransactionalCreationPayload(input, dependencies.env);
  } catch (error) {
    return {
      ok: false,
      status: 400,
      error: error instanceof Error ? error.message : "Formulaire invalide."
    };
  }

  const { data, error } = await rpc("create_owner_restaurant_with_menu", {
    p_payload: payload
  });

  if (error) {
    if (isDuplicateSlugError(error)) {
      return {
        ok: false,
        status: 409,
        error: "Ce slug public existe deja. Choisissez un slug unique."
      };
    }
    return {
      ok: false,
      status: 503,
      error:
        "La creation transactionnelle du restaurant a echoue dans Supabase. Aucune creation partielle n'est confirmee."
    };
  }

  const response = getResponseObject(data);
  if (!response || response.ok !== true) {
    return {
      ok: false,
      status: 502,
      error:
        "Creation invalide : Supabase n'a pas retourne de confirmation transactionnelle."
    };
  }

  const restaurantRow = getResponseObject(response.restaurant);
  if (!restaurantRow || !UUID_PATTERN.test(getString(restaurantRow, ["id"], ""))) {
    return {
      ok: false,
      status: 502,
      error:
        "Creation invalide : Supabase n'a pas retourne d'identifiant Supabase UUID."
    };
  }

  const restaurant = mapCreatedRestaurant(restaurantRow, dependencies.env);
  const mediaBasePath =
    getString(response, ["mediaBasePath", "media_base_path"], "") ||
    buildMediaBasePath(restaurant.id);
  const persistedDishCount = getNumber(response, ["persistedDishCount", "persisted_dish_count"], 0);
  const persistedCategoryCount = getNumber(
    response,
    ["persistedCategoryCount", "persisted_category_count"],
    0
  );
  const photoDishCount = (input.dishes ?? []).filter(
    (dish) => dish.photoStatus === "ready" || Boolean(dish.imageUrl)
  ).length;
  const warnings = Array.isArray(response.warnings)
    ? response.warnings.filter((item): item is string => typeof item === "string")
    : [];

  return {
    ok: true,
    persisted: true,
    dataSource: "supabase",
    restaurant: {
      ...restaurant,
      mediaBasePath,
      dishCount: persistedDishCount,
      photoDishCount,
      incompleteDishCount: Math.max(persistedDishCount - photoDishCount, 0),
      nextAction: "Generer le QR menu"
    },
    restaurantPersisted: true,
    menuPersisted: response.menuPersisted !== false,
    categoriesPersisted: response.categoriesPersisted !== false,
    sectionsPersisted: response.categoriesPersisted !== false,
    dishesPersisted: response.dishesPersisted !== false,
    persistedCategoryCount,
    persistedDishCount,
    menu: getResponseObject(response.menu) ?? undefined,
    mediaBasePath,
    mediaBasePathPersisted: response.mediaBasePathPersisted === true,
    qrCodesHref:
      getString(response, ["qrCodesHref", "qr_codes_href"], "") ||
      buildOwnerQrCodesHref(restaurant.id),
    warnings
  };
}

function getSectionsWithoutDish(
  sections: CreateRestaurantSectionInput[],
  dishes: CreateRestaurantDishInput[]
): string[] {
  const persistedSectionNames = new Set(
    dishes.map((dish) => dish.section.trim().toLowerCase()).filter(Boolean)
  );

  return sections
    .filter((section) => !persistedSectionNames.has(section.name.trim().toLowerCase()))
    .map((section) => section.name);
}

function buildMenuDishInsertRows(args: {
  dishes: CreateRestaurantDishInput[];
  restaurantId: string;
  restaurantSlug: string;
  menuId?: string;
  settings: PublicMenuSettings;
  columns: Set<string>;
}): Record<string, unknown>[] {
  return args.dishes.map((dish, index) => {
    const row: Record<string, unknown> = {};
    const parsedPrice = parsePriceToCents(dish.price);
    const legacyPrice = parsedPrice.ok ? parsedPrice.cents / 100 : dish.price;

    assignMenuDishValue(row, args.columns, ["restaurant_id", "restaurantId"], args.restaurantId);
    assignMenuDishValue(row, args.columns, ["menu_id", "menuId"], args.menuId);
    assignMenuDishValue(
      row,
      args.columns,
      ["restaurant_slug", "restaurantSlug"],
      args.restaurantSlug
    );
    assignMenuDishValue(row, args.columns, ["name", "dish_name", "title"], dish.name);
    assignMenuDishValue(
      row,
      args.columns,
      ["description", "summary"],
      dish.description
    );
    assignMenuDishValue(
      row,
      args.columns,
      ["category_name", "categoryName", "category"],
      dish.section
    );
    assignMenuDishValue(row, args.columns, ["price", "amount", "price_cad"], legacyPrice);
    assignMenuDishValue(row, args.columns, ["price_cents", "priceCents"], parsedPrice.ok ? parsedPrice.cents : 0);
    assignMenuDishValue(row, args.columns, ["currency"], args.settings.baseCurrency);
    assignMenuDishValue(row, args.columns, ["available", "isAvailable"], dish.available ?? true);
    assignMenuDishValue(row, args.columns, ["sort_order", "sortOrder", "position"], index + 1);
    assignMenuDishValue(
      row,
      args.columns,
      ["image_url", "imageUrl", "photo_url", "photoUrl", "image"],
      dish.imageUrl
    );
    assignMenuDishValue(
      row,
      args.columns,
      ["thumbnail_url", "thumbnailUrl"],
      dish.imageUrl
    );
    assignMenuDishValue(
      row,
      args.columns,
      ["ingredients", "ingredient_list"],
      dish.ingredients?.length ? dish.ingredients : undefined
    );
    assignMenuDishValue(
      row,
      args.columns,
      ["allergens", "allergenes", "allergen_list"],
      dish.allergens?.length ? dish.allergens : undefined
    );
    assignMenuDishValue(
      row,
      args.columns,
      ["options", "option_list"],
      dish.options?.length ? dish.options : undefined
    );
    assignMenuDishValue(
      row,
      args.columns,
      ["house_note", "houseNote", "chef_note", "chefNote", "note"],
      dish.chefNote
    );
    assignMenuDishValue(
      row,
      args.columns,
      ["tags", "badges", "labels"],
      dish.tags?.length ? dish.tags : undefined
    );
    assignMenuDishValue(
      row,
      args.columns,
      ["photo_status", "photoStatus"],
      dish.photoStatus
    );

    return row;
  });
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

function normalizeGoogleReviewUrl(value: string): string {
  if (!value.trim()) return "";

  try {
    const parsed = new URL(value.trim());
    if (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      isAllowedGoogleReviewUrl(parsed)
    ) {
      return parsed.toString().slice(0, 500);
    }
  } catch {
    return "";
  }

  return "";
}

function isDuplicateSlugError(error: SupabaseInsertError): boolean {
  const message = error.message ?? "";
  return (
    error.code === "23505" &&
    (/slug/i.test(message) || /restaurants_slug/i.test(message))
  );
}

function createdReadinessItems(): OwnerReadinessItem[] {
  return [
    {
      id: "profile",
      label: "Restaurant",
      detail: "Profil cree dans Supabase, a completer avant mise en ligne.",
      status: "needs_setup"
    },
    {
      id: "menu",
      label: "Menu actif",
      detail: "Aucun plat relie pour l'instant.",
      status: "missing"
    },
    {
      id: "photos",
      label: "Photos",
      detail: "Photos a ajouter avec les plats.",
      status: "missing"
    },
    {
      id: "immersive",
      label: "Medias",
      detail: "Aucun modele 3D/AR detecte.",
      status: "needs_setup"
    },
    {
      id: "qr",
      label: "QR menu",
      detail: "QR generable depuis le lien menu public.",
      status: "needs_setup"
    }
  ];
}

function mapCreatedRestaurant(row: Record<string, unknown>, env?: Record<string, string | undefined>): OwnerRestaurant {
  const name = getString(row, ["name", "restaurant_name"], "Restaurant");
  const slug = getString(row, ["slug", "restaurant_slug"], slugifyRestaurantSlug(name));
  const id = getString(row, ["id", "restaurant_id"], "");
  const status = normalizeStatus(getString(row, ["status"], "setup_needed"));
  const publicMenuPath = buildPublicMenuPath(slug);
  const publicMenuUrl = buildPublicMenuUrl(slug, env);
  const readinessItems = createdReadinessItems();
  const mediaBasePath = getString(
    row,
    RESTAURANT_MEDIA_BASE_PATH_COLUMNS,
    id ? buildMediaBasePath(id) : ""
  );

  return {
    id,
    name,
    slug,
    isDemo: false,
    location: getString(row, ["location", "city", "address"], "Emplacement a preciser"),
    cuisineType: getString(row, ["cuisine_type", "cuisineType"], "Cuisine a preciser"),
    status,
    statusLabel: STATUS_LABELS[status],
    dishCount: 0,
    photoDishCount: 0,
    immersiveDishCount: 0,
    incompleteDishCount: 0,
    openingsToday: 0,
    interactionsToday: 0,
    lastActivity: "A l'instant",
    clientMenuHref: publicMenuPath,
    menuUrl: publicMenuUrl,
    menuUrlSource: "derived_preview",
    publicMenuPath,
    publicMenuUrl,
    mediaBasePath,
    dashboardHref: buildRestaurantDashboardPath(id),
    qrTargetUrl: publicMenuUrl,
    qrCodeUrl: null,
    qrStatus: "generable",
    qrStatusLabel: "QR generable",
    readinessScore: 0,
    readinessItems,
    nextAction: "Ajouter les plats du menu",
    contactName: getString(row, ["contact_name", "contactName"], ""),
    contactEmail: getString(row, ["contact_email", "contactEmail"], ""),
    contactPhone: getString(row, ["contact_phone", "contactPhone", "phone"], ""),
    notes: getString(row, ["notes", "internal_notes"], "")
  };
}

export function validateCreateRestaurantInput(
  input: unknown
): { ok: true; value: CreateRestaurantInput } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Formulaire invalide." };
  }

  const candidate = input as Record<string, unknown>;
  const name = getString(candidate, ["name"], "").slice(0, 120);
  const slug = slugifyRestaurantSlug(getString(candidate, ["slug"], name)).slice(0, 80);
  const location = getString(candidate, ["location"], "").slice(0, 160);
  const cuisineType = getString(candidate, ["cuisineType", "cuisine_type"], "").slice(0, 120);
  const status = normalizeStatus(getString(candidate, ["status"], "setup_needed"));
  const contactName = getString(candidate, ["contactName", "contact_name"], "").slice(0, 120);
  const contactEmail = getString(candidate, ["contactEmail", "contact_email"], "").slice(0, 160);
  const contactPhone = getString(candidate, ["contactPhone", "contact_phone"], "").slice(0, 60);
  const rawGoogleReviewUrl = getString(
    candidate,
    ["googleReviewUrl", "google_review_url", "google_reviews_url"],
    ""
  ).slice(0, 500);
  const googleReviewUrl = normalizeGoogleReviewUrl(rawGoogleReviewUrl);
  const notes = getString(candidate, ["notes"], "").slice(0, 800);
  const workflowPayload = hasCreationWorkflowPayload(candidate);
  const legacyMenuLanguages = normalizeMenuLanguages(candidate);
  const normalizedSettings = validatePublicMenuSettingsInput(getMenuSettingsInput(candidate), {
    legacyMenuLanguages
  });
  if (!normalizedSettings.ok) return normalizedSettings;
  const menuLanguages = publicMenuSettingsToLegacyMenuLanguages(normalizedSettings.value);
  const normalizedSections = normalizeSections(candidate);
  if (!normalizedSections.ok) return normalizedSections;
  const normalizedDishes = normalizeDishes(candidate, normalizedSections.value);
  if (!normalizedDishes.ok) return normalizedDishes;

  if (!name || name.length < 2) {
    return { ok: false, error: "Nom du restaurant requis." };
  }
  if (!slug || slug.length < 2) return { ok: false, error: "Slug invalide." };
  if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { ok: false, error: "Email contact invalide." };
  }
  if (rawGoogleReviewUrl && !googleReviewUrl) {
    return { ok: false, error: "Lien Google Reviews invalide." };
  }
  if (workflowPayload && normalizedSections.value.length === 0) {
    return { ok: false, error: "Ajoutez au moins une section de menu." };
  }
  if (workflowPayload && normalizedDishes.value.length === 0) {
    return { ok: false, error: "Ajoutez au moins un plat." };
  }

  return {
    ok: true,
    value: {
      name,
      slug,
      location,
      cuisineType,
      status,
      contactName,
      contactEmail,
      ...(contactPhone ? { contactPhone } : {}),
      ...(googleReviewUrl ? { googleReviewUrl } : {}),
      ...(notes ? { notes } : {}),
      ...(workflowPayload ? { menuLanguages } : {}),
      ...(workflowPayload ? { publicMenuSettings: normalizedSettings.value } : {}),
      ...(workflowPayload ? { sections: normalizedSections.value } : {}),
      ...(workflowPayload ? { dishes: normalizedDishes.value } : {})
    }
  };
}

export async function createRestaurantRecord(
  input: CreateRestaurantInput,
  dependencies: CreateRestaurantRecordDependencies
): Promise<CreateRestaurantRecordResult> {
  if (!dependencies.admin.ok) {
    return {
      ok: false,
      status: 503,
      error:
        "Creation impossible : Supabase n'est pas configure pour persister les restaurants."
    };
  }

  if (typeof dependencies.admin.client.rpc === "function") {
    return createRestaurantRecordWithRpc(
      input,
      dependencies,
      dependencies.admin.client.rpc.bind(dependencies.admin.client)
    );
  }

  const columns = await dependencies.getColumns("restaurants");
  const row: Record<string, unknown> = {};
  const normalizedSlug = slugifyRestaurantSlug(input.slug || input.name);

  assignInsertValue(row, columns, ["name", "restaurant_name"], input.name);
  assignInsertValue(row, columns, ["slug", "restaurant_slug"], normalizedSlug);
  assignInsertValue(row, columns, ["location", "city"], input.location);
  assignInsertValue(row, columns, ["cuisine_type", "cuisineType"], input.cuisineType);
  assignInsertValue(row, columns, ["status"], input.status);
  assignInsertValue(row, columns, ["contact_name", "contactName"], input.contactName);
  assignInsertValue(row, columns, ["contact_email", "contactEmail"], input.contactEmail);
  assignInsertValue(row, columns, ["contact_phone", "contactPhone", "phone"], input.contactPhone);
  assignInsertValue(
    row,
    columns,
    ["google_review_url", "googleReviewUrl", "google_reviews_url"],
    input.googleReviewUrl
  );
  assignInsertValue(
    row,
    columns,
    ["google_review_enabled", "googleReviewEnabled", "google_reviews_enabled"],
    input.googleReviewUrl ? true : undefined
  );
  assignInsertValue(row, columns, ["notes", "internal_notes"], input.notes);

  const { data, error } = await dependencies.admin.client
    .from("restaurants")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    if (isDuplicateSlugError(error)) {
      return {
        ok: false,
        status: 409,
        error: "Ce slug public existe deja. Choisissez un slug unique."
      };
    }

    return {
      ok: false,
      status: 503,
      error:
        "Le restaurant n'a pas pu etre cree dans Supabase. Verifiez la table restaurants et les champs."
    };
  }

  if (!data || !UUID_PATTERN.test(getString(data, ["id", "restaurant_id"], ""))) {
    return {
      ok: false,
      status: 502,
      error:
        "Creation invalide : Supabase n'a pas retourne d'identifiant Supabase UUID."
    };
  }

  let restaurant = mapCreatedRestaurant(data, dependencies.env);
  const restaurantId = restaurant.id;
  const restaurantSlug = restaurant.slug;
  const warnings: string[] = [];
  const mediaBasePath = buildMediaBasePath(restaurantId);
  let mediaBasePathPersisted = false;
  const inputDishes = input.dishes ?? [];
  const inputSections = input.sections ?? [];
  const publicMenuSettings = normalizePublicMenuSettings(input.publicMenuSettings, {
    legacyMenuLanguages: input.menuLanguages
  });
  let persistedDishCount = 0;
  let dishesPersisted = true;
  let sectionsPersisted = true;
  let menuPersisted = false;
  let menuRow: Record<string, unknown> | undefined;

  const mediaBasePathColumn = pickColumn(columns, RESTAURANT_MEDIA_BASE_PATH_COLUMNS);
  if (mediaBasePathColumn) {
    const { error: mediaBasePathError } = await dependencies.admin.client
      .from("restaurants")
      .update({ [mediaBasePathColumn]: mediaBasePath })
      .eq("id", restaurantId);

    if (mediaBasePathError) {
      warnings.push(MEDIA_BASE_PATH_UPDATE_WARNING);
    } else {
      mediaBasePathPersisted = true;
    }
  } else {
    warnings.push(MEDIA_BASE_PATH_UNSAVED_WARNING);
  }

  restaurant = {
    ...restaurant,
    mediaBasePath
  };

  try {
    const menuColumns = await dependencies.getColumns("menus");
    const menuInsert: Record<string, unknown> = {};
    assignInsertValue(menuInsert, menuColumns, ["restaurant_id", "restaurantId"], restaurantId);
    assignInsertValue(menuInsert, menuColumns, ["name"], "Menu principal");
    assignInsertValue(menuInsert, menuColumns, ["slug"], "principal");
    assignInsertValue(menuInsert, menuColumns, ["status"], "published");
    assignInsertValue(menuInsert, menuColumns, ["is_primary", "isPrimary"], true);
    if (menuColumns.has("settings_json")) {
      assignInsertValue(
        menuInsert,
        menuColumns,
        ["settings_json", "settingsJson"],
        serializePublicMenuSettings(publicMenuSettings)
      );
    } else {
      warnings.push(MENU_SETTINGS_WARNING);
    }

    if (Object.keys(menuInsert).length > 0) {
      const { data: insertedMenu, error: menuError } = await dependencies.admin.client
        .from("menus")
        .insert(menuInsert)
        .select("*")
        .single();
      if (menuError || !insertedMenu) {
        warnings.push("Le menu principal n'a pas pu etre persiste sans RPC.");
      } else {
        menuPersisted = true;
        menuRow = insertedMenu;
      }
    }
  } catch {
    warnings.push("La table menus est indisponible pour le fallback de creation.");
  }

  if (inputDishes.length > 0) {
    let menuDishColumns = new Set<string>();
    try {
      menuDishColumns = await dependencies.getColumns("menu_dishes");
    } catch {
      menuDishColumns = new Set<string>();
    }

    const dishRows = buildMenuDishInsertRows({
      dishes: inputDishes,
      restaurantId,
      restaurantSlug,
      menuId: getString(menuRow ?? {}, ["id", "menu_id"], ""),
      settings: publicMenuSettings,
      columns: menuDishColumns
    });

    const { error: dishError } = await dependencies.admin.client
      .from("menu_dishes")
      .insert(dishRows);

    if (dishError) {
      dishesPersisted = false;
      sectionsPersisted = false;
      warnings.push(
        "Les plats n'ont pas pu etre persistes dans menu_dishes. Verifiez la table et ses colonnes."
      );
    } else {
      persistedDishCount = dishRows.length;
      const sectionsWithoutDish = getSectionsWithoutDish(inputSections, inputDishes);
      if (sectionsWithoutDish.length > 0) {
        sectionsPersisted = false;
        warnings.push(
          `${SECTION_WITHOUT_DISH_WARNING_PREFIX}${sectionsWithoutDish.join(", ")}.`
        );
      }
      const photoDishCount = inputDishes.filter((dish) => dish.photoStatus === "ready").length;
      restaurant = {
        ...restaurant,
        dishCount: persistedDishCount,
        photoDishCount,
        incompleteDishCount: Math.max(persistedDishCount - photoDishCount, 0),
        nextAction: "Generer le QR menu"
      };
    }
  }

  if (
    inputSections.some((section) => section.description?.trim()) &&
    sectionsPersisted
  ) {
    warnings.push(SECTION_DESCRIPTION_WARNING);
  }

  return {
    ok: true,
    persisted: true,
    dataSource: "supabase",
    restaurant,
    restaurantPersisted: true,
    menuPersisted,
    categoriesPersisted: sectionsPersisted,
    sectionsPersisted,
    dishesPersisted,
    persistedCategoryCount: sectionsPersisted ? inputSections.length : 0,
    persistedDishCount,
    menu: menuRow,
    mediaBasePath,
    mediaBasePathPersisted,
    qrCodesHref: buildOwnerQrCodesHref(restaurantId),
    warnings
  };
}
