import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizePublicMenuSettings,
  serializePublicMenuSettings,
  type PublicMenuSettings
} from "../menu/publicMenuSettings.ts";

export type OwnerPublicMenuSettingsSource =
  | "settings_json"
  | "metadata"
  | "menu_ui_configs";

export type OwnerPublicMenuSettingsFallback = {
  source: OwnerPublicMenuSettingsSource;
  settings: PublicMenuSettings;
};

const UI_CONFIG_SETTINGS_KEY = "publicMenuSettings";

function objectInput(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function isMissingColumnError(error: unknown, column: string): boolean {
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
    new RegExp(`column\\s+["']?${column}["']?\\s+does\\s+not\\s+exist`, "i").test(haystack) ||
    new RegExp(`could\\s+not\\s+find\\s+.*${column}.*schema\\s+cache`, "i").test(haystack) ||
    new RegExp(`${column}.*does\\s+not\\s+exist`, "i").test(haystack)
  );
}

export function publicMenuSettingsFromMenuRow(
  data: unknown
): OwnerPublicMenuSettingsFallback | null {
  const row = objectInput(data);
  const nativeSettings = objectInput(row.settings_json ?? row.settingsJson);
  if (Object.keys(nativeSettings).length > 0) {
    return {
      source: "settings_json",
      settings: serializePublicMenuSettings(
        normalizePublicMenuSettings(nativeSettings)
      )
    };
  }

  const metadata = objectInput(row.metadata);
  const metadataSettings = objectInput(
    metadata.publicMenuSettings ??
      metadata.public_menu_settings ??
      metadata.settings
  );
  if (Object.keys(metadataSettings).length > 0) {
    return {
      source: "metadata",
      settings: serializePublicMenuSettings(
        normalizePublicMenuSettings(metadataSettings)
      )
    };
  }

  return null;
}

export function publicMenuSettingsFromUiConfigRow(
  data: unknown
): OwnerPublicMenuSettingsFallback | null {
  const config = objectInput(objectInput(data).config_json);
  const settings = objectInput(
    config.publicMenuSettings ??
      config.public_menu_settings ??
      config.settings
  );
  if (Object.keys(settings).length === 0) return null;

  return {
    source: "menu_ui_configs",
    settings: serializePublicMenuSettings(normalizePublicMenuSettings(settings))
  };
}

export async function readUiConfigPublicMenuSettings(
  client: SupabaseClient,
  restaurantId: string
): Promise<PublicMenuSettings | null> {
  const config = await client
    .from("menu_ui_configs")
    .select("config_json,status")
    .eq("restaurant_id", restaurantId)
    .in("status", ["draft", "published"])
    .order("updated_at", { ascending: false })
    .limit(10);

  if (config.error) return null;
  const rows = Array.isArray(config.data) ? config.data : [];
  const preferred =
    rows.find((row) => String(row.status ?? "") === "draft") ??
    rows.find((row) => String(row.status ?? "") === "published") ??
    rows[0];
  return publicMenuSettingsFromUiConfigRow(preferred)?.settings ?? null;
}

export async function readPublicMenuSettingsWithFallbacks(args: {
  client: SupabaseClient;
  restaurantId: string;
  menuId?: string;
  menuRow?: unknown;
}): Promise<PublicMenuSettings> {
  const cached = publicMenuSettingsFromMenuRow(args.menuRow)?.settings;
  if (cached) return cached;

  if (args.menuId) {
    const withSettings = await args.client
      .from("menus")
      .select("settings_json,metadata")
      .eq("id", args.menuId)
      .maybeSingle();
    if (!withSettings.error) {
      const settings = publicMenuSettingsFromMenuRow(withSettings.data)?.settings;
      if (settings) return settings;
    }

    const shouldTryNativeSettings =
      !withSettings.error ||
      isMissingColumnError(withSettings.error, "metadata");
    if (shouldTryNativeSettings) {
      const withNativeSettings = await args.client
        .from("menus")
        .select("settings_json")
        .eq("id", args.menuId)
        .maybeSingle();
      if (!withNativeSettings.error) {
        const settings = publicMenuSettingsFromMenuRow(withNativeSettings.data)?.settings;
        if (settings) return settings;
      }
    }

    const shouldTryMetadata =
      !withSettings.error ||
      isMissingColumnError(withSettings.error, "settings_json");
    if (shouldTryMetadata) {
      const withMetadata = await args.client
        .from("menus")
        .select("metadata")
        .eq("id", args.menuId)
        .maybeSingle();
      if (!withMetadata.error) {
        const settings = publicMenuSettingsFromMenuRow(withMetadata.data)?.settings;
        if (settings) return settings;
      }
    }
  }

  const uiConfigSettings = await readUiConfigPublicMenuSettings(
    args.client,
    args.restaurantId
  );
  return uiConfigSettings ?? normalizePublicMenuSettings({});
}

export function mergePublicMenuSettingsIntoUiConfig(
  configJson: unknown,
  settings: PublicMenuSettings
): Record<string, unknown> {
  return {
    ...objectInput(configJson),
    [UI_CONFIG_SETTINGS_KEY]: serializePublicMenuSettings(settings)
  };
}
