import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";
import {
  getNumber,
  getString,
  type AnyRow
} from "@/lib/analytics/serverRows";
import { buildQrRedirectUrl } from "@/lib/owner/menuUrls";
import { DEFAULT_OWNER_QR_STYLE, normalizeOwnerQrStyle } from "@/lib/owner/qrStyle";
import {
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
  redactQrIncidentLogText,
  type CreateOwnerQrCodeArgs,
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
  CanonicalQrMutationResult,
  CanonicalQrRotationResult,
  OwnerQrCodeRecord,
  OwnerQrCodeStatus,
  OwnerQrCanonicalError,
  OwnerQrCanonicalRead,
  OwnerQrStyle,
  OwnerQrTargetKind
} from "@/lib/owner/types";

const QR_TABLE = "qr_codes";

type QrIncidentCode =
  | QrSupabaseFailureCode
  | "QR_MARK_RESTAURANT_READY_FAILED"
  | "QR_RESOLVE_METADATA_FAILED"
  | "QR_RESOLVE_LEGACY_RPC_FAILED"
  | "QR_RESOLVE_LEGACY_SELECT_FAILED"
  | "QR_CANONICAL_READ_FAILED"
  | "QR_CANONICAL_RPC_FAILED"
  | "QR_CANONICAL_ROTATE_FAILED";

type QrIncidentOperation =
  | "create-config"
  | "create-insert"
  | "update-config"
  | "update"
  | "canonical-read"
  | "canonical-get-or-create"
  | "canonical-rotate"
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
    purposeKey: getString(row, ["purpose_key", "purposeKey"], "default"),
    isCanonical: row.is_canonical === true || row.isCanonical === true,
    recoverable: false,
    tokenPreview: token,
    targetPath: getString(row, ["target_path", "targetPath"], "/"),
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

