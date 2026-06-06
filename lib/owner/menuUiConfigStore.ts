import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";
import {
  DEFAULT_MENU_UI_CONFIG,
  defaultMenuUiConfigRecord,
  mapMenuUiConfigRow,
  menuUiConfigForRestaurant,
  serializeMenuUiConfig,
  type MenuUiConfig,
  type MenuUiConfigRecord,
  type MenuUiConfigRow
} from "@/lib/menu/menuUiConfig";

const TABLE = "menu_ui_configs";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StoreSuccess = {
  ok: true;
  record: MenuUiConfigRecord;
};

type StoreFailure = {
  ok: false;
  status: number;
  error: string;
};

export type MenuUiConfigLoadResult = {
  ok: true;
  record: MenuUiConfigRecord;
  error?: string;
};

function isValidRestaurantId(restaurantId: string): boolean {
  return UUID_PATTERN.test(restaurantId);
}

function missingSupabaseFailure(reason: string): StoreFailure {
  return {
    ok: false,
    status: 503,
    error: `Supabase indisponible pour persister la config UI: ${reason}`
  };
}

async function getRestaurantFallbackConfig(
  client: SupabaseClient,
  restaurantId: string
): Promise<MenuUiConfig> {
  const { data } = await client
    .from("restaurants")
    .select("id,name,slug")
    .eq("id", restaurantId)
    .limit(1)
    .maybeSingle();

  if (!data) return DEFAULT_MENU_UI_CONFIG;
  const row = data as Record<string, unknown>;
  return menuUiConfigForRestaurant({
    name: typeof row.name === "string" ? row.name : "",
    slug: typeof row.slug === "string" ? row.slug : ""
  });
}

async function assertRestaurantExists(
  client: SupabaseClient,
  restaurantId: string
): Promise<StoreFailure | null> {
  const { data, error } = await client
    .from("restaurants")
    .select("id")
    .eq("id", restaurantId)
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 503,
      error: "Impossible de verifier le restaurant dans Supabase."
    };
  }

  if (!data) {
    return {
      ok: false,
      status: 404,
      error: "Restaurant introuvable."
    };
  }

  return null;
}

async function readConfigRows(
  client: SupabaseClient,
  restaurantId: string
): Promise<{ ok: true; rows: MenuUiConfigRow[] } | StoreFailure> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("restaurant_id", restaurantId)
    .in("status", ["draft", "published"])
    .order("updated_at", { ascending: false });

  if (error) {
    return {
      ok: false,
      status: 503,
      error:
        "La table menu_ui_configs est indisponible. Appliquez la migration 0008_menu_ui_configs.sql."
    };
  }

  return { ok: true, rows: (data ?? []) as MenuUiConfigRow[] };
}

function preferDraftThenPublished(
  rows: MenuUiConfigRow[],
  fallbackConfig: MenuUiConfig
): MenuUiConfigRecord | null {
  const draft =
    rows.find((row) => row.status === "draft") ??
    rows.find((row) => row.status === "published");
  return draft ? mapMenuUiConfigRow(draft, fallbackConfig) : null;
}

export async function getOwnerMenuUiConfig(
  restaurantId: string
): Promise<MenuUiConfigLoadResult> {
  if (!isValidRestaurantId(restaurantId)) {
    return {
      ok: true,
      record: defaultMenuUiConfigRecord({ restaurantId }),
      error: "Restaurant invalide."
    };
  }

  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return {
      ok: true,
      record: defaultMenuUiConfigRecord({ restaurantId }),
      error: admin.reason
    };
  }

  const fallbackConfig = await getRestaurantFallbackConfig(
    admin.client,
    restaurantId
  );
  const rows = await readConfigRows(admin.client, restaurantId);
  if (!rows.ok) {
    return {
      ok: true,
      record: defaultMenuUiConfigRecord({ restaurantId, config: fallbackConfig }),
      error: rows.error
    };
  }

  const record = preferDraftThenPublished(rows.rows, fallbackConfig);
  return {
    ok: true,
    record:
      record ?? defaultMenuUiConfigRecord({ restaurantId, config: fallbackConfig })
  };
}

