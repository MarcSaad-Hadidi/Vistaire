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
  localizedUiCopy?: Record<string, unknown>;
  updatedAt?: string;
};

export type PersistGeneratedLocalizedUiCopyResult =
  | {
      ok: true;
      source: OwnerPublicMenuSettingsSource;
      settings: PublicMenuSettings;
      localizedUiCopy: Record<string, unknown>;
    }
  | {
      ok: false;
      status: 503;
      error: string;
    };

const UI_CONFIG_SETTINGS_KEY = "publicMenuSettings";

function objectInput(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function localizedUiCopyInput(value: unknown): Record<string, unknown> | undefined {
  const input = objectInput(value);
  return Object.keys(input).length > 0 ? input : undefined;
}

function getLocalizedUiCopy(candidate: Record<string, unknown>): Record<string, unknown> | undefined {
  return (
    localizedUiCopyInput(candidate.localizedUiCopy) ??
    localizedUiCopyInput(candidate.localized_ui_copy) ??
    localizedUiCopyInput(candidate.uiCopy) ??
    localizedUiCopyInput(candidate.ui_copy)
  );
}

function settingsWithLocalizedUiCopy(
  settings: PublicMenuSettings,
  localizedUiCopy?: Record<string, unknown>
): Record<string, unknown> {
  const serialized = serializePublicMenuSettings(settings) as Record<string, unknown>;
  return localizedUiCopy && Object.keys(localizedUiCopy).length > 0
    ? { ...serialized, localizedUiCopy }
    : serialized;
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
  const metadata = objectInput(row.metadata);
  const metadataSettings = objectInput(
    metadata.publicMenuSettings ??
      metadata.public_menu_settings ??
      metadata.settings
  );
  const nativeSettings = objectInput(row.settings_json ?? row.settingsJson);
  if (Object.keys(nativeSettings).length > 0) {
    const localizedUiCopy =
      getLocalizedUiCopy(nativeSettings) ??
      getLocalizedUiCopy(row) ??
      getLocalizedUiCopy(metadata) ??
      getLocalizedUiCopy(metadataSettings);
    return {
      source: "settings_json",
      settings: serializePublicMenuSettings(
        normalizePublicMenuSettings(nativeSettings)
      ),
      ...(localizedUiCopy ? { localizedUiCopy } : {})
    };
  }

  if (Object.keys(metadataSettings).length > 0) {
    const localizedUiCopy = getLocalizedUiCopy(metadata) ?? getLocalizedUiCopy(metadataSettings);
    return {
      source: "metadata",
      settings: serializePublicMenuSettings(
        normalizePublicMenuSettings(metadataSettings)
      ),
      ...(localizedUiCopy ? { localizedUiCopy } : {})
    };
  }

  return null;
}

export function publicMenuSettingsFromUiConfigRow(
  data: unknown
): OwnerPublicMenuSettingsFallback | null {
  const row = objectInput(data);
  const config = objectInput(objectInput(data).config_json);
  const settings = objectInput(
    config.publicMenuSettings ??
      config.public_menu_settings ??
      config.settings
  );
  if (Object.keys(settings).length === 0) return null;
  const localizedUiCopy = getLocalizedUiCopy(config) ?? getLocalizedUiCopy(settings);

  return {
    source: "menu_ui_configs",
    settings: serializePublicMenuSettings(normalizePublicMenuSettings(settings)),
    ...(localizedUiCopy ? { localizedUiCopy } : {}),
    updatedAt:
      typeof row.updated_at === "string" && row.updated_at.trim()
        ? row.updated_at.trim()
        : typeof row.updatedAt === "string" && row.updatedAt.trim()
          ? row.updatedAt.trim()
          : undefined
  };
}

export function publicMenuSettingsFallbackFromUiConfigRows(
  data: unknown,
  restaurantId = ""
): OwnerPublicMenuSettingsFallback | null {
  // Effective public menu settings are stored in menu_ui_configs for legacy
  // databases without menus.settings_json. Owner reloads and public routes
  // must read the same saved values, so the editable draft wins when present.
  const allRows = Array.isArray(data) ? data : [];
  const rows = restaurantId
    ? allRows.filter((row) => {
        const candidate = objectInput(row);
        return String(candidate.restaurant_id ?? candidate.restaurantId ?? "") === restaurantId;
      })
    : allRows;
  const preferred =
    rows.find((row) => String(objectInput(row).status ?? "") === "draft") ??
    rows.find((row) => String(objectInput(row).status ?? "") === "published") ??
    rows[0];
  return publicMenuSettingsFromUiConfigRow(preferred);
}

export function publicMenuSettingsFromUiConfigRows(
  data: unknown,
  restaurantId = ""
): PublicMenuSettings | null {
  return publicMenuSettingsFallbackFromUiConfigRows(data, restaurantId)?.settings ?? null;
}

export async function readUiConfigPublicMenuSettings(
  client: SupabaseClient,
  restaurantId: string
): Promise<PublicMenuSettings | null> {
  return (await readUiConfigPublicMenuSettingsFallback(client, restaurantId))?.settings ?? null;
}

export async function readUiConfigPublicMenuSettingsFallback(
  client: SupabaseClient,
  restaurantId: string
): Promise<OwnerPublicMenuSettingsFallback | null> {
  const config = await client
    .from("menu_ui_configs")
    .select("config_json,status,updated_at")
    .eq("restaurant_id", restaurantId)
    .in("status", ["draft", "published"])
    .order("updated_at", { ascending: false })
    .limit(10);

  if (config.error) return null;
  return publicMenuSettingsFallbackFromUiConfigRows(config.data, restaurantId);
}

export async function readPublicMenuSettingsBundleWithFallbacks(args: {
  client: SupabaseClient;
  restaurantId: string;
  menuId?: string;
  menuRow?: unknown;
}): Promise<OwnerPublicMenuSettingsFallback> {
  const cached = publicMenuSettingsFromMenuRow(args.menuRow);
  if (cached) return cached;

  if (args.menuId) {
    const withSettings = await args.client
      .from("menus")
      .select("settings_json,metadata")
      .eq("id", args.menuId)
      .maybeSingle();
    if (!withSettings.error) {
      const settings = publicMenuSettingsFromMenuRow(withSettings.data);
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
        const settings = publicMenuSettingsFromMenuRow(withNativeSettings.data);
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
        const settings = publicMenuSettingsFromMenuRow(withMetadata.data);
        if (settings) return settings;
      }
    }
  }

  const uiConfigSettings = await readUiConfigPublicMenuSettingsFallback(
    args.client,
    args.restaurantId
  );
  return uiConfigSettings ?? {
    source: "settings_json",
    settings: normalizePublicMenuSettings({})
  };
}

