import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizePublicMenuSettings,
  serializePublicMenuSettings,
  type PublicMenuSettings
} from "@/lib/menu/publicMenuSettings";
import { slugifyRestaurantSlug } from "@/lib/owner/menuUrlCore";
import { parsePriceToCents } from "@/lib/owner/price";
import {
  isMissingColumnError as isMissingSettingsColumnError,
  readPublicMenuSettingsWithFallbacks
} from "@/lib/owner/publicMenuSettingsFallback";
import {
  collectDishMediaStorageTargets,
  deleteDishMediaStorageTargets
} from "@/lib/owner/dishMediaGarbageCollector";
import {
  legacyAllergensFromDeclarations,
  normalizeAllergenData,
  validateAllergenDeclarations,
  type DishAllergenDeclaration
} from "@/lib/menu/allergens";

type MenuMutationResult =
  | { ok: true; record: Record<string, unknown> }
  | { ok: false; status: 400 | 404 | 409 | 503; error: string };

type PrimaryMenu = {
  id: string;
  settingsJson: unknown;
  metadata?: unknown;
};

type MenuRow = {
  id?: unknown;
  slug?: unknown;
  status?: unknown;
  is_primary?: unknown;
  settings_json?: unknown;
  metadata?: unknown;
};

type MenuRowsResult =
  | { ok: true; rows: MenuRow[]; supportsSettingsJson: boolean }
  | { ok: false; status: 503; error: string };

type PrimaryMenuResult =
  | { ok: true; menu: PrimaryMenu }
  | { ok: false; status: 400 | 404 | 409 | 503; error: string };

function objectInput(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringInput(value: unknown, maxLength = 240): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function stringListInput(value: unknown, maxItems = 24, maxLength = 120): string[] {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;\n]+/)
      : [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const rawItem of rawItems) {
    const item = String(rawItem ?? "").trim().slice(0, maxLength);
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    if (items.length >= maxItems) break;
  }
  return items;
}

function mergeStringListInput(...values: unknown[]): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const value of values) {
    for (const item of stringListInput(value)) {
      const key = item.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }
  return items;
}

function booleanInput(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function priceInput(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/[^\d,.-]/g, "")
    .slice(0, 24);
}

function allergenInput(candidate: Record<string, unknown>): {
  declarations: DishAllergenDeclaration[];
  legacyValues: string[];
  explicit: boolean;
} | { error: string } {
  const legacyValues = stringListInput(candidate.allergens);
  const rawDeclarations = candidate.allergenDeclarations ?? candidate.allergen_declarations;
  try {
    const declarations =
      rawDeclarations === undefined
        ? normalizeAllergenData(undefined, legacyValues).declarations
        : validateAllergenDeclarations(rawDeclarations);
    return {
      declarations,
      legacyValues: legacyAllergensFromDeclarations(declarations, legacyValues),
      explicit: rawDeclarations !== undefined
    };
  } catch {
    return { error: "Declarations allergenes invalides." };
  }
}

function persistedAllergenDeclarations(
  data: ReturnType<typeof allergenInput>
): DishAllergenDeclaration[] | null {
  if ("error" in data) return null;
  return data.explicit || data.declarations.length > 0 ? data.declarations : null;
}

function preserveExistingAllergenDeclarations(
  data: ReturnType<typeof allergenInput>,
  existing: unknown
): DishAllergenDeclaration[] | null {
  if ("error" in data) return null;
  if (data.explicit) return data.declarations;
  if (Array.isArray(existing)) {
    try {
      return validateAllergenDeclarations(existing);
    } catch {
      // A malformed legacy row remains fail-closed and requires owner review.
    }
  }
  return persistedAllergenDeclarations(data);
}

function isUniqueViolation(error: unknown): boolean {
  return objectInput(error).code === "23505";
}

