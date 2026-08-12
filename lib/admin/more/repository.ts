import "server-only";

import { getSupabaseAdminClient } from "../../../utils/supabase/admin";
import { ALLERGEN_REGISTRY, normalizeAllergenData } from "../../menu/allergens";

type Query = PromiseLike<{ data: unknown; error: unknown }> & {
  eq(column: string, value: string): Query;
  limit(value: number): Query;
};

async function read(table: string, columns: string, equals: Readonly<Record<string, string>>, limit: number) {
  const admin = getSupabaseAdminClient();
  if (!admin.ok) return { ok: false as const, code: "configuration" as const, retryable: false };
  try {
    let query = admin.client.from(table).select(columns) as unknown as Query;
    for (const [column, value] of Object.entries(equals)) query = query.eq(column, value);
    const { data, error } = await query.limit(limit);
    if (error) return { ok: false as const, code: "query" as const, retryable: true };
    return { ok: true as const, rows: Array.isArray(data) ? data as Record<string, unknown>[] : [] };
  } catch {
    return { ok: false as const, code: "query" as const, retryable: true };
  }
}

const text = (row: Record<string, unknown>, key: string) => typeof row[key] === "string" ? (row[key] as string).trim() : "";
const object = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const stringList = (value: unknown): string[] | null => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === "string")
  : null;

export async function readProfile(input: { restaurantId: string }) {
  const result = await read("restaurants", "id,name,slug,location,city,cuisine_type,contact_phone,contact_email", { id: input.restaurantId }, 2);
  if (!result.ok) return result;
  if (result.rows.length > 1 || result.rows.some((row) => text(row, "id") !== input.restaurantId)) return { ok: false as const, code: "scope-integrity" as const, retryable: false };
  const row = result.rows[0];
  return { ok: true as const, profile: row ? {
    restaurantId: text(row, "id"), name: text(row, "name"), slug: text(row, "slug"),
    location: text(row, "location") || text(row, "city"), cuisineType: text(row, "cuisine_type"),
    contactPhone: text(row, "contact_phone"), contactEmail: text(row, "contact_email")
  } : null };
}

export async function readMenu(input: { restaurantId: string; menuId: string }) {
  const result = await read("menus", "id,restaurant_id,status,settings_json", { id: input.menuId, restaurant_id: input.restaurantId }, 2);
  if (!result.ok) return result;
  if (result.rows.length > 1 || result.rows.some((row) => text(row, "id") !== input.menuId || text(row, "restaurant_id") !== input.restaurantId)) return { ok: false as const, code: "scope-integrity" as const, retryable: false };
  const row = result.rows[0];
  return { ok: true as const, menu: row ? { restaurantId: text(row, "restaurant_id"), menuId: text(row, "id"), status: text(row, "status"), settingsJson: row.settings_json } : null };
}

export async function readQr(input: { restaurantId: string; qrId: string | null }) {
  const equals = { restaurant_id: input.restaurantId, ...(input.qrId ? { id: input.qrId } : {}) };
  const result = await read("qr_codes", "id,restaurant_id,status,target_kind,target_path", equals, 100);
  if (!result.ok) return result;
  return { ok: true as const, rows: result.rows.map((row) => ({ restaurantId: text(row, "restaurant_id"), id: text(row, "id"), status: text(row, "status") })) };
}

export async function readDishes(input: { restaurantId: string; menuId: string }) {
  const result = await read(
    "menu_dishes",
    "id,restaurant_id,menu_id,name,short_description,description,image_url,model3d_url,web_model_3d_url,ar_model_3d_url,usdz_url,ar_usdz_url,has_immersive_view,ingredients,allergens,allergen_declarations,metadata",
    { restaurant_id: input.restaurantId, menu_id: input.menuId },
    1001
  );
  if (!result.ok) return result;
  if (result.rows.length > 1000) return { ok: false as const, code: "query" as const, retryable: false };
  return { ok: true as const, rows: result.rows.map((row) => {
    const metadata = object(row.metadata);
    const legacyAllergens = stringList(row.allergens) ?? stringList(metadata.allergens) ?? [];
    const allergenData = normalizeAllergenData(row.allergen_declarations ?? metadata.allergenDeclarations, legacyAllergens);
    return {
      restaurantId: text(row, "restaurant_id"), menuId: text(row, "menu_id"), id: text(row, "id"),
      name: text(row, "name"),
      hasPhoto: Boolean(text(row, "image_url") || text(metadata, "photoStoragePath")),
      hasDescription: Boolean(text(row, "short_description") || text(row, "description")),
      allergenStatus: allergenData.source === "structured" &&
        !allergenData.reviewRequired &&
        allergenData.declarations.length === ALLERGEN_REGISTRY.length
        ? "declared" as const
        : "unknown" as const,
      hasImmersiveAsset: Boolean(row.has_immersive_view || ["model3d_url", "web_model_3d_url", "ar_model_3d_url", "usdz_url", "ar_usdz_url"].some((key) => text(row, key)))
    };
  }) };
}

export async function readTranslations(input: { restaurantId: string; menuId: string }) {
  const result = await read("menu_dish_translations", "restaurant_id,menu_id,dish_id,locale,translation_status", { restaurant_id: input.restaurantId, menu_id: input.menuId }, 5001);
  if (!result.ok) return result;
  if (result.rows.length > 5000) return { ok: false as const, code: "query" as const, retryable: false };
  return { ok: true as const, rows: result.rows.map((row) => ({
    restaurantId: text(row, "restaurant_id"), menuId: text(row, "menu_id"), dishId: text(row, "dish_id"),
    locale: text(row, "locale"), status: text(row, "translation_status")
  })) };
}
