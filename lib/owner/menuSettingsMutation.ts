import {
  normalizePublicMenuSettings,
  serializePublicMenuSettings,
  type PublicMenuSettings
} from "../menu/publicMenuSettings.ts";

type SupabaseMenuSettingsError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type SupabaseMenuSettingsData = Record<string, unknown> | null;

type SupabaseMenuSettingsSingleResult = PromiseLike<{
  data: SupabaseMenuSettingsData;
  error: SupabaseMenuSettingsError | null;
}>;

type SupabaseMenuSettingsSelectSingle = {
  single(): SupabaseMenuSettingsSingleResult;
};

type SupabaseMenuSettingsSelectable = {
  select(columns: string): SupabaseMenuSettingsSelectSingle;
};

type SupabaseMenuSettingsUpdateAfterEq = SupabaseMenuSettingsSelectable & {
  eq(column: string, value: unknown): SupabaseMenuSettingsSelectable;
};

type SupabaseMenuSettingsSelectAfterEq = {
  eq(column: string, value: unknown): SupabaseMenuSettingsSelectSingle;
};

export type SupabaseMenuSettingsClient = {
  from(table: "menus"): {
    update(row: Record<string, unknown>): {
      eq(column: string, value: unknown): SupabaseMenuSettingsUpdateAfterEq;
    };
    select(columns: string): {
      eq(column: string, value: unknown): SupabaseMenuSettingsSelectAfterEq;
    };
  };
};

export type OwnerMenuSettingsMutationResult =
  | {
      ok: true;
      restaurantId: string;
      menuId: string;
      settings: PublicMenuSettings;
      storage: "settings_json" | "metadata";
    }
  | {
      ok: false;
      status: 404 | 503;
      error: string;
    };

function objectInput(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function isMissingMenuSettingsJsonColumn(error: unknown): boolean {
  const details = objectInput(error);
  const haystack = [
    details.code,
    details.message,
    details.details,
    details.hint
  ]
    .filter(Boolean)
    .join(" ");

  return (
    details.code === "42703" ||
    /column\s+["']?settings_json["']?\s+does\s+not\s+exist/i.test(haystack) ||
    /could\s+not\s+find\s+.*settings_json.*schema\s+cache/i.test(haystack)
  );
}

function settingsFromData(
  data: SupabaseMenuSettingsData,
  fallback: PublicMenuSettings,
  key: "settings_json" | "publicMenuSettings"
): PublicMenuSettings {
  const source =
    key === "settings_json"
      ? objectInput(data).settings_json
      : objectInput(objectInput(data).metadata).publicMenuSettings;
  return serializePublicMenuSettings(normalizePublicMenuSettings(source ?? fallback));
}

function menuIdFromData(data: SupabaseMenuSettingsData): string {
  const id = objectInput(data).id;
  return typeof id === "string" && id.trim() ? id : "";
}

export async function updateOwnerMenuSettings(args: {
  client: SupabaseMenuSettingsClient;
  restaurantId: string;
  settings: PublicMenuSettings;
}): Promise<OwnerMenuSettingsMutationResult> {
  const settings = serializePublicMenuSettings(args.settings);
  const primary = await args.client
    .from("menus")
    .update({ settings_json: settings })
    .eq("restaurant_id", args.restaurantId)
    .eq("is_primary", true)
    .select("id,settings_json")
    .single();

  if (!primary.error && primary.data) {
    return {
      ok: true,
      restaurantId: args.restaurantId,
      menuId: menuIdFromData(primary.data),
      settings: settingsFromData(primary.data, settings, "settings_json"),
      storage: "settings_json"
    };
  }

  if (!isMissingMenuSettingsJsonColumn(primary.error)) {
    return {
      ok: false,
      status: 404,
      error: "Menu principal introuvable pour ce restaurant."
    };
  }

  const existing = await args.client
    .from("menus")
    .select("id,metadata")
    .eq("restaurant_id", args.restaurantId)
    .eq("is_primary", true)
    .single();

  const menuId = menuIdFromData(existing.data);
  if (existing.error || !menuId) {
    return {
      ok: false,
      status: 404,
      error: "Menu principal introuvable pour ce restaurant."
    };
  }

  const metadata = objectInput(existing.data?.metadata);
  const fallback = await args.client
    .from("menus")
    .update({
      metadata: {
        ...metadata,
        publicMenuSettings: settings
      },
      updated_at: new Date().toISOString()
    })
    .eq("id", menuId)
    .select("id,metadata")
    .single();

  if (fallback.error || !fallback.data) {
    return {
      ok: false,
      status: 503,
      error: "Settings menu impossibles a sauvegarder."
    };
  }

  return {
    ok: true,
    restaurantId: args.restaurantId,
    menuId,
    settings: settingsFromData(fallback.data, settings, "publicMenuSettings"),
    storage: "metadata"
  };
}