function isMissingLegacyTargetKind(error: QrSupabaseError): boolean {
  if (error.code !== "42703") return false;
  const text = `${error.message ?? ""}\n${error.details ?? ""}\n${error.hint ?? ""}`;
  return /(?:\bcolumn\s+["']?target_kind["']?|\btarget_kind\s+column\b)[\s\S]{0,80}\bdoes not exist\b/i.test(
    text
  );
}

const CANONICAL_COLUMNS = [
  "id",
  "restaurant_id",
  "label",
  "target_kind",
  "purpose_key",
  "is_canonical",
  "token_preview",
  "token_ciphertext",
  "token_nonce",
  "token_key_version",
  "target_path",
  "status",
  "scan_count",
  "last_scanned_at",
  "style_json",
  "created_at",
  "updated_at"
].join(", ");

const CANONICAL_UNRECOVERABLE: OwnerQrCanonicalError = {
  ok: false,
  code: "canonical-unrecoverable",
  error: "Le QR canonique existe mais son URL ne peut pas etre recuperee."
};

function normalizePurposeKey(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized || "default";
}

function vaultEnvelope(row: AnyRow) {
  const ciphertext = getString(
    row,
    ["token_ciphertext", "tokenCiphertext"],
    ""
  );
  const nonce = getString(row, ["token_nonce", "tokenNonce"], "");
  const keyVersion = getString(
    row,
    ["token_key_version", "tokenKeyVersion"],
    ""
  );
  if (!ciphertext || !nonce || !keyVersion) return null;
  return { ciphertext, nonce, keyVersion };
}

async function recoverCanonicalRecord(
  row: AnyRow
): Promise<OwnerQrCodeRecord | null> {
  const record = mapQrRow(row);
  const envelope = vaultEnvelope(row);
  if (!envelope || !record.id || !record.restaurantId || !record.isCanonical) {
    return null;
  }
  try {
    const { decryptQrToken } = await import("@/lib/owner/qrTokenVault");
    const token = decryptQrToken(envelope, {
      qrId: record.id,
      restaurantId: record.restaurantId,
      targetKind: record.targetKind,
      purposeKey: record.purposeKey
    });
    record.recoverable = true;
    record.redirectUrl = buildQrRedirectUrl(token);
    return record;
  } catch {
    return null;
  }
}

function canonicalConfigFailure(
  operation: "canonical-read" | "canonical-get-or-create" | "canonical-rotate",
  reason: string
): QrSupabaseFailure {
  const code =
    operation === "canonical-read"
      ? "QR_CANONICAL_READ_FAILED"
      : operation === "canonical-rotate"
        ? "QR_CANONICAL_ROTATE_FAILED"
        : "QR_CANONICAL_RPC_FAILED";
  const incidentId = logQrSupabaseIncident({
    operation,
    code,
    configReason: reason
  });
  return buildQrSupabaseFailure({ code, incidentId });
}

export async function getOwnerCanonicalQrCode(args: {
  restaurantId: string;
  targetKind: OwnerQrTargetKind;
  purposeKey: string;
}): Promise<OwnerQrCanonicalRead | QrSupabaseFailure> {
  const admin = getSupabaseAdminClient();
  if (!admin.ok) return canonicalConfigFailure("canonical-read", admin.reason);

  const purposeKey = normalizePurposeKey(args.purposeKey);
  const { data, error } = await admin.client
    .from(QR_TABLE)
    .select(CANONICAL_COLUMNS)
    .eq("restaurant_id", args.restaurantId)
    .eq("target_kind", args.targetKind)
    .eq("purpose_key", purposeKey)
    .eq("is_canonical", true)
    .maybeSingle();

  if (error && !isSupabaseMiss(error)) {
    const incidentId = logQrSupabaseIncident({
      operation: "canonical-read",
      code: "QR_CANONICAL_READ_FAILED",
      supabaseError: error
    });
    return buildQrSupabaseFailure({
      code: "QR_CANONICAL_READ_FAILED",
      incidentId
    });
  }
  if (!data) return { found: false, recoverable: false, record: null };

  const row = data as unknown as AnyRow;
  const mapped = mapQrRow(row);
  const recovered = await recoverCanonicalRecord(row);
  return {
    found: true,
    recoverable: Boolean(recovered),
    record: recovered ?? mapped
  };
}

export async function getOrCreateOwnerQrCode(
  args: CreateOwnerQrCodeArgs & { purposeKey: string }
): Promise<CanonicalQrMutationResult | QrSupabaseFailure | { ok: false; error: string }> {
  const targetKind = args.targetKind ?? inferOwnerQrTargetKind(args.targetPath);
  const targetPath = sanitizeOwnerQrTargetPath(args.targetPath);
  if (
    !args.restaurantId.trim() ||
    !targetPath ||
    !isOwnerQrTargetPathAllowed(targetKind, targetPath)
  ) {
    return { ok: false, error: "Destination QR invalide ou incompatible." };
  }
  const purposeKey = normalizePurposeKey(args.purposeKey);
  const existing = await getOwnerCanonicalQrCode({
    restaurantId: args.restaurantId,
    targetKind,
    purposeKey
  });
  if ("ok" in existing) return existing;
  if (existing.found) {
    if (!existing.recoverable || !existing.record?.redirectUrl) {
      return CANONICAL_UNRECOVERABLE;
    }
    return {
      ok: true,
      created: false,
      persisted: true,
      record: existing.record
    };
  }

  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return canonicalConfigFailure("canonical-get-or-create", admin.reason);
  }
  const id = randomUUID();
  const token = generateQrToken();
  const binding = {
    qrId: id,
    restaurantId: args.restaurantId,
    targetKind,
    purposeKey
  };
  let envelope;
  try {
    const { encryptQrToken } = await import("@/lib/owner/qrTokenVault");
    envelope = encryptQrToken(token, binding);
  } catch {
    return canonicalConfigFailure(
      "canonical-get-or-create",
      "QR token vault unavailable."
    );
  }

  const { data, error } = await admin.client.rpc(
    "owner_get_or_create_canonical_qr",
    {
      p_id: id,
      p_restaurant_id: args.restaurantId,
      p_label: (args.label || "QR menu").trim().slice(0, 120),
      p_target_kind: targetKind,
      p_purpose_key: purposeKey,
      p_target_path: targetPath,
      p_token_hash: hashQrTokenForStorage(token),
      p_token_preview: tokenPreview(token),
      p_token_ciphertext: envelope.ciphertext,
      p_token_nonce: envelope.nonce,
      p_token_key_version: envelope.keyVersion,
      p_style_json: normalizeOwnerQrStyle(args.style)
    }
  );
  if (error) {
    const code = classifyQrCreatePersistenceFailure(error);
    const incidentId = logQrSupabaseIncident({
      operation: "canonical-get-or-create",
      code,
      supabaseError: error
    });
    return buildQrSupabaseFailure({ code, incidentId });
  }

  const row = firstRpcRow(data);
  const record = row
    ? await recoverCanonicalRecord({ ...row, is_canonical: true })
    : null;
  if (!record) return CANONICAL_UNRECOVERABLE;
  return {
    ok: true,
    created: row?.created === true,
    persisted: true,
    record
  };
}