async function fetchPrimaryMenuRows(
  client: SupabaseClient,
  restaurantId: string
): Promise<MenuRowsResult> {
  const withSettings = await client
    .from("menus")
    .select("id,slug,status,is_primary,settings_json,metadata")
    .eq("restaurant_id", restaurantId)
    .limit(50);

  if (!withSettings.error) {
    return {
      ok: true,
      rows: Array.isArray(withSettings.data) ? withSettings.data : [],
      supportsSettingsJson: true
    };
  }

  if (!isMissingSettingsColumnError(withSettings.error, "settings_json")) {
    return { ok: false, status: 503, error: "Menu principal impossible a charger." };
  }

  const withMetadata = await client
    .from("menus")
    .select("id,slug,status,is_primary,metadata")
    .eq("restaurant_id", restaurantId)
    .limit(50);

  if (!withMetadata.error) {
    return {
      ok: true,
      rows: Array.isArray(withMetadata.data) ? withMetadata.data : [],
      supportsSettingsJson: false
    };
  }

  if (!isMissingSettingsColumnError(withMetadata.error, "metadata")) {
    return { ok: false, status: 503, error: "Menu principal impossible a charger." };
  }

  const withoutSettings = await client
    .from("menus")
    .select("id,slug,status,is_primary")
    .eq("restaurant_id", restaurantId)
    .limit(50);

  if (withoutSettings.error) {
    return { ok: false, status: 503, error: "Menu principal impossible a charger." };
  }

  return {
    ok: true,
    rows: Array.isArray(withoutSettings.data) ? withoutSettings.data : [],
    supportsSettingsJson: false
  };
}

function selectPrimaryMenu(rows: MenuRow[]): PrimaryMenu | null {
  const activeRows = rows.filter((row) => String(row.status ?? "") !== "archived");
  const primary =
    activeRows.find((row) => row.is_primary === true && row.status === "published") ??
    activeRows.find((row) => row.is_primary === true) ??
    activeRows.find((row) => row.slug === "principal") ??
    activeRows[0];

  if (!primary?.id) return null;
  return {
    id: String(primary.id),
    settingsJson: primary.settings_json,
    metadata: primary.metadata
  };
}

async function refetchPrimaryMenuAfterConflict(
  client: SupabaseClient,
  restaurantId: string
): Promise<PrimaryMenu | null> {
  const menus = await fetchPrimaryMenuRows(client, restaurantId);
  return menus.ok ? selectPrimaryMenu(menus.rows) : null;
}

async function ensurePrimaryMenu(
  client: SupabaseClient,
  restaurantId: string
): Promise<PrimaryMenuResult> {
  const restaurant = await client
    .from("restaurants")
    .select("id")
    .eq("id", restaurantId)
    .maybeSingle();

  if (restaurant.error) {
    return { ok: false, status: 503, error: "Restaurant impossible a verifier." };
  }
  if (!restaurant.data) {
    return { ok: false, status: 404, error: "Restaurant introuvable." };
  }

  const menus = await fetchPrimaryMenuRows(client, restaurantId);
  if (!menus.ok) return menus;

  const primary = selectPrimaryMenu(menus.rows);
  if (primary) return { ok: true, menu: primary };

  const insertPayload: Record<string, unknown> = {
    restaurant_id: restaurantId,
    name: "Menu principal",
    slug: "principal",
    status: "published",
    is_primary: true
  };
  if (menus.supportsSettingsJson) {
    insertPayload.settings_json = serializePublicMenuSettings(normalizePublicMenuSettings({}));
  }

  if (!menus.supportsSettingsJson) {
    const inserted = await client
      .from("menus")
      .insert(insertPayload)
      .select("id")
      .single();

    if (isUniqueViolation(inserted.error)) {
      const existing = await refetchPrimaryMenuAfterConflict(client, restaurantId);
      if (existing) return { ok: true, menu: existing };
    }
    if (inserted.error || !inserted.data?.id) {
      return { ok: false, status: 503, error: "Menu principal impossible a creer." };
    }

    return {
      ok: true,
      menu: {
        id: String(inserted.data.id),
        settingsJson: undefined,
        metadata: undefined
      }
    };
  }

  const inserted = await client
    .from("menus")
    .insert(insertPayload)
    .select("id,settings_json")
    .single();

  if (isUniqueViolation(inserted.error)) {
    const existing = await refetchPrimaryMenuAfterConflict(client, restaurantId);
    if (existing) return { ok: true, menu: existing };
  }
  if (inserted.error || !inserted.data?.id) {
    return { ok: false, status: 503, error: "Menu principal impossible a creer." };
  }

  return {
    ok: true,
    menu: {
      id: String(inserted.data.id),
      settingsJson: inserted.data.settings_json,
      metadata: undefined
    }
  };
}

