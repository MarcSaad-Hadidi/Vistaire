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
type PublicMenuSettingsPayload = PublicMenuSettings & {
  localizedUiCopy?: Record<string, unknown>;
};

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
  rpc?: (
    functionName: string,
    params: Record<string, unknown>
  ) => PromiseLike<{
    data: Record<string, unknown> | null;
    error: SupabaseMenuSettingsError | null;
  }>;
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

export type OwnerMenuSettingsPublicCommitCallback = () => void | Promise<void>;

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

function withPreservedLocalizedUiCopy(
  settings: PublicMenuSettings,
  localizedUiCopy?: Record<string, unknown>
): PublicMenuSettingsPayload {
  const serialized = serializePublicMenuSettings(settings) as PublicMenuSettingsPayload;
  return localizedUiCopy && Object.keys(localizedUiCopy).length > 0
    ? { ...serialized, localizedUiCopy }
    : serialized;
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

async function syncSettingsToDraftAfterPublicCommit(args: {
  client: SupabaseMenuSettingsClient;
  restaurantId: string;
  settings: PublicMenuSettings;
  onPublicCommit?: OwnerMenuSettingsPublicCommitCallback;
}): Promise<OwnerMenuSettingsMutationResult> {
  try {
    const result = await saveSettingsToUiConfig(args);
    if (!result.ok) await args.onPublicCommit?.();
    return result;
  } catch {
    await args.onPublicCommit?.();
    return {
      ok: false,
      status: 503,
      error: "Settings menu impossibles a sauvegarder."
    };
  }
}

export async function updateOwnerMenuSettings(args: {
  client: SupabaseMenuSettingsClient;
  restaurantId: string;
  settings: PublicMenuSettings;
  onPublicCommit?: OwnerMenuSettingsPublicCommitCallback;
}): Promise<OwnerMenuSettingsMutationResult> {
  const existingPrimary = await args.client
    .from("menus")
    .select("id,settings_json,metadata")
    .eq("restaurant_id", args.restaurantId)
    .eq("is_primary", true)
    .single();
  const settings = withPreservedLocalizedUiCopy(
    args.settings,
    publicMenuSettingsFromMenuRow(existingPrimary.data)?.localizedUiCopy
  );

  const previousStyle = publicMenuSettingsFromMenuRow(existingPrimary.data)
    ?.settings.publicMenuStyle;
  const styleTouchesUnique =
    settings.publicMenuStyle === "unique" || previousStyle === "unique";

  if (styleTouchesUnique && typeof args.client.rpc === "function") {
    const existingDraft = await args.client
      .from("menu_ui_configs")
      .select("id,theme,config_json,status")
      .eq("restaurant_id", args.restaurantId)
      .eq("status", "draft")
      .maybeSingle();
    const existingUnique = mergePublicMenuSettingsIntoUiConfig(
      existingDraft.data?.config_json,
      settings
    ).uniqueDesign;

    const { data, error } = await args.client.rpc(
      "mutate_owner_public_menu_settings_atomic",
      {
        p_restaurant_id: args.restaurantId,
        p_settings: settings,
        p_unique_design: existingUnique
      }
    );
    if (error) {
      return {
        ok: false,
        status: 503,
        error:
          "Mutation atomique des settings unique impossible. Aucune ecriture partielle confirmee."
      };
    }
    if (!data || data.ok !== true) {
      return {
        ok: false,
        status: 503,
        error:
          typeof data?.error === "string"
            ? data.error
            : "Mutation atomique des settings unique refusee."
      };
    }
    await args.onPublicCommit?.();
    return {
      ok: true,
      restaurantId: args.restaurantId,
      menuId: typeof data.menuId === "string" ? data.menuId : "",
      settings,
      storage: "settings_json"
    };
  }

  if (styleTouchesUnique && typeof args.client.rpc !== "function") {
    return {
      ok: false,
      status: 503,
      error:
        "Mutation de style unique impossible sans RPC transactionnelle. Aucune ecriture partielle."
    };
  }

  const primary = await args.client
    .from("menus")
    .update({ settings_json: settings })
    .eq("restaurant_id", args.restaurantId)
    .eq("is_primary", true)
    .select("id,settings_json")
    .single();

  if (!primary.error && primary.data) {
    await args.onPublicCommit?.();
    const uiSync = await syncSettingsToDraftAfterPublicCommit({
      client: args.client,
      restaurantId: args.restaurantId,
      settings,
      onPublicCommit: args.onPublicCommit
    });
    if (settings.publicMenuStyle === "unique" && !uiSync.ok) {
      return uiSync;
    }
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
  const metadataSettings = withPreservedLocalizedUiCopy(
    settings,
    publicMenuSettingsFromMenuRow(existing.data)?.localizedUiCopy
  );
  const fallback = await args.client
    .from("menus")
    .update({
      metadata: {
        ...metadata,
        publicMenuSettings: metadataSettings
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

  await args.onPublicCommit?.();
  const uiSync = await syncSettingsToDraftAfterPublicCommit({
    client: args.client,
    restaurantId: args.restaurantId,
    settings,
    onPublicCommit: args.onPublicCommit
  });
  if (settings.publicMenuStyle === "unique" && !uiSync.ok) {
    return uiSync;
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
