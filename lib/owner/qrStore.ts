import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";
import {
  getNumber,
  getString,
  getSupabaseTableColumns,
  pickColumn,
  type AnyRow
} from "@/lib/analytics/serverRows";
import { buildQrRedirectUrl } from "@/lib/owner/menuUrls";
import { DEFAULT_OWNER_QR_STYLE, normalizeOwnerQrStyle } from "@/lib/owner/qrStyle";
import {
  createSignedQrToken,
  canUseSignedQrFallback,
  generateQrToken,
  hashQrTokenForStorage,
  isSignedQrToken,
  qrTokenHashCandidates,
  tokenPreview,
  verifySignedQrToken
} from "@/lib/owner/qrTokens";
import {
  buildQrSupabaseFailure,
  classifyQrCreatePersistenceFailure,
  createOwnerQrCodeWithDependencies,
  redactQrIncidentLogText,
  type CreateOwnerQrCodeArgs,
  type QrPersistenceResult,
  type QrSupabaseFailure,
  type QrSupabaseFailureCode
} from "@/lib/owner/qrCreationCore";
import {
  isQrMetadataRpcUnavailable,
  resolveLegacyQrScan,
  resolveQrRowMetadata,
  resolveSignedMenuFallback,
  type QrResolution
} from "@/lib/owner/qrResolutionCore";
import {
  inferOwnerQrTargetKind,
  isOwnerQrTargetPathAllowed,
  sanitizeOwnerQrTargetPath
} from "@/lib/owner/menuUrlCore";
import type {
  OwnerQrCodeRecord,
  OwnerQrCodeStatus,
  OwnerQrStyle,
  OwnerQrTargetKind
} from "@/lib/owner/types";

const QR_TABLE = "qr_codes";

type QrIncidentCode =
  | QrSupabaseFailureCode
  | "QR_MARK_RESTAURANT_READY_FAILED"
  | "QR_RESOLVE_METADATA_FAILED"
  | "QR_RESOLVE_LEGACY_RPC_FAILED"
  | "QR_RESOLVE_LEGACY_SELECT_FAILED";

type QrIncidentOperation =
  | "create-config"
  | "create-insert"
  | "update-config"
  | "update"
  | "mark-restaurant-ready"
  | "resolve-metadata"
  | "resolve-legacy-rpc"
  | "resolve-legacy-select";

type QrSupabaseError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

type QrIncidentInput = {
  operation: QrIncidentOperation;
  code: QrIncidentCode;
} & (
  | { supabaseError: QrSupabaseError; configReason?: never }
  | { configReason: string; supabaseError?: never }
);

function logQrSupabaseIncident(input: QrIncidentInput): string {
  const incidentId = randomUUID();
  const cause = input.supabaseError
    ? {
        supabase: {
          code: input.supabaseError.code ?? null,
          message:
            redactQrIncidentLogText(input.supabaseError.message) ??
            "Unknown Supabase error.",
          details: redactQrIncidentLogText(input.supabaseError.details),
          hint: redactQrIncidentLogText(input.supabaseError.hint)
        }
      }
    : {
        config: { reason: input.configReason }
      };

  console.error("[Vistaire owner] QR Supabase incident", {
    incidentId,
    operation: input.operation,
    code: input.code,
    ...cause
  });
  return incidentId;
}

const QR_STATUS_VALUES = new Set<OwnerQrCodeStatus>([
  "active",
  "paused",
  "archived"
]);

function normalizeStatus(value: string): OwnerQrCodeStatus {
  return QR_STATUS_VALUES.has(value as OwnerQrCodeStatus)
    ? (value as OwnerQrCodeStatus)
    : "archived";
}

function isSupabaseMiss(error: QrSupabaseError): boolean {
  return (
    error.code === "PGRST116" &&
    /\b0 rows?\b/i.test(error.details ?? "")
  );
}

