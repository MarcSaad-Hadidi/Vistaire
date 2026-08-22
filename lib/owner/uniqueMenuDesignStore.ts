import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";
import {
  mapMenuUiConfigRow,
  type MenuUiConfig,
  type MenuUiConfigRow
} from "@/lib/menu/menuUiConfig";
import {
  applyUniqueMenuDesignLifecycleAction,
  isUniqueMenuDesignAction,
  normalizeUniqueMenuDesign,
  type UniqueMenuDesign,
  type UniqueMenuDesignAction
} from "@/lib/menu/uniqueMenuDesign";
import {
  getRegisteredUniqueMenuRenderersForDesign,
  getUniqueMenuRendererForDesign,
  getUniqueMenuRendererForDesignVersion
} from "@/lib/menu/uniqueMenuRendererRegistry";
import { readPublicMenuSettingsWithFallbacks } from "@/lib/owner/publicMenuSettingsFallback";
import { isCanonicalUuid } from "@/lib/owner/storageSafeIdentifier";

const TABLE = "menu_ui_configs";

export type UniqueMenuDesignLifecycleStoreResult =
  | {
      ok: true;
      uniqueDesign: UniqueMenuDesign;
      availableRenderers: ReturnType<
        typeof getRegisteredUniqueMenuRenderersForDesign
      >;
      draftPersisted: boolean;
      publishedPersisted: boolean;
    }
  | {
      ok: false;
      status: 400 | 404 | 409 | 502 | 503;
      error: string;
    };

export type UniqueMenuDesignSnapshotResult =
  | {
      ok: true;
      uniqueDesign: UniqueMenuDesign | null;
      style: string;
      availableRenderers: ReturnType<
        typeof getRegisteredUniqueMenuRenderersForDesign
      >;
      restaurantId: string;
      draftStatus: string | null;
      publishedStatus: string | null;
    }
  | {
      ok: false;
      status: 400 | 404 | 503;
      error: string;
    };

function missingAdmin(): UniqueMenuDesignLifecycleStoreResult {
  return {
    ok: false,
    status: 503,
    error: "Supabase admin indisponible pour le cycle de vie unique."
  };
}

async function getCanonicalPublicMenuStyle(
  client: SupabaseClient,
  restaurantId: string
): Promise<string> {
  const primaryMenus = await client
    .from("menus")
    .select("id,is_primary,status")
    .eq("restaurant_id", restaurantId)
    .limit(50);
  const rows = Array.isArray(primaryMenus.data) ? primaryMenus.data : [];
  const activeRows = rows.filter(
    (row) => String((row as { status?: unknown }).status ?? "") !== "archived"
  );
  const primary =
    activeRows.find(
      (row) =>
        (row as { is_primary?: unknown }).is_primary === true &&
        String((row as { status?: unknown }).status ?? "") === "published"
    ) ??
    activeRows.find((row) => (row as { is_primary?: unknown }).is_primary === true) ??
    activeRows[0];
  const menuId =
    typeof (primary as { id?: unknown } | undefined)?.id === "string"
      ? (primary as { id: string }).id
      : undefined;
  const settings = await readPublicMenuSettingsWithFallbacks({
    client,
    restaurantId,
    menuId
  });
  return settings.publicMenuStyle;
}

async function loadConfigRow(
  client: SupabaseClient,
  restaurantId: string,
  status: "draft" | "published"
): Promise<{ row: MenuUiConfigRow; config: MenuUiConfig } | null> {
  const query = client
    .from(TABLE)
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("status", status)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await query;
  if (error || !data) return null;
  const mapped = mapMenuUiConfigRow(data as MenuUiConfigRow);
  return { row: data as MenuUiConfigRow, config: mapped.config };
}

export async function getUniqueMenuDesignSnapshot(
  restaurantId: string
): Promise<UniqueMenuDesignSnapshotResult> {
  if (!isCanonicalUuid(restaurantId)) {
    return { ok: false, status: 400, error: "restaurantId invalide." };
  }

  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return {
      ok: false,
      status: 503,
      error: "Supabase admin indisponible."
    };
  }

  const draft = await loadConfigRow(admin.client, restaurantId, "draft");
  const published = await loadConfigRow(admin.client, restaurantId, "published");
  const config = draft?.config ?? published?.config ?? null;
  if (!config) {
    return {
      ok: false,
      status: 404,
      error: "Configuration UI introuvable pour ce restaurant."
    };
  }

  const style = await getCanonicalPublicMenuStyle(admin.client, restaurantId);
  const uniqueDesign = normalizeUniqueMenuDesign(config.uniqueDesign);
  return {
    ok: true,
    restaurantId,
    style,
    uniqueDesign,
    availableRenderers: getRegisteredUniqueMenuRenderersForDesign(
      uniqueDesign?.designId
    ),
    draftStatus:
      typeof draft?.row.status === "string" ? draft.row.status : null,
    publishedStatus:
      typeof published?.row.status === "string" ? published.row.status : null
  };
}