export async function readPublicMenuSettingsWithFallbacks(args: {
  client: SupabaseClient;
  restaurantId: string;
  menuId?: string;
  menuRow?: unknown;
}): Promise<PublicMenuSettings> {
  return (await readPublicMenuSettingsBundleWithFallbacks(args)).settings;
}

export function mergePublicMenuSettingsIntoUiConfig(
  configJson: unknown,
  settings: PublicMenuSettings,
  nextLocalizedUiCopy?: Record<string, unknown>
): Record<string, unknown> {
  const config = objectInput(configJson);
  const existingSettings = objectInput(
    config.publicMenuSettings ??
      config.public_menu_settings ??
      config.settings
  );
  const localizedUiCopy =
    nextLocalizedUiCopy ??
    getLocalizedUiCopy(config) ??
    getLocalizedUiCopy(existingSettings);
  const publicMenuSettings = settingsWithLocalizedUiCopy(settings, localizedUiCopy);

  return {
    ...config,
    [UI_CONFIG_SETTINGS_KEY]: publicMenuSettings
  };
}

function persistError(source: OwnerPublicMenuSettingsSource, error?: unknown): PersistGeneratedLocalizedUiCopyResult {
  const details = objectInput(error);
  const message = [
    typeof details.message === "string" ? details.message : "",
    typeof details.details === "string" ? details.details : "",
    typeof details.hint === "string" ? details.hint : "",
    typeof details.code === "string" ? details.code : ""
  ].filter(Boolean).join(" ");
  return {
    ok: false,
    status: 503,
    error:
      `Pack interface traduction impossible a sauvegarder (${source}).` +
      (message ? ` Detail Supabase: ${message}` : "")
  };
}