function parseStyle(value: unknown): OwnerQrStyle {
  if (typeof value === "string") {
    try {
      return normalizeOwnerQrStyle(JSON.parse(value));
    } catch {
      return DEFAULT_OWNER_QR_STYLE;
    }
  }
  return normalizeOwnerQrStyle(value);
}

/** Restaurant ids with at least one active row in qr_codes (dashboard QR status). */
export function buildActiveQrRestaurantIds(rows: AnyRow[]): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (normalizeStatus(getString(row, ["status"], "")) !== "active") continue;
    const restaurantId = getString(row, ["restaurant_id", "restaurantId"], "");
    if (restaurantId) ids.add(restaurantId);
  }
  return ids;
}

async function markRestaurantQrReady(
  client: SupabaseClient,
  restaurantId: string
): Promise<void> {
  if (!restaurantId) return;

  const columns = await getSupabaseTableColumns("restaurants");
  const update: Record<string, unknown> = {};
  const now = new Date().toISOString();

  const qrReadyCol = columns.size > 0 ? pickColumn(columns, ["qr_ready", "qrReady"]) : "qr_ready";
  if (qrReadyCol) update[qrReadyCol] = true;

  const generatedCol = columns.size > 0
    ? pickColumn(columns, ["qr_generated_at", "qrGeneratedAt", "qr_deployed_at"])
    : "qr_generated_at";
  if (generatedCol) update[generatedCol] = now;

  if (Object.keys(update).length === 0) return;

  const idCol = columns.size > 0 ? pickColumn(columns, ["id", "restaurant_id"]) : "id";
  if (!idCol) return;

  const { error } = await client
    .from("restaurants")
    .update(update)
    .eq(idCol, restaurantId);

  if (error) {
    logQrSupabaseIncident({
      operation: "mark-restaurant-ready",
      code: "QR_MARK_RESTAURANT_READY_FAILED",
      supabaseError: error
    });
  }
}

function mapQrRow(row: AnyRow): OwnerQrCodeRecord {
  const id = getString(row, ["id"], "");
  const token = getString(row, ["token_preview", "tokenPreview"], "");
  return {
    id,
    restaurantId: getString(row, ["restaurant_id", "restaurantId"], ""),
    label: getString(row, ["label"], "QR menu"),
    targetKind:
      getString(row, ["target_kind", "targetKind"], "") === "admin"
        ? "admin"
        : getString(row, ["target_kind", "targetKind"], "") === "menu"
          ? "menu"
          : inferOwnerQrTargetKind(
              getString(row, ["target_path", "targetPath"], "/")
            ),
    tokenPreview: token,
    targetPath: getString(row, ["target_path", "targetPath"], "/"),
    redirectUrl: "",
    status: normalizeStatus(getString(row, ["status"], "")),
    scanCount: getNumber(row, ["scan_count", "scanCount"], 0),
    lastScannedAt:
      getString(row, ["last_scanned_at", "lastScannedAt"], "") || null,
    style: parseStyle(row.style_json ?? row.styleJson ?? row.style),
    persisted: true,
    createdAt: getString(row, ["created_at", "createdAt"], ""),
    updatedAt: getString(row, ["updated_at", "updatedAt"], "")
  };
}