async function readEffectiveMenuSettings(args: {
  client: SupabaseClient;
  restaurantId: string;
  menuId: string;
  menuRow?: unknown;
}): Promise<PublicMenuSettings> {
  return readPublicMenuSettingsWithFallbacks(args);
}

async function uniqueSlug(args: {
  client: SupabaseClient;
  table: "menu_categories" | "menu_dishes";
  menuId: string;
  name: string;
  fallback: string;
  excludeId?: string;
}): Promise<string> {
  const base = slugifyRestaurantSlug(args.name) || args.fallback;
  const existing = await args.client
    .from(args.table)
    .select("id,slug")
    .eq("menu_id", args.menuId)
    .limit(1000);
  const used = new Set(
    (existing.data ?? [])
      .filter((row) => String(row.id ?? "") !== args.excludeId)
      .map((row) => String(row.slug ?? ""))
      .filter(Boolean)
  );
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

async function nextCategoryOrder(
  client: SupabaseClient,
  menuId: string
): Promise<number> {
  const current = await client
    .from("menu_categories")
    .select("display_order")
    .eq("menu_id", menuId)
    .order("display_order", { ascending: false })
    .limit(1);
  const value = Number(current.data?.[0]?.display_order ?? 0);
  return Number.isFinite(value) ? value + 1 : 1;
}

export async function createOwnerMenuCategory(args: {
  client: SupabaseClient;
  restaurantId: string;
  input: unknown;
}): Promise<MenuMutationResult> {
  const candidate = objectInput(args.input);
  const name = stringInput(candidate.name, 120);
  const description = stringInput(candidate.description, 360);
  if (name.length < 2) {
    return { ok: false, status: 400, error: "Nom de section requis." };
  }

  const menuResult = await ensurePrimaryMenu(args.client, args.restaurantId);
  if (!menuResult.ok) return menuResult;
  const slug = await uniqueSlug({
    client: args.client,
    table: "menu_categories",
    menuId: menuResult.menu.id,
    name,
    fallback: "section"
  });

  const inserted = await args.client
    .from("menu_categories")
    .insert({
      restaurant_id: args.restaurantId,
      menu_id: menuResult.menu.id,
      name,
      slug,
      description,
      display_order: await nextCategoryOrder(args.client, menuResult.menu.id)
    })
    .select("id,name,slug,description,display_order")
    .single();

  if (inserted.error || !inserted.data) {
    if (isUniqueViolation(inserted.error)) {
      return { ok: false, status: 409, error: "Une section avec ce nom existe deja." };
    }
    return { ok: false, status: 503, error: "Section impossible a creer." };
  }
  return { ok: true, record: inserted.data };
}

export async function updateOwnerMenuCategory(args: {
  client: SupabaseClient;
  restaurantId: string;
  input: unknown;
}): Promise<MenuMutationResult> {
  const candidate = objectInput(args.input);
  const id = stringInput(candidate.id, 80);
  const name = stringInput(candidate.name, 120);
  const description = stringInput(candidate.description, 360);
  if (!id) return { ok: false, status: 400, error: "Section requise." };
  if (name.length < 2) {
    return { ok: false, status: 400, error: "Nom de section requis." };
  }

  const existing = await args.client
    .from("menu_categories")
    .select("id,menu_id")
    .eq("id", id)
    .eq("restaurant_id", args.restaurantId)
    .maybeSingle();
  if (existing.error) {
    return { ok: false, status: 503, error: "Section impossible a verifier." };
  }
  if (!existing.data?.id || !existing.data.menu_id) {
    return { ok: false, status: 404, error: "Section introuvable." };
  }

  const slug = await uniqueSlug({
    client: args.client,
    table: "menu_categories",
    menuId: String(existing.data.menu_id),
    name,
    fallback: "section",
    excludeId: id
  });
  const updated = await args.client
    .from("menu_categories")
    .update({
      name,
      slug,
      description,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("restaurant_id", args.restaurantId)
    .select("id,name,slug,description,display_order")
    .maybeSingle();

  if (updated.error || !updated.data) {
    return { ok: false, status: 503, error: "Section impossible a modifier." };
  }
  return { ok: true, record: updated.data };
}

export async function deleteOwnerMenuCategory(args: {
  client: SupabaseClient;
  restaurantId: string;
  input: unknown;
}): Promise<MenuMutationResult> {
  const candidate = objectInput(args.input);
  const id = stringInput(candidate.id, 80);
  if (!id) return { ok: false, status: 400, error: "Section requise." };

  const existing = await args.client
    .from("menu_categories")
    .select("id,name,menu_id")
    .eq("id", id)
    .eq("restaurant_id", args.restaurantId)
    .maybeSingle();
  if (existing.error) {
    return { ok: false, status: 503, error: "Section impossible a verifier." };
  }
  if (!existing.data?.id) {
    return { ok: false, status: 404, error: "Section introuvable." };
  }

  const dishCount = await args.client
    .from("menu_dishes")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", args.restaurantId)
    .eq("menu_id", String(existing.data.menu_id ?? ""))
    .eq("category_id", id);
  if (dishCount.error) {
    return { ok: false, status: 503, error: "Plats de la section impossibles a verifier." };
  }
  if ((dishCount.count ?? 0) > 0) {
    return {
      ok: false,
      status: 409,
      error: "Impossible de supprimer cette section : supprimez ou deplacez ses plats avant."
    };
  }

  const deleted = await args.client
    .from("menu_categories")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", args.restaurantId)
    .select("id,name,menu_id")
    .maybeSingle();

  if (deleted.error) {
    return { ok: false, status: 503, error: "Section impossible a supprimer." };
  }
  if (!deleted.data?.id) {
    return { ok: false, status: 404, error: "Section introuvable." };
  }
  return { ok: true, record: deleted.data };
}

async function categoryForDish(args: {
  client: SupabaseClient;
  restaurantId: string;
  menuId: string;
  categoryId: string;
}) {
  return args.client
    .from("menu_categories")
    .select("id")
    .eq("id", args.categoryId)
    .eq("restaurant_id", args.restaurantId)
    .eq("menu_id", args.menuId)
    .maybeSingle();
}

function dishMetadata(
  existing: unknown,
  parsedPrice: ReturnType<typeof parsePriceToCents>,
  candidate: Record<string, unknown> = {}
) {
  const metadata: Record<string, unknown> = {
    ...jsonObject(existing),
    displayPriceMode: parsedPrice.ok ? parsedPrice.displayPriceMode : "auto",
    originalPriceInput: parsedPrice.ok ? parsedPrice.originalInput : ""
  };
  const ingredients = stringListInput(candidate.ingredients);
  const allergens = stringListInput(candidate.allergens);
  const tags = mergeStringListInput(candidate.tags, candidate.badges);
  const options = mergeStringListInput(
    candidate.options,
    candidate.extras,
    candidate.accompaniments
  );
  const chefNote = stringInput(candidate.chefNote ?? candidate.chef_note, 500);

  if ("ingredients" in candidate) metadata.ingredients = ingredients;
  if ("allergens" in candidate) metadata.allergens = allergens;
  if ("tags" in candidate || "badges" in candidate) {
    metadata.tags = tags;
    metadata.badges = tags;
  }
  if (
    "options" in candidate ||
    "extras" in candidate ||
    "accompaniments" in candidate
  ) {
    metadata.options = options;
  }
  if ("chefNote" in candidate || "chef_note" in candidate) {
    if (chefNote) {
      metadata.chefNote = chefNote;
      metadata.houseNote = chefNote;
    } else {
      delete metadata.chefNote;
      delete metadata.houseNote;
    }
  }

  return metadata;
}

export async function createOwnerMenuDish(args: {
  client: SupabaseClient;
  restaurantId: string;
  input: unknown;
}): Promise<MenuMutationResult> {
  const candidate = objectInput(args.input);
  const name = stringInput(candidate.name, 140);
  const description = stringInput(candidate.description, 800);
  const categoryId = stringInput(candidate.categoryId ?? candidate.category_id, 80);
  const parsedPrice = parsePriceToCents(priceInput(candidate.price));
  const available = booleanInput(candidate.available, true);
  const allergenData = allergenInput(candidate);
  if ("error" in allergenData) {
    return { ok: false, status: 400, error: allergenData.error };
  }
  const allergens = allergenData.legacyValues;
  if (name.length < 2) return { ok: false, status: 400, error: "Nom du plat requis." };
  if (!categoryId) return { ok: false, status: 400, error: "Section du plat requise." };
  if (!parsedPrice.ok) return { ok: false, status: 400, error: parsedPrice.error };

  const menuResult = await ensurePrimaryMenu(args.client, args.restaurantId);
  if (!menuResult.ok) return menuResult;
  const category = await categoryForDish({
    client: args.client,
    restaurantId: args.restaurantId,
    menuId: menuResult.menu.id,
    categoryId
  });
  if (category.error) {
    return { ok: false, status: 503, error: "Section impossible a verifier." };
  }
  if (!category.data?.id) {
    return { ok: false, status: 404, error: "Section introuvable pour ce restaurant." };
  }

  const settings = await readEffectiveMenuSettings({
    client: args.client,
    restaurantId: args.restaurantId,
    menuId: menuResult.menu.id,
    menuRow: menuResult.menu
  });
  const slug = await uniqueSlug({
    client: args.client,
    table: "menu_dishes",
    menuId: menuResult.menu.id,
    name,
    fallback: "plat"
  });
  const inserted = await args.client
    .from("menu_dishes")
    .insert({
      restaurant_id: args.restaurantId,
      menu_id: menuResult.menu.id,
      category_id: categoryId,
      slug,
      name,
      short_description: description,
      description,
      price_cents: parsedPrice.cents,
      currency: settings.baseCurrency,
      is_available: available,
      has_immersive_view: false,
      allergens,
      allergen_declarations: persistedAllergenDeclarations(allergenData),
      metadata: dishMetadata({ photoStatus: "planned" }, parsedPrice, candidate)
    })
    .select("id,name,slug,category_id,price_cents,currency")
    .single();

  if (inserted.error || !inserted.data) {
    if (isUniqueViolation(inserted.error)) {
      return { ok: false, status: 409, error: "Un plat avec ce nom existe deja." };
    }
    return { ok: false, status: 503, error: "Plat impossible a creer." };
  }
  return { ok: true, record: inserted.data };
}

export async function updateOwnerMenuDish(args: {
  client: SupabaseClient;
  restaurantId: string;
  input: unknown;
}): Promise<MenuMutationResult> {
  const candidate = objectInput(args.input);
  const id = stringInput(candidate.id, 80);
  const name = stringInput(candidate.name, 140);
  const description = stringInput(candidate.description, 800);
  const categoryId = stringInput(candidate.categoryId ?? candidate.category_id, 80);
  const parsedPrice = parsePriceToCents(priceInput(candidate.price));
  const available = booleanInput(candidate.available, true);
  const allergenData = allergenInput(candidate);
  if ("error" in allergenData) {
    return { ok: false, status: 400, error: allergenData.error };
  }
  const allergens = allergenData.legacyValues;
  if (!id) return { ok: false, status: 400, error: "Plat requis." };
  if (name.length < 2) return { ok: false, status: 400, error: "Nom du plat requis." };
  if (!categoryId) return { ok: false, status: 400, error: "Section du plat requise." };
  if (!parsedPrice.ok) return { ok: false, status: 400, error: parsedPrice.error };

  const existing = await args.client
    .from("menu_dishes")
    .select("id,menu_id,metadata,allergen_declarations")
    .eq("id", id)
    .eq("restaurant_id", args.restaurantId)
    .maybeSingle();
  if (existing.error) {
    return { ok: false, status: 503, error: "Plat impossible a verifier." };
  }
  if (!existing.data?.id || !existing.data.menu_id) {
    return { ok: false, status: 404, error: "Plat introuvable." };
  }

  const category = await categoryForDish({
    client: args.client,
    restaurantId: args.restaurantId,
    menuId: String(existing.data.menu_id),
    categoryId
  });
  if (category.error) {
    return { ok: false, status: 503, error: "Section impossible a verifier." };
  }
  if (!category.data?.id) {
    return { ok: false, status: 404, error: "Section introuvable pour ce restaurant." };
  }

  const settings = await readEffectiveMenuSettings({
    client: args.client,
    restaurantId: args.restaurantId,
    menuId: String(existing.data.menu_id)
  });
  const slug = await uniqueSlug({
    client: args.client,
    table: "menu_dishes",
    menuId: String(existing.data.menu_id),
    name,
    fallback: "plat",
    excludeId: id
  });
  const updated = await args.client
    .from("menu_dishes")
    .update({
      category_id: categoryId,
      slug,
      name,
      short_description: description,
      description,
      price_cents: parsedPrice.cents,
      currency: settings.baseCurrency,
      is_available: available,
      allergens,
      allergen_declarations: preserveExistingAllergenDeclarations(
        allergenData,
        existing.data.allergen_declarations
      ),
      metadata: dishMetadata(existing.data.metadata, parsedPrice, candidate),
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("restaurant_id", args.restaurantId)
    .select("id,name,slug,category_id,price_cents,currency")
    .maybeSingle();

  if (updated.error || !updated.data) {
    return { ok: false, status: 503, error: "Plat impossible a modifier." };
  }
  return { ok: true, record: updated.data };
}

export async function deleteOwnerMenuDish(args: {
  client: SupabaseClient;
  restaurantId: string;
  input: unknown;
}): Promise<MenuMutationResult> {
  const candidate = objectInput(args.input);
  const id = stringInput(candidate.id, 80);
  if (!id) return { ok: false, status: 400, error: "Plat requis." };

  const existing = await args.client
    .from("menu_dishes")
    .select("id,name,slug,menu_id,category_id,metadata")
    .eq("id", id)
    .eq("restaurant_id", args.restaurantId)
    .maybeSingle();
  if (existing.error) {
    return { ok: false, status: 503, error: "Plat impossible a verifier." };
  }
  if (!existing.data?.id) {
    return { ok: false, status: 404, error: "Plat introuvable." };
  }
  const mediaCleanup = await deleteDishMediaStorageTargets(
    args.client,
    collectDishMediaStorageTargets(existing.data.metadata, args.restaurantId)
  );
  if (mediaCleanup.warnings.some((warning) => warning.includes("non supprime") || warning.includes("indisponible"))) {
    return {
      ok: false,
      status: 503,
      error: "Medias du plat impossibles a supprimer dans Storage."
    };
  }

  const deleted = await args.client
    .from("menu_dishes")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", args.restaurantId)
    .select("id,name,slug,menu_id,category_id")
    .maybeSingle();

  if (deleted.error) {
    return { ok: false, status: 503, error: "Plat impossible a supprimer." };
  }
  if (!deleted.data?.id) {
    return { ok: false, status: 404, error: "Plat introuvable." };
  }
  return { ok: true, record: { ...deleted.data, mediaCleanup } };
}