export async function getPublishedMenuUiConfigForRestaurant(
  restaurantId: string,
  fallbackConfig: MenuUiConfig = DEFAULT_MENU_UI_CONFIG
): Promise<MenuUiConfigRecord> {
  if (!isValidRestaurantId(restaurantId)) {
    return defaultMenuUiConfigRecord({ restaurantId, config: fallbackConfig });
  }

  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return defaultMenuUiConfigRecord({ restaurantId, config: fallbackConfig });
  }

  const { data, error } = await admin.client
    .from(TABLE)
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return defaultMenuUiConfigRecord({ restaurantId, config: fallbackConfig });
  }

  return mapMenuUiConfigRow(data as MenuUiConfigRow, fallbackConfig);
}

async function upsertDraft(
  client: SupabaseClient,
  restaurantId: string,
  config: MenuUiConfig
): Promise<StoreSuccess | StoreFailure> {
  const existing = await client
    .from(TABLE)
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("status", "draft")
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    return {
      ok: false,
      status: 503,
      error:
        "La config draft n'a pas pu etre lue. Verifiez la migration menu_ui_configs."
    };
  }

  const row = {
    restaurant_id: restaurantId,
    theme: config.theme,
    config_json: serializeMenuUiConfig(config),
    status: "draft"
  };

  const writer = existing.data
    ? client.from(TABLE).update(row).eq("id", (existing.data as { id: string }).id)
    : client.from(TABLE).insert(row);

  const { data, error } = await writer.select("*").single();
  if (error || !data) {
    return {
      ok: false,
      status: 503,
      error: "La config UI draft n'a pas pu etre enregistree."
    };
  }

  return { ok: true, record: mapMenuUiConfigRow(data as MenuUiConfigRow, config) };
}

export async function saveDraftMenuUiConfig(args: {
  restaurantId: string;
  config: MenuUiConfig;
}): Promise<StoreSuccess | StoreFailure> {
  if (!isValidRestaurantId(args.restaurantId)) {
    return { ok: false, status: 400, error: "Restaurant invalide." };
  }

  const admin = getSupabaseAdminClient();
  if (!admin.ok) return missingSupabaseFailure(admin.reason);

  const restaurantError = await assertRestaurantExists(
    admin.client,
    args.restaurantId
  );
  if (restaurantError) return restaurantError;

  return upsertDraft(admin.client, args.restaurantId, args.config);
}

export async function publishMenuUiConfig(args: {
  restaurantId: string;
  config: MenuUiConfig;
}): Promise<StoreSuccess | StoreFailure> {
  if (!isValidRestaurantId(args.restaurantId)) {
    return { ok: false, status: 400, error: "Restaurant invalide." };
  }

  const admin = getSupabaseAdminClient();
  if (!admin.ok) return missingSupabaseFailure(admin.reason);

  const restaurantError = await assertRestaurantExists(
    admin.client,
    args.restaurantId
  );
  if (restaurantError) return restaurantError;

  const draft = await upsertDraft(admin.client, args.restaurantId, args.config);
  if (!draft.ok) return draft;

  const archived = await admin.client
    .from(TABLE)
    .update({ status: "archived" })
    .eq("restaurant_id", args.restaurantId)
    .eq("status", "published");

  if (archived.error) {
    return {
      ok: false,
      status: 503,
      error: "L'ancienne config publiee n'a pas pu etre archivee."
    };
  }

  const publishedRow = {
    restaurant_id: args.restaurantId,
    theme: args.config.theme,
    config_json: serializeMenuUiConfig(args.config),
    status: "published"
  };
  const { data, error } = await admin.client
    .from(TABLE)
    .insert(publishedRow)
    .select("*")
    .single();

  if (error || !data) {
    return {
      ok: false,
      status: 503,
      error: "La config UI n'a pas pu etre publiee."
    };
  }

  return { ok: true, record: mapMenuUiConfigRow(data as MenuUiConfigRow, args.config) };
}