async function persistOwnerQrCode(
  args: CreateOwnerQrCodeArgs
): Promise<QrPersistenceResult> {
  const targetKind = args.targetKind ?? inferOwnerQrTargetKind(args.targetPath);
  const targetPath = sanitizeOwnerQrTargetPath(args.targetPath);
  if (!targetPath) {
    return { ok: false, error: "Chemin de destination invalide." };
  }
  if (!isOwnerQrTargetPathAllowed(targetKind, targetPath)) {
    return { ok: false, error: "Destination QR incompatible avec le type choisi." };
  }

  const style = normalizeOwnerQrStyle(args.style);
  const label = (args.label || "QR menu").trim().slice(0, 120);
  const admin = getSupabaseAdminClient();

  // Persistent path: real qr_codes row, raw token returned once, only the hash stored.
  if (admin.ok) {
    const token = generateQrToken();
    const tokenHash = hashQrTokenForStorage(token);
    const insertRow = {
      restaurant_id: args.restaurantId || null,
      label,
      token_hash: tokenHash,
      token_preview: tokenPreview(token),
      target_kind: targetKind,
      target_path: targetPath,
      style_json: style,
      status: "active",
      scan_count: 0
    };

    const { data, error } = await admin.client
      .from(QR_TABLE)
      .insert(insertRow)
      .select("*")
      .single();

    if (error) {
      const code = classifyQrCreatePersistenceFailure(error);
      const incidentId = logQrSupabaseIncident({
        operation: "create-insert",
        code,
        supabaseError: error
      });
      return buildQrSupabaseFailure({
        code,
        incidentId
      });
    }

    const record = mapQrRow((data ?? insertRow) as AnyRow);
    record.style = style;
    record.targetKind = targetKind;
    record.redirectUrl = buildQrRedirectUrl(token);
    await markRestaurantQrReady(admin.client, args.restaurantId);
    return { ok: true, record, token, persisted: true };
  }

  const incidentId = logQrSupabaseIncident({
    operation: "create-config",
    code: "QR_CREATE_CONFIG_UNAVAILABLE",
    configReason: admin.reason
  });
  return buildQrSupabaseFailure({
    code: "QR_CREATE_CONFIG_UNAVAILABLE",
    incidentId,
    ...(targetKind === "menu" ? { fallbackEligible: true as const } : {})
  });
}

export async function createOwnerQrCode(
  args: CreateOwnerQrCodeArgs
): Promise<QrPersistenceResult> {
  return createOwnerQrCodeWithDependencies(args, {
    persistQrCode: persistOwnerQrCode,
    createSignedMenuFallback: ({ targetPath, restaurantId }) => {
      if (
        !canUseSignedQrFallback() ||
        !isOwnerQrTargetPathAllowed("menu", targetPath)
      ) {
        return {
          ok: false,
          error:
            "Le QR fallback signe requiert une destination menu valide et une configuration autorisee."
        };
      }
      return createSignedQrToken({ targetPath, restaurantId });
    }
  });
}

export async function updateOwnerQrCode(
  id: string,
  patch: { status?: OwnerQrCodeStatus; style?: unknown; label?: string }
): Promise<{ ok: true; record: OwnerQrCodeRecord } | QrSupabaseFailure | { ok: false; error: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    const incidentId = logQrSupabaseIncident({
      operation: "update-config",
      code: "QR_UPDATE_CONFIG_UNAVAILABLE",
      configReason: admin.reason
    });
    return buildQrSupabaseFailure({
      code: "QR_UPDATE_CONFIG_UNAVAILABLE",
      incidentId
    });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status && QR_STATUS_VALUES.has(patch.status)) {
    update.status = patch.status;
  }
  if (patch.style !== undefined) {
    update.style_json = normalizeOwnerQrStyle(patch.style);
  }
  if (typeof patch.label === "string" && patch.label.trim()) {
    update.label = patch.label.trim().slice(0, 120);
  }

  const { data, error } = await admin.client
    .from(QR_TABLE)
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error && !isSupabaseMiss(error)) {
    const incidentId = logQrSupabaseIncident({
      operation: "update",
      code: "QR_UPDATE_FAILED",
      supabaseError: error
    });
    return buildQrSupabaseFailure({
      code: "QR_UPDATE_FAILED",
      incidentId
    });
  }
  if (error || !data) {
    return { ok: false, error: "QR introuvable ou non modifiable." };
  }

  return { ok: true, record: mapQrRow(data as AnyRow) };
}

export type { QrResolution } from "@/lib/owner/qrResolutionCore";

function firstRpcRow(data: unknown): AnyRow | null {
  if (Array.isArray(data)) return (data[0] as AnyRow | undefined) ?? null;
  return data && typeof data === "object" ? (data as AnyRow) : null;
}