export async function mutateUniqueMenuDesignLifecycle(args: {
  restaurantId: string;
  action: string;
  expectedDesignId?: string | null;
  expectedVersion?: number | null;
  rendererKey?: string | null;
  onPublicCommit?: () => void | Promise<void>;
}): Promise<UniqueMenuDesignLifecycleStoreResult> {
  if (!isCanonicalUuid(args.restaurantId)) {
    return { ok: false, status: 400, error: "restaurantId invalide." };
  }
  if (!isUniqueMenuDesignAction(args.action)) {
    return { ok: false, status: 400, error: "Action unique non autorisee." };
  }

  const action = args.action as UniqueMenuDesignAction;
  const admin = getSupabaseAdminClient();
  if (!admin.ok) return missingAdmin();
  if (typeof admin.client.rpc !== "function") {
    return {
      ok: false,
      status: 503,
      error:
        "Mutation unique impossible : RPC transactionnelle indisponible. Aucune ecriture."
    };
  }

  const draft = await loadConfigRow(admin.client, args.restaurantId, "draft");
  const published = await loadConfigRow(
    admin.client,
    args.restaurantId,
    "published"
  );
  const baseConfig = draft?.config ?? published?.config;
  if (!baseConfig) {
    return {
      ok: false,
      status: 404,
      error: "Configuration UI introuvable pour ce restaurant."
    };
  }

  const style = await getCanonicalPublicMenuStyle(
    admin.client,
    args.restaurantId
  );
  if (style !== "unique") {
    return {
      ok: false,
      status: 400,
      error: "Le restaurant n'est pas en style unique."
    };
  }

  const current = normalizeUniqueMenuDesign(baseConfig.uniqueDesign);

  if (action !== "create-new" || current) {
    if (!current && action !== "create-new") {
      return {
        ok: false,
        status: 404,
        error: "Identite unique introuvable."
      };
    }
    if (current) {
      if (!isCanonicalUuid(args.expectedDesignId)) {
        return { ok: false, status: 400, error: "designId attendu invalide." };
      }
      if (
        typeof args.expectedVersion !== "number" ||
        !Number.isInteger(args.expectedVersion) ||
        args.expectedVersion < 1
      ) {
        return { ok: false, status: 400, error: "expectedVersion invalide." };
      }
    }
  }

  let rendererVersion: number | null | undefined;
  if (action === "mark-ready") {
    if (!current) {
      return { ok: false, status: 404, error: "Identite unique introuvable." };
    }
    const entry = getUniqueMenuRendererForDesign(
      current.designId,
      args.rendererKey
    );
    if (!entry) {
      return {
        ok: false,
        status: 400,
        error:
          "Aucun renderer enregistre pour ce designId. Enregistrez un renderer statique avant mark-ready."
      };
    }
    rendererVersion = entry.version;
  }

  if (action === "publish") {
    if (!current) {
      return { ok: false, status: 404, error: "Identite unique introuvable." };
    }
    const entry = getUniqueMenuRendererForDesignVersion(
      current.designId,
      current.rendererKey,
      current.rendererVersion
    );
    if (!entry) {
      return {
        ok: false,
        status: 400,
        error:
          "Publication refusee : renderer inconnu, incomplet, non lie au designId, ou version obsolete."
      };
    }
  }

  if (current) {
    const applied = applyUniqueMenuDesignLifecycleAction({
      current,
      action,
      expectedDesignId: args.expectedDesignId as string,
      expectedVersion: args.expectedVersion as number,
      rendererKey: args.rendererKey,
      rendererVersion
    });
    if (!applied.ok) {
      return {
        ok: false,
        status: applied.status,
        error: applied.error
      };
    }
  }

  const designIdForRpc =
    current?.designId ??
    (isCanonicalUuid(args.expectedDesignId)
      ? (args.expectedDesignId as string)
      : "00000000-0000-4000-8000-000000000000");
  const versionForRpc =
    typeof args.expectedVersion === "number" && args.expectedVersion >= 1
      ? args.expectedVersion
      : 1;

  const { data, error } = await admin.client.rpc(
    "mutate_owner_unique_menu_design",
    {
      p_restaurant_id: args.restaurantId,
      p_design_id: designIdForRpc,
      p_expected_version: versionForRpc,
      p_action: action,
      p_renderer_key: args.rendererKey ?? null,
      p_renderer_version:
        action === "mark-ready" && rendererVersion != null
          ? rendererVersion
          : null
    }
  );

  if (error) {
    return {
      ok: false,
      status: 503,
      error: "Mutation unique impossible via RPC Supabase."
    };
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      ok: false,
      status: 502,
      error: "RPC unique a retourne une reponse invalide."
    };
  }

  const response = data as Record<string, unknown>;
  if (response.ok !== true) {
    const statusCode =
      typeof response.status === "number" ? response.status : 400;
    return {
      ok: false,
      status: (statusCode === 409 ? 409 : statusCode === 404 ? 404 : 400) as
        | 400
        | 404
        | 409,
      error:
        typeof response.error === "string"
          ? response.error
          : "Mutation unique refusee."
    };
  }

  const draftPersisted = response.draftPersisted === true;
  const publishedPersisted = response.publishedPersisted === true;
  if (publishedPersisted) await args.onPublicCommit?.();

  const uniqueDesign = normalizeUniqueMenuDesign(response.uniqueDesign);
  if (!uniqueDesign) {
    return {
      ok: false,
      status: 502,
      error: "RPC unique a retourne une identite invalide."
    };
  }

  if (draft && !draftPersisted) {
    return {
      ok: false,
      status: 503,
      error: "Draft unique non persiste."
    };
  }
  if (published && !publishedPersisted) {
    return {
      ok: false,
      status: 503,
      error: "Published unique non persiste."
    };
  }
  if (!draftPersisted && !publishedPersisted) {
    return {
      ok: false,
      status: 503,
      error: "Aucune configuration UI n'a pu etre mise a jour."
    };
  }

  return {
    ok: true,
    uniqueDesign,
    availableRenderers: getRegisteredUniqueMenuRenderersForDesign(
      uniqueDesign.designId
    ),
    draftPersisted,
    publishedPersisted
  };
}