export async function createOwnerQrCode(
  args: CreateOwnerQrCodeArgs & { purposeKey?: string }
) {
  return getOrCreateOwnerQrCode({
    ...args,
    purposeKey: args.purposeKey ?? "default"
  });
}

export async function updateOwnerQrCode(
  id: string,
  patch: { style?: unknown; label?: string }
): Promise<{ ok: true; record: OwnerQrCodeRecord } | OwnerQrCanonicalError | QrSupabaseFailure | { ok: false; error: string }> {
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

  const { data: currentRow, error: readError } = await admin.client
    .from(QR_TABLE)
    .select(CANONICAL_COLUMNS)
    .eq("id", id)
    .eq("is_canonical", true)
    .maybeSingle();
  if (readError || !currentRow) {
    return { ok: false, error: "QR canonique introuvable." };
  }
  const current = await recoverCanonicalRecord(
    currentRow as unknown as AnyRow
  );
  if (!current) return CANONICAL_UNRECOVERABLE;

  const update: Record<string, unknown> = {};
  if (patch.style !== undefined) {
    update.style_json = normalizeOwnerQrStyle(patch.style);
  }
  if (typeof patch.label === "string" && patch.label.trim()) {
    update.label = patch.label.trim().slice(0, 120);
  }
  if (Object.keys(update).length === 0) {
    return { ok: false, error: "Une etiquette ou un style non vide est requis." };
  }

  const { data, error } = await admin.client
    .from(QR_TABLE)
    .update(update)
    .eq("id", id)
    .eq("is_canonical", true)
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

  const record = await recoverCanonicalRecord(data as AnyRow);
  return record ? { ok: true, record } : CANONICAL_UNRECOVERABLE;
}

