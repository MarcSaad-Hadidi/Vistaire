import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizePublicMenuSettings,
  serializePublicMenuSettings
} from "@/lib/menu/publicMenuSettings";
import { slugifyRestaurantSlug } from "@/lib/owner/menuUrlCore";
import { parsePriceToCents } from "@/lib/owner/price";

type MenuMutationResult =
  | { ok: true; record: Record<string, unknown> }
  | { ok: false; status: 400 | 404 | 409 | 503; error: string };

type PrimaryMenu = {
  id: string;
  settingsJson: unknown;
};

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

  const menus = await client
    .from("menus")
    .select("id,slug,status,is_primary,settings_json")
    .eq("restaurant_id", restaurantId)
    .limit(50);

  if (menus.error) {
    return { ok: false, status: 503, error: "Menu principal impossible a charger." };
  }

  const rows = Array.isArray(menus.data) ? menus.data : [];
  const activeRows = rows.filter((row) => String(row.status ?? "") !== "archived");
  const primary =
    activeRows.find((row) => row.is_primary === true && row.status === "published") ??
    activeRows.find((row) => row.is_primary === true) ??
    activeRows.find((row) => row.slug === "principal") ??
    activeRows[0];

  if (primary?.id) {
    return {
      ok: true,
      menu: {
        id: String(primary.id),
        settingsJson: primary.settings_json
      }
    };
  }

  const inserted = await client
    .from("menus")
    .insert({
      restaurant_id: restaurantId,
      name: "Menu principal",
      slug: "principal",
      status: "published",
      is_primary: true,
      settings_json: serializePublicMenuSettings(normalizePublicMenuSettings({}))
    })
    .select("id,settings_json")
    .single();

  if (inserted.error || !inserted.data?.id) {
    return { ok: false, status: 503, error: "Menu principal impossible a creer." };
  }

  return {
    ok: true,
    menu: {
      id: String(inserted.data.id),
      settingsJson: inserted.data.settings_json
    }
  };
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
      display_order: await nextCategoryOrder(args.client, menuResult.menu.id),
      metadata: { createdFromOwnerMenu: true }
    })
    .select("id,name,slug,description,display_order")
    .single();

  if (inserted.error || !inserted.data) {
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

function dishMetadata(existing: unknown, parsedPrice: ReturnType<typeof parsePriceToCents>) {
  return {
    ...jsonObject(existing),
    displayPriceMode: parsedPrice.ok ? parsedPrice.displayPriceMode : "auto",
    originalPriceInput: parsedPrice.ok ? parsedPrice.originalInput : ""
  };
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

  const settings = normalizePublicMenuSettings(menuResult.menu.settingsJson);
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
      allergens: [],
      metadata: dishMetadata({ photoStatus: "planned" }, parsedPrice)
    })
    .select("id,name,slug,category_id,price_cents,currency")
    .single();

  if (inserted.error || !inserted.data) {
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
  if (!id) return { ok: false, status: 400, error: "Plat requis." };
  if (name.length < 2) return { ok: false, status: 400, error: "Nom du plat requis." };
  if (!categoryId) return { ok: false, status: 400, error: "Section du plat requise." };
  if (!parsedPrice.ok) return { ok: false, status: 400, error: parsedPrice.error };

  const existing = await args.client
    .from("menu_dishes")
    .select("id,menu_id,metadata")
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

  const menu = await args.client
    .from("menus")
    .select("settings_json")
    .eq("id", existing.data.menu_id)
    .maybeSingle();
  const settings = normalizePublicMenuSettings(menu.data?.settings_json);
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
      metadata: dishMetadata(existing.data.metadata, parsedPrice),
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