function resolutionFromRow(row: AnyRow): QrResolution {
  const qrId = getString(row, ["qr_id", "id", "qrId"], "");
  const restaurantId = getString(
    row,
    ["restaurant_id", "restaurantId"],
    ""
  );
  const targetPath = getString(row, ["target_path", "targetPath"], "");
  const rawTargetKind = getString(row, ["target_kind", "targetKind"], "");
  const targetKind =
    rawTargetKind === "menu" || rawTargetKind === "admin"
      ? rawTargetKind
      : undefined;
  return resolveQrRowMetadata(
    {
      qrId,
      restaurantId,
      status: getString(row, ["status"], ""),
      targetKind,
      targetPath
    }
  );
}

/** Resolves a QR and returns the live persisted identity used for authorization. */
export async function resolveQrToken(token: string): Promise<QrResolution> {
  if (!token || token.length > 800) return { ok: false };

  const admin = getSupabaseAdminClient();

  if (admin.ok && !isSignedQrToken(token)) {
    const resolved = await resolvePersistedQrToken(
      admin.client,
      qrTokenHashCandidates(token)
    );
    if (resolved.ok) return resolved;
  }

  // Signed fallback token (dev/build, or when DB lookup missed).
  const signed = verifySignedQrToken(token);
  if (signed) {
    return resolveSignedMenuFallback(signed);
  }

  return { ok: false };
}

async function resolvePersistedQrToken(
  client: SupabaseClient,
  tokenHashes: string[]
): Promise<QrResolution> {
  let metadataRpcUnavailable = false;
  for (const tokenHash of tokenHashes) {
    const { data, error } = await client.rpc("resolve_qr_code_scan_metadata", {
      p_token_hash: tokenHash
    });
    if (error) {
      if (!isQrMetadataRpcUnavailable(error)) {
        logQrSupabaseIncident({
          operation: "resolve-metadata",
          code: "QR_RESOLVE_METADATA_FAILED",
          supabaseError: error
        });
        return { ok: false };
      }
      metadataRpcUnavailable = true;
      break;
    }
    const row = firstRpcRow(data);
    if (!row) continue;
    return resolutionFromRow(row);
  }
  if (!metadataRpcUnavailable) return { ok: false };

  for (const tokenHash of tokenHashes) {
    const { data: row, error: selectError } = await client
      .from(QR_TABLE)
      .select("id, restaurant_id, target_kind, target_path, status")
      .eq("token_hash", tokenHash)
      .limit(1)
      .maybeSingle();
    if (selectError) {
      logQrSupabaseIncident({
        operation: "resolve-legacy-select",
        code: "QR_RESOLVE_LEGACY_SELECT_FAILED",
        supabaseError: selectError
      });
      return { ok: false };
    }
    if (!row) continue;
    const rawTargetKind = getString(
      row as AnyRow,
      ["target_kind", "targetKind"],
      ""
    );
    if (rawTargetKind !== "menu" && rawTargetKind !== "admin") {
      return { ok: false };
    }
    const targetKind: OwnerQrTargetKind = rawTargetKind;
    const metadata = {
      qrId: getString(row as AnyRow, ["id"], ""),
      restaurantId: getString(
        row as AnyRow,
        ["restaurant_id", "restaurantId"],
        ""
      ),
      status: getString(row as AnyRow, ["status"], ""),
      targetKind,
      targetPath: getString(row as AnyRow, ["target_path", "targetPath"], "")
    };
    if (!resolveQrRowMetadata(metadata).ok) return { ok: false };

    const { data, error } = await client.rpc("resolve_qr_code_scan", {
      p_token_hash: tokenHash
    });
    if (error) {
      logQrSupabaseIncident({
        operation: "resolve-legacy-rpc",
        code: "QR_RESOLVE_LEGACY_RPC_FAILED",
        supabaseError: error
      });
      return { ok: false };
    }
    if (!data) return { ok: false };
    return resolveLegacyQrScan(metadata, String(data));
  }
  return { ok: false };
}
