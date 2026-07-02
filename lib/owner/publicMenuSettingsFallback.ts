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

export function mergePublicMenuSettingsIntoUiConfig(
  configJson: unknown,
  settings: PublicMenuSettings
): Record<string, unknown> {
  return {
    ...objectInput(configJson),
    [UI_CONFIG_SETTINGS_KEY]: serializePublicMenuSettings(settings)
  };
}