export async function rotateOwnerQrCode(
  id: string,
  args: { confirmed: true }
): Promise<CanonicalQrRotationResult | QrSupabaseFailure | { ok: false; error: string }> {
  if (args.confirmed !== true) {
    return { ok: false, error: "Confirmation de rotation requise." };
  }
  const admin = getSupabaseAdminClient();
  if (!admin.ok) return canonicalConfigFailure("canonical-rotate", admin.reason);

  const { data: previousRow, error: readError } = await admin.client
    .from(QR_TABLE)
    .select(CANONICAL_COLUMNS)
    .eq("id", id)
    .eq("is_canonical", true)
    .maybeSingle();
  if (readError || !previousRow) {
    return { ok: false, error: "QR canonique introuvable." };
  }

  const previousData = previousRow as unknown as AnyRow;
  const previous = mapQrRow(previousData);
  const newId = randomUUID();
  const token = generateQrToken();
  const binding = {
    qrId: newId,
    restaurantId: previous.restaurantId,
    targetKind: previous.targetKind,
    purposeKey: previous.purposeKey
  };
  let envelope;
  try {
    const { encryptQrToken } = await import("@/lib/owner/qrTokenVault");
    envelope = encryptQrToken(token, binding);
  } catch {
    return canonicalConfigFailure("canonical-rotate", "QR token vault unavailable.");
  }

  const { data, error } = await admin.client.rpc("owner_rotate_canonical_qr", {
    p_previous_id: id,
    p_new_id: newId,
    p_restaurant_id: previous.restaurantId,
    p_target_kind: previous.targetKind,
    p_purpose_key: previous.purposeKey,
    p_label: previous.label,
    p_target_path: previous.targetPath,
    p_token_hash: hashQrTokenForStorage(token),
    p_token_preview: tokenPreview(token),
    p_token_ciphertext: envelope.ciphertext,
    p_token_nonce: envelope.nonce,
    p_token_key_version: envelope.keyVersion,
    p_style_json: previous.style,
    p_confirm: true
  });
  if (error) {
    const incidentId = logQrSupabaseIncident({
      operation: "canonical-rotate",
      code: "QR_CANONICAL_ROTATE_FAILED",
      supabaseError: error
    });
    return buildQrSupabaseFailure({
      code: "QR_CANONICAL_ROTATE_FAILED",
      incidentId
    });
  }

  const rows = Array.isArray(data) ? data : [data];
  const currentRow =
    rows.find(
      (row) => getString(row as unknown as AnyRow, ["id"], "") === newId
    ) ??
    rows.find(
      (row) => (row as unknown as AnyRow)?.is_canonical === true
    ) ??
    firstRpcRow(data);
  const current = currentRow
    ? await recoverCanonicalRecord({
        ...(currentRow as unknown as AnyRow),
        is_canonical: true
      })
    : null;
  if (!current) return CANONICAL_UNRECOVERABLE;
  previous.isCanonical = false;
  const recoveredPrevious = await recoverCanonicalRecord({
    ...previousData,
    is_canonical: true
  });
  if (recoveredPrevious) {
    previous.recoverable = true;
  }
  delete previous.redirectUrl;
  return { ok: true, previous, current };
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
    const initial = await client
      .from(QR_TABLE)
      .select("id, restaurant_id, target_kind, target_path, status")
      .eq("token_hash", tokenHash)
      .limit(1)
      .maybeSingle();
    let row: AnyRow | null = initial.data as unknown as AnyRow | null;
    let selectError = initial.error;
    let oldSchemaWithoutTargetKind = false;
    if (selectError && isMissingLegacyTargetKind(selectError)) {
      oldSchemaWithoutTargetKind = true;
      const retry = await client
        .from(QR_TABLE)
        .select("id, restaurant_id, target_path, status")
        .eq("token_hash", tokenHash)
        .limit(1)
        .maybeSingle();
      row = retry.data as unknown as AnyRow | null;
      selectError = retry.error;
    }
    if (selectError) {
      logQrSupabaseIncident({
        operation: "resolve-legacy-select",
        code: "QR_RESOLVE_LEGACY_SELECT_FAILED",
        supabaseError: selectError
      });
      return { ok: false };
    }
    if (!row) continue;
    const rawTargetKind = oldSchemaWithoutTargetKind
      ? "menu"
      : getString(row, ["target_kind", "targetKind"], "");
    if (rawTargetKind !== "menu" && rawTargetKind !== "admin") {
      return { ok: false };
    }
    const targetKind: OwnerQrTargetKind = rawTargetKind;
    const metadata = {
      qrId: getString(row, ["id"], ""),
      restaurantId: getString(
        row,
        ["restaurant_id", "restaurantId"],
        ""
      ),
      status: getString(row, ["status"], ""),
      targetKind,
      targetPath: getString(row, ["target_path", "targetPath"], "")
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
