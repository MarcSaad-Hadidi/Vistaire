import {
  normalizePublicMenuSettings,
  serializePublicMenuSettings,
  type PublicMenuSettings
} from "../menu/publicMenuSettings.ts";
import {
  isMissingColumnError,
  mergePublicMenuSettingsIntoUiConfig,
  publicMenuSettingsFromMenuRow,
  type OwnerPublicMenuSettingsSource
} from "./publicMenuSettingsFallback.ts";

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
  maybeSingle(): SupabaseMenuSettingsSingleResult;
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
  from(table: "menus" | "menu_ui_configs"): {
    insert(row: Record<string, unknown>): SupabaseMenuSettingsSelectable;
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
      storage: OwnerPublicMenuSettingsSource;
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
  return isMissingColumnError(error, "settings_json");
}

function settingsFromData(
  data: SupabaseMenuSettingsData,
  fallback: PublicMenuSettings,
  key: "settings_json" | "publicMenuSettings" | "config_json"
): PublicMenuSettings {
  const source = (() => {
    if (key === "settings_json") return objectInput(data).settings_json;
    if (key === "config_json") {
      return objectInput(objectInput(data).config_json).publicMenuSettings;
    }
    return objectInput(objectInput(data).metadata).publicMenuSettings;
  })();
  return serializePublicMenuSettings(normalizePublicMenuSettings(source ?? fallback));
}

function menuIdFromData(data: SupabaseMenuSettingsData): string {
  const id = objectInput(data).id;
  return typeof id === "string" && id.trim() ? id : "";
}

function uiConfigIdFromData(data: SupabaseMenuSettingsData): string {
  const id = objectInput(data).id;
  return typeof id === "string" && id.trim() ? id : "";
}

async function saveSettingsToUiConfig(args: {
  client: SupabaseMenuSettingsClient;
  restaurantId: string;
  settings: PublicMenuSettings;
}): Promise<OwnerMenuSettingsMutationResult> {
  const existing = await args.client
    .from("menu_ui_configs")
    .select("id,theme,config_json,status")
    .eq("restaurant_id", args.restaurantId)
    .eq("status", "draft")
    .maybeSingle();

  if (existing.error) {
    return {
      ok: false,
      status: 503,
      error:
        "Settings menu impossibles a sauvegarder. Appliquez la migration menus.settings_json."
    };
  }

  const configJson = mergePublicMenuSettingsIntoUiConfig(
    existing.data?.config_json,
    args.settings
  );
  const uiConfigId = uiConfigIdFromData(existing.data);
  const row = {
    restaurant_id: args.restaurantId,
    theme:
      typeof existing.data?.theme === "string" && existing.data.theme.trim()
        ? existing.data.theme
        : "fresh-homemade",
    config_json: configJson,
    status: "draft",
    updated_at: new Date().toISOString()
  };
  const writer = uiConfigId
    ? args.client.from("menu_ui_configs").update(row).eq("id", uiConfigId)
    : args.client.from("menu_ui_configs").insert(row);
  const fallback = await writer.select("id,config_json").single();

  if (fallback.error || !fallback.data) {
    return {
      ok: false,
      status: 503,
      error:
        "Settings menu impossibles a sauvegarder. Appliquez la migration menus.settings_json."
    };
  }

  return {
    ok: true,
    restaurantId: args.restaurantId,
    menuId: "",
    settings: settingsFromData(fallback.data, args.settings, "config_json"),
    storage: "menu_ui_configs"
  };
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
    const normalized = publicMenuSettingsFromMenuRow(primary.data);
    return {
      ok: true,
      restaurantId: args.restaurantId,
      menuId: menuIdFromData(primary.data),
      settings:
        normalized?.settings ??
        settingsFromData(primary.data, settings, "settings_json"),
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
  if (existing.error && isMissingColumnError(existing.error, "metadata")) {
    return saveSettingsToUiConfig({
      client: args.client,
      restaurantId: args.restaurantId,
      settings
    });
  }
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

  if (fallback.error && isMissingColumnError(fallback.error, "metadata")) {
    return saveSettingsToUiConfig({
      client: args.client,
      restaurantId: args.restaurantId,
      settings
    });
  }
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
    settings:
      publicMenuSettingsFromMenuRow(fallback.data)?.settings ??
      settingsFromData(fallback.data, settings, "publicMenuSettings"),
    storage: "metadata"
  };
}