async function persistLocalizedUiCopyToUiConfig(args: {
  client: SupabaseClient;
  restaurantId: string;
  settings: PublicMenuSettings;
  localizedUiCopy: Record<string, unknown>;
}): Promise<PersistGeneratedLocalizedUiCopyResult> {
  const existing = await args.client
    .from("menu_ui_configs")
    .select("id,theme,config_json,status")
    .eq("restaurant_id", args.restaurantId)
    .eq("status", "draft")
    .maybeSingle();

  if (existing.error) return persistError("menu_ui_configs", existing.error);

  const configJson = mergePublicMenuSettingsIntoUiConfig(
    existing.data?.config_json,
    args.settings,
    args.localizedUiCopy
  );
  const existingId =
    typeof existing.data?.id === "string" && existing.data.id.trim()
      ? existing.data.id.trim()
      : "";
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
  const writer = existingId
    ? args.client.from("menu_ui_configs").update(row).eq("id", existingId)
    : args.client.from("menu_ui_configs").insert(row);
  const written = await writer.select("id,config_json").single();

  if (written.error || !written.data) {
    return persistError("menu_ui_configs", written.error);
  }

  return {
    ok: true,
    source: "menu_ui_configs",
    settings: publicMenuSettingsFromUiConfigRow(written.data)?.settings ?? args.settings,
    localizedUiCopy: args.localizedUiCopy
  };
}

export async function persistGeneratedLocalizedUiCopy(args: {
  client: SupabaseClient;
  restaurantId: string;
  menuId: string;
  menuRow?: unknown;
  settings: PublicMenuSettings;
  localizedUiCopy: Record<string, unknown>;
}): Promise<PersistGeneratedLocalizedUiCopyResult> {
  const payload = settingsWithLocalizedUiCopy(args.settings, args.localizedUiCopy);
  const native = await args.client
    .from("menus")
    .update({ settings_json: payload, updated_at: new Date().toISOString() })
    .eq("id", args.menuId)
    .select("id,settings_json")
    .single();

  if (!native.error && native.data) {
    return {
      ok: true,
      source: "settings_json",
      settings: publicMenuSettingsFromMenuRow(native.data)?.settings ?? args.settings,
      localizedUiCopy: args.localizedUiCopy
    };
  }

  if (!isMissingColumnError(native.error, "settings_json")) {
    return persistError("settings_json", native.error);
  }

  const existing = await args.client
    .from("menus")
    .select("id,metadata")
    .eq("id", args.menuId)
    .maybeSingle();
  if (existing.error && isMissingColumnError(existing.error, "metadata")) {
    return persistLocalizedUiCopyToUiConfig(args);
  }
  if (existing.error || !existing.data) return persistError("metadata", existing.error);

  const metadata = objectInput(existing.data.metadata);
  const fallback = await args.client
    .from("menus")
    .update({
      metadata: {
        ...metadata,
        publicMenuSettings: payload
      },
      updated_at: new Date().toISOString()
    })
    .eq("id", args.menuId)
    .select("id,metadata")
    .single();

  if (fallback.error && isMissingColumnError(fallback.error, "metadata")) {
    return persistLocalizedUiCopyToUiConfig(args);
  }
  if (fallback.error || !fallback.data) {
    return persistError("metadata", fallback.error);
  }

  return {
    ok: true,
    source: "metadata",
    settings: publicMenuSettingsFromMenuRow(fallback.data)?.settings ?? args.settings,
    localizedUiCopy: args.localizedUiCopy
  };
}
