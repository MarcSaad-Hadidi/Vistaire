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
  isValidOpaqueQrToken,
  isSignedQrToken,
  qrTokenMatchesStorageHash,
  qrTokenHashCandidates,
  tokenPreview,
  verifySignedQrToken
} from "@/lib/owner/qrTokens";
import {
  buildQrSupabaseFailure,
  classifyQrCreatePersistenceFailure,
  redactQrIncidentLogText,
  type CreateOwnerQrCodeArgs,
  type QrPersistenceResult,
  type QrSupabaseFailure,
  type QrSupabaseFailureCode
} from "@/lib/owner/qrCreationCore";
import {
  resolveQrRowMetadata,
  resolveSignedMenuFallback,
  type QrResolution
} from "@/lib/owner/qrResolutionCore";
import {
  buildPublicMenuPath,
  inferOwnerQrTargetKind,
  isOwnerQrTargetPathAllowed
} from "@/lib/owner/menuUrlCore";
import type {
  CanonicalQrMutationResult,
  CanonicalQrRotationResult,
  OwnerQrCodeRecord,
  OwnerQrCodeStatus,
  OwnerQrInventoryRecord,
  OwnerQrLifecycleAction,
  OwnerQrRotationDisposition,
  OwnerQrCanonicalError,
  OwnerQrCanonicalRead,
  OwnerQrRequestError,
  OwnerQrStyle,
  OwnerQrTargetKind
} from "@/lib/owner/types";

const QR_TABLE = "qr_codes";

type QrIncidentCode =
  | QrSupabaseFailureCode
  | "QR_MARK_RESTAURANT_READY_FAILED"
  | "QR_RESOLVE_METADATA_FAILED"
  | "QR_CANONICAL_READ_FAILED"
  | "QR_CANONICAL_RPC_FAILED"
  | "QR_CANONICAL_ROTATE_FAILED"
  | "QR_LIFECYCLE_FAILED"
  | "QR_INVENTORY_FAILED";

type QrIncidentOperation =
  | "create-config"
  | "create-insert"
  | "update-config"
  | "update"
  | "canonical-read"
  | "canonical-get-or-create"
  | "canonical-rotate"
  | "lifecycle"
  | "inventory"
  | "resolve-metadata";

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
  "archived",
  "revoked"
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
    configVersion: getNumber(row, ["config_version", "configVersion"], 0),
    scanCount: getNumber(row, ["scan_count", "scanCount"], 0),
    lastScannedAt:
      getString(row, ["last_scanned_at", "lastScannedAt"], "") || null,
    style: parseStyle(row.style_json ?? row.styleJson ?? row.style),
    persisted: true,
    createdAt: getString(row, ["created_at", "createdAt"], ""),
    updatedAt: getString(row, ["updated_at", "updatedAt"], "")
  };
}

const CANONICAL_COLUMNS = [
  "id",
  "restaurant_id",
  "label",
  "target_kind",
  "purpose_key",
  "is_canonical",
  "token_preview",
  "token_hash",
  "token_ciphertext",
  "token_nonce",
  "token_key_version",
  "target_path",
  "status",
  "config_version",
  "supersedes_qr_code_id",
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

function isDefaultPurposeKey(value: string): boolean {
  return value === "default";
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
): Promise<
  | { ok: true; record: OwnerQrCodeRecord }
  | {
      ok: false;
      code: "configuration-missing" | "token-unrecoverable";
    }
> {
  const record = mapQrRow(row);
  const envelope = vaultEnvelope(row);
  if (!envelope || !record.id || !record.restaurantId || !record.isCanonical) {
    return { ok: false, code: "token-unrecoverable" };
  }
  try {
    const { decryptQrToken } = await import("@/lib/owner/qrTokenVault");
    const token = decryptQrToken(envelope, {
      qrId: record.id,
      restaurantId: record.restaurantId,
      targetKind: record.targetKind,
      purposeKey: record.purposeKey,
      tokenHash: getString(row, ["token_hash", "tokenHash"], "")
    });
    if (
      !isValidOpaqueQrToken(token) ||
      !qrTokenMatchesStorageHash(
        token,
        getString(row, ["token_hash", "tokenHash"], "")
      )
    ) {
      return { ok: false, code: "token-unrecoverable" };
    }
    record.recoverable = true;
    record.redirectUrl = buildQrRedirectUrl(token);
    return { ok: true, record };
  } catch (error) {
    return {
      ok: false,
      code:
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "configuration-missing"
          ? "configuration-missing"
          : "token-unrecoverable"
    };
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
}): Promise<OwnerQrCanonicalRead | OwnerQrRequestError | QrSupabaseFailure> {
  const admin = getSupabaseAdminClient();
  if (!admin.ok) return canonicalConfigFailure("canonical-read", admin.reason);

  if (!isDefaultPurposeKey(args.purposeKey)) {
    return { ok: false, code: "invalid-input", error: "Purpose QR invalide." };
  }
  const purposeKey = "default";
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
  if (!recovered.ok && recovered.code === "configuration-missing") {
    return canonicalConfigFailure(
      "canonical-read",
      "QR token vault configuration is unavailable."
    );
  }
  return {
    found: true,
    recoverable: recovered.ok,
    record: recovered.ok ? recovered.record : mapped
  };
}

export async function getOrCreateOwnerQrCode(
  args: CreateOwnerQrCodeArgs & { purposeKey: string }
): Promise<CanonicalQrMutationResult | QrSupabaseFailure | OwnerQrRequestError> {
  const targetKind =
    args.targetKind ?? inferOwnerQrTargetKind(args.targetPath ?? "");
  if (!args.restaurantId.trim() || !isDefaultPurposeKey(args.purposeKey)) {
    return {
      ok: false,
      code: "invalid-input",
      error: "Restaurant ou purpose QR invalide."
    };
  }
  const purposeKey = "default";
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
  const { data: restaurant, error: restaurantError } = await admin.client
    .from("restaurants")
    .select("id, slug")
    .eq("id", args.restaurantId)
    .maybeSingle();
  const restaurantSlug = getString(
    (restaurant ?? {}) as unknown as AnyRow,
    ["slug"],
    ""
  );
  if (restaurantError || !restaurant || !restaurantSlug) {
    if (restaurantError && !isSupabaseMiss(restaurantError)) {
      const incidentId = logQrSupabaseIncident({
        operation: "canonical-get-or-create",
        code: "QR_CANONICAL_RPC_FAILED",
        supabaseError: restaurantError
      });
      return buildQrSupabaseFailure({
        code: "QR_CANONICAL_RPC_FAILED",
        incidentId
      });
    }
    return {
      ok: false,
      code: "not-found",
      error: "Restaurant introuvable ou sans slug public."
    };
  }
  const targetPath =
    targetKind === "admin" ? "/admin" : buildPublicMenuPath(restaurantSlug);
  if (!isOwnerQrTargetPathAllowed(targetKind, targetPath)) {
    return {
      ok: false,
      code: "invalid-input",
      error: "Destination QR serveur invalide."
    };
  }
  const id = randomUUID();
  const token = generateQrToken();
  const tokenHash = hashQrTokenForStorage(token);
  const binding = {
    qrId: id,
    restaurantId: args.restaurantId,
    targetKind,
    purposeKey,
    tokenHash
  };
  let envelope;
  try {
    const { encryptQrToken } = await import("@/lib/owner/qrTokenVault");
    envelope = encryptQrToken(token, binding);
  } catch (error) {
    return canonicalConfigFailure(
      "canonical-get-or-create",
      error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "configuration-missing"
        ? "QR token vault configuration is unavailable."
        : "QR token vault encryption failed."
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
      p_token_hash: tokenHash,
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

  const rpcRow = firstRpcRow(data);
  const winnerId = rpcRow ? getString(rpcRow, ["id"], "") : "";
  const { data: winnerRow, error: winnerReadError } = winnerId
    ? await admin.client
        .from(QR_TABLE)
        .select(CANONICAL_COLUMNS)
        .eq("id", winnerId)
        .eq("is_canonical", true)
        .maybeSingle()
    : { data: null, error: null };
  if (winnerReadError) {
    const incidentId = logQrSupabaseIncident({
      operation: "canonical-get-or-create",
      code: "QR_CANONICAL_RPC_FAILED",
      supabaseError: winnerReadError
    });
    return buildQrSupabaseFailure({ code: "QR_CANONICAL_RPC_FAILED", incidentId });
  }
  const recovered = winnerRow
    ? await recoverCanonicalRecord({
        ...(winnerRow as unknown as AnyRow),
        is_canonical: true
      })
    : null;
  if (!recovered) return CANONICAL_UNRECOVERABLE;
  if (!recovered.ok) {
    return recovered.code === "configuration-missing"
      ? canonicalConfigFailure(
          "canonical-get-or-create",
          "QR token vault configuration is unavailable."
        )
      : CANONICAL_UNRECOVERABLE;
  }
  return {
    ok: true,
    created: rpcRow?.created === true,
    persisted: true,
    record: recovered.record
  };
}

export async function createOwnerQrCode(
  args: CreateOwnerQrCodeArgs & { purposeKey?: string }
): Promise<QrPersistenceResult> {
  return getOrCreateOwnerQrCode({
    ...args,
    purposeKey: args.purposeKey ?? "default"
  });
}

export async function updateOwnerQrCode(
  id: string,
  patch: { style?: unknown; label?: string; expectedConfigVersion: number }
): Promise<{ ok: true; record: OwnerQrCodeRecord } | OwnerQrCanonicalError | OwnerQrRequestError | QrSupabaseFailure> {
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
  if (readError && !isSupabaseMiss(readError)) {
    const incidentId = logQrSupabaseIncident({
      operation: "update",
      code: "QR_UPDATE_FAILED",
      supabaseError: readError
    });
    return buildQrSupabaseFailure({ code: "QR_UPDATE_FAILED", incidentId });
  }
  if (!currentRow) {
    return { ok: false, code: "not-found", error: "QR canonique introuvable." };
  }
  const current = await recoverCanonicalRecord(
    currentRow as unknown as AnyRow
  );
  if (!current.ok) {
    return current.code === "configuration-missing"
      ? canonicalConfigFailure(
          "canonical-read",
          "QR token vault configuration is unavailable."
        )
      : CANONICAL_UNRECOVERABLE;
  }
  if (current.record.configVersion !== patch.expectedConfigVersion) {
    return {
      ok: false,
      code: "config-version-conflict",
      error: "Le QR a ete modifie ailleurs. Rechargez avant de reessayer.",
      current: mapInventoryRow(currentRow as unknown as AnyRow)
    };
  }

  const update: Record<string, unknown> = {};
  if (patch.style !== undefined) {
    update.style_json = normalizeOwnerQrStyle(patch.style);
  }
  if (typeof patch.label === "string" && patch.label.trim()) {
    update.label = patch.label.trim().slice(0, 120);
  }
  if (Object.keys(update).length === 0) {
    return {
      ok: false,
      code: "invalid-input",
      error: "Une etiquette ou un style non vide est requis."
    };
  }
  if (
    !Number.isSafeInteger(patch.expectedConfigVersion) ||
    patch.expectedConfigVersion < 1
  ) {
    return {
      ok: false,
      code: "invalid-input",
      error: "Version de configuration invalide."
    };
  }

  const { data, error } = await admin.client
    .from(QR_TABLE)
    .update({
      ...update,
      config_version: patch.expectedConfigVersion + 1
    })
    .eq("id", id)
    .eq("is_canonical", true)
    .eq("config_version", patch.expectedConfigVersion)
    .select(CANONICAL_COLUMNS)
    .maybeSingle();

  if (error && /config[_ -]version[_ -]conflict/i.test(
    `${error.message ?? ""}\n${error.details ?? ""}`
  )) {
    return readSafeConfigVersionConflict(admin.client, id);
  }
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
  const updatedRow = data as unknown as AnyRow | null;
  if ((error && isSupabaseMiss(error)) || (!error && !updatedRow)) {
    return readSafeConfigVersionConflict(admin.client, id);
  }
  if (error || !updatedRow) {
    return {
      ok: false,
      code: "not-found",
      error: "QR introuvable ou non modifiable."
    };
  }

  const record = await recoverCanonicalRecord({
    ...updatedRow,
    is_canonical: true
  });
  if (!record.ok) {
    return record.code === "configuration-missing"
      ? canonicalConfigFailure(
          "canonical-read",
          "QR token vault configuration is unavailable."
        )
      : CANONICAL_UNRECOVERABLE;
  }
  return { ok: true, record: record.record };
}

export async function retargetOwnerQrCode(
  id: string,
  args: { expectedConfigVersion: number }
): Promise<
  | { ok: true; changed: boolean; record: OwnerQrCodeRecord }
  | OwnerQrCanonicalError
  | OwnerQrRequestError
  | QrSupabaseFailure
> {
  if (
    !id ||
    !Number.isSafeInteger(args.expectedConfigVersion) ||
    args.expectedConfigVersion < 1
  ) {
    return {
      ok: false,
      code: "invalid-input",
      error: "Version de configuration invalide."
    };
  }
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
  if (readError && !isSupabaseMiss(readError)) {
    const incidentId = logQrSupabaseIncident({
      operation: "update",
      code: "QR_UPDATE_FAILED",
      supabaseError: readError
    });
    return buildQrSupabaseFailure({ code: "QR_UPDATE_FAILED", incidentId });
  }
  if (!currentRow) {
    return { ok: false, code: "not-found", error: "QR canonique introuvable." };
  }
  const currentData = currentRow as unknown as AnyRow;
  const current = await recoverCanonicalRecord(currentData);
  if (!current.ok) {
    return current.code === "configuration-missing"
      ? canonicalConfigFailure(
          "canonical-read",
          "QR token vault configuration is unavailable."
        )
      : CANONICAL_UNRECOVERABLE;
  }
  if (current.record.configVersion !== args.expectedConfigVersion) {
    return {
      ok: false,
      code: "config-version-conflict",
      error: "Le QR a ete modifie ailleurs. Rechargez avant de reessayer.",
      current: mapInventoryRow(currentData)
    };
  }
  const { data: restaurant, error: restaurantError } = await admin.client
    .from("restaurants")
    .select("id, slug")
    .eq("id", current.record.restaurantId)
    .maybeSingle();
  const restaurantSlug = getString(
    (restaurant ?? {}) as unknown as AnyRow,
    ["slug"],
    ""
  );
  if (restaurantError || !restaurant || !restaurantSlug) {
    if (restaurantError && !isSupabaseMiss(restaurantError)) {
      const incidentId = logQrSupabaseIncident({
        operation: "update",
        code: "QR_UPDATE_FAILED",
        supabaseError: restaurantError
      });
      return buildQrSupabaseFailure({ code: "QR_UPDATE_FAILED", incidentId });
    }
    return { ok: false, code: "not-found", error: "Restaurant introuvable." };
  }
  const targetPath =
    current.record.targetKind === "admin"
      ? "/admin"
      : buildPublicMenuPath(restaurantSlug);
  if (targetPath === current.record.targetPath) {
    return { ok: true, changed: false, record: current.record };
  }
  const { data, error } = await admin.client
    .from(QR_TABLE)
    .update({
      target_path: targetPath,
      config_version: args.expectedConfigVersion + 1
    })
    .eq("id", id)
    .eq("is_canonical", true)
    .eq("config_version", args.expectedConfigVersion)
    .select(CANONICAL_COLUMNS)
    .maybeSingle();
  if (error && /config[_ -]version[_ -]conflict/i.test(
    `${error.message ?? ""}\n${error.details ?? ""}`
  )) {
    return readSafeConfigVersionConflict(admin.client, id);
  }
  if (error && !isSupabaseMiss(error)) {
    const incidentId = logQrSupabaseIncident({
      operation: "update",
      code: "QR_UPDATE_FAILED",
      supabaseError: error
    });
    return buildQrSupabaseFailure({ code: "QR_UPDATE_FAILED", incidentId });
  }
  if ((error && isSupabaseMiss(error)) || !data) {
    return readSafeConfigVersionConflict(admin.client, id);
  }
  const recovered = await recoverCanonicalRecord(data as unknown as AnyRow);
  if (!recovered.ok) return CANONICAL_UNRECOVERABLE;
  return { ok: true, changed: true, record: recovered.record };
}

async function recoverCompletedRotation(
  client: SupabaseClient,
  args: {
    previousId: string;
    idempotencyKey: string;
    previousDisposition: OwnerQrRotationDisposition;
    expectedConfigVersion: number;
  }
): Promise<
  CanonicalQrRotationResult | OwnerQrRequestError | QrSupabaseFailure | null
> {
  const { data: event, error: eventError } = await client
    .from("qr_code_lifecycle_events")
    .select(
      "operation_id, qr_code_id, successor_qr_code_id, action, disposition, previous_config_version"
    )
    .eq("operation_id", args.idempotencyKey)
    .maybeSingle();
  if (eventError && !isSupabaseMiss(eventError)) {
    const incidentId = logQrSupabaseIncident({
      operation: "canonical-rotate",
      code: "QR_CANONICAL_ROTATE_FAILED",
      supabaseError: eventError
    });
    return buildQrSupabaseFailure({
      code: "QR_CANONICAL_ROTATE_FAILED",
      incidentId
    });
  }
  if (!event) return null;
  const eventRow = event as unknown as AnyRow;
  if (
    getString(eventRow, ["action"], "") !== "rotate" ||
    getString(eventRow, ["qr_code_id"], "") !== args.previousId ||
    getString(eventRow, ["disposition"], "") !== args.previousDisposition ||
    getNumber(eventRow, ["previous_config_version"], 0) !==
      args.expectedConfigVersion
  ) {
    return {
      ok: false,
      code: "idempotency-conflict",
      error: "Cette cle d'idempotence a deja ete utilisee autrement."
    };
  }
  const successorId = getString(eventRow, ["successor_qr_code_id"], "");
  const [previousRead, currentRead] = await Promise.all([
    client.from(QR_TABLE).select(CANONICAL_COLUMNS).eq("id", args.previousId).maybeSingle(),
    client.from(QR_TABLE).select(CANONICAL_COLUMNS).eq("id", successorId).maybeSingle()
  ]);
  if (previousRead.error || currentRead.error || !previousRead.data || !currentRead.data) {
    const incidentId = logQrSupabaseIncident({
      operation: "canonical-rotate",
      code: "QR_CANONICAL_ROTATE_FAILED",
      supabaseError:
        previousRead.error ??
        currentRead.error ?? { message: "Idempotent rotation rows unavailable." }
    });
    return buildQrSupabaseFailure({
      code: "QR_CANONICAL_ROTATE_FAILED",
      incidentId
    });
  }
  const currentData = currentRead.data as unknown as AnyRow;
  if (
    currentData.is_canonical !== true ||
    getString(currentData, ["status"], "") !== "active" ||
    getNumber(currentData, ["config_version"], 0) !==
      args.expectedConfigVersion + 1 ||
    getString(
      currentData,
      ["supersedes_qr_code_id", "supersedesQrCodeId"],
      ""
    ) !== args.previousId
  ) {
    return {
      ok: false,
      code: "config-version-conflict",
      error: "Le resultat de cette rotation a ete remplace. Rechargez avant de reessayer."
    };
  }
  const recovered = await recoverCanonicalRecord({
    ...currentData
  });
  if (!recovered.ok) return CANONICAL_UNRECOVERABLE;
  const previous = mapQrRow(previousRead.data as unknown as AnyRow);
  previous.recoverable = false;
  delete previous.redirectUrl;
  return { ok: true, previous, current: recovered.record };
}

export async function rotateOwnerQrCode(
  id: string,
  args: {
    confirmed: true;
    idempotencyKey: string;
    previousDisposition: OwnerQrRotationDisposition;
    expectedConfigVersion: number;
  }
): Promise<CanonicalQrRotationResult | OwnerQrRequestError | QrSupabaseFailure> {
  if (
    args.confirmed !== true ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      args.idempotencyKey
    ) ||
    !["keep-active", "pause", "revoke"].includes(
      args.previousDisposition
    ) ||
    !Number.isSafeInteger(args.expectedConfigVersion) ||
    args.expectedConfigVersion < 1
  ) {
    return {
      ok: false,
      code: "invalid-input",
      error: "Confirmation de rotation requise."
    };
  }
  const admin = getSupabaseAdminClient();
  if (!admin.ok) return canonicalConfigFailure("canonical-rotate", admin.reason);

  const completed = await recoverCompletedRotation(admin.client, {
    previousId: id,
    idempotencyKey: args.idempotencyKey,
    previousDisposition: args.previousDisposition,
    expectedConfigVersion: args.expectedConfigVersion
  });
  if (completed) return completed;

  const { data: previousRow, error: readError } = await admin.client
    .from(QR_TABLE)
    .select(CANONICAL_COLUMNS)
    .eq("id", id)
    .eq("is_canonical", true)
    .maybeSingle();
  if (readError && !isSupabaseMiss(readError)) {
    const incidentId = logQrSupabaseIncident({
      operation: "canonical-rotate",
      code: "QR_CANONICAL_ROTATE_FAILED",
      supabaseError: readError
    });
    return buildQrSupabaseFailure({
      code: "QR_CANONICAL_ROTATE_FAILED",
      incidentId
    });
  }
  if (!previousRow) {
    return { ok: false, code: "not-found", error: "QR canonique introuvable." };
  }

  const previousData = previousRow as unknown as AnyRow;
  const previous = mapQrRow(previousData);
  if (previous.configVersion !== args.expectedConfigVersion) {
    return {
      ok: false,
      code: "config-version-conflict",
      error: "Le QR a ete modifie ailleurs. Rechargez avant de reessayer."
    };
  }
  const verifiedPrevious = await recoverCanonicalRecord(previousData);
  if (!verifiedPrevious.ok) {
    return verifiedPrevious.code === "configuration-missing"
      ? canonicalConfigFailure(
          "canonical-rotate",
          "QR token vault configuration is unavailable."
        )
      : CANONICAL_UNRECOVERABLE;
  }
  const { data: restaurant, error: restaurantError } = await admin.client
    .from("restaurants")
    .select("id, slug")
    .eq("id", previous.restaurantId)
    .maybeSingle();
  const restaurantSlug = getString(
    (restaurant ?? {}) as unknown as AnyRow,
    ["slug"],
    ""
  );
  if (restaurantError || !restaurant || !restaurantSlug) {
    return restaurantError && !isSupabaseMiss(restaurantError)
      ? canonicalConfigFailure(
          "canonical-rotate",
          "Restaurant target lookup failed."
        )
      : { ok: false, code: "not-found", error: "Restaurant introuvable." };
  }
  const targetPath =
    previous.targetKind === "admin"
      ? "/admin"
      : buildPublicMenuPath(restaurantSlug);
  const newId = randomUUID();
  const token = generateQrToken();
  const tokenHash = hashQrTokenForStorage(token);
  const binding = {
    qrId: newId,
    restaurantId: previous.restaurantId,
    targetKind: previous.targetKind,
    purposeKey: "default",
    tokenHash
  };
  let envelope;
  try {
    const { encryptQrToken } = await import("@/lib/owner/qrTokenVault");
    envelope = encryptQrToken(token, binding);
  } catch (error) {
    return canonicalConfigFailure(
      "canonical-rotate",
      error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "configuration-missing"
        ? "QR token vault configuration is unavailable."
        : "QR token vault encryption failed."
    );
  }

  const { data, error } = await admin.client.rpc("owner_rotate_canonical_qr", {
    p_previous_id: id,
    p_new_id: newId,
    p_rotation_request_id: args.idempotencyKey,
    p_expected_config_version: args.expectedConfigVersion,
    p_disposition: args.previousDisposition,
    p_restaurant_id: previous.restaurantId,
    p_target_kind: previous.targetKind,
    p_purpose_key: "default",
    p_label: previous.label,
    p_target_path: targetPath,
    p_token_hash: tokenHash,
    p_token_preview: tokenPreview(token),
    p_token_ciphertext: envelope.ciphertext,
    p_token_nonce: envelope.nonce,
    p_token_key_version: envelope.keyVersion,
    p_style_json: previous.style,
    p_confirm: true
  });
  if (error) {
    const completedAfterRace = await recoverCompletedRotation(admin.client, {
      previousId: id,
      idempotencyKey: args.idempotencyKey,
      previousDisposition: args.previousDisposition,
      expectedConfigVersion: args.expectedConfigVersion
    });
    if (completedAfterRace) return completedAfterRace;
  }
  const errorText = `${error?.message ?? ""}\n${error?.details ?? ""}`;
  if (error && (error.code === "P0002" || /canonical QR.*not found/i.test(errorText))) {
    return classifyRotationCanonicalMiss(admin.client, id);
  }
  if (error && (error.code === "40001" || /stale[\s\S]*config_version/i.test(
    errorText
  ))) {
    return {
      ok: false,
      code: "config-version-conflict",
      error: "Le QR a ete modifie ailleurs. Rechargez avant de reessayer."
    };
  }
  if (error && /(?:idempotenc(?:y|e)|request id)[\s\S]*(?:reused|conflict)/i.test(
    errorText
  )) {
    return {
      ok: false,
      code: "idempotency-conflict",
      error: "Cet identifiant de requete a deja ete utilise autrement."
    };
  }
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

  const rpcRows = Array.isArray(data) ? data : data ? [data] : [];
  const fullCurrentRow = rpcRows.find((row) => {
    const candidate = row as unknown as AnyRow;
    return (
      getString(candidate, ["id"], "") === newId &&
      Boolean(getString(candidate, ["token_ciphertext"], ""))
    );
  }) as AnyRow | undefined;
  if (fullCurrentRow) {
    const current = await recoverCanonicalRecord({
      ...fullCurrentRow,
      is_canonical: true
    });
    if (!current.ok) return CANONICAL_UNRECOVERABLE;
    const previousResult = rpcRows.find(
      (row) => getString(row as unknown as AnyRow, ["id"], "") === id
    );
    const previousResponse = mapQrRow(
      (previousResult as unknown as AnyRow | undefined) ?? previousData
    );
    previousResponse.isCanonical = false;
    previousResponse.recoverable = false;
    delete previousResponse.redirectUrl;
    return { ok: true, previous: previousResponse, current: current.record };
  }

  const completedResult = await recoverCompletedRotation(admin.client, {
    previousId: id,
    idempotencyKey: args.idempotencyKey,
    previousDisposition: args.previousDisposition,
    expectedConfigVersion: args.expectedConfigVersion
  });
  return completedResult ?? CANONICAL_UNRECOVERABLE;
}

function mapInventoryRow(row: AnyRow): OwnerQrInventoryRecord {
  const record = mapQrRow(row);
  return {
    id: record.id,
    restaurantId: record.restaurantId,
    label: record.label,
    targetKind: record.targetKind,
    purposeKey: record.purposeKey,
    isCanonical: record.isCanonical,
    targetPath: record.targetPath,
    status: record.status,
    configVersion: record.configVersion,
    scanCount: record.scanCount,
    lastScannedAt: record.lastScannedAt,
    style: record.style,
    persisted: record.persisted,
    supersedesQrCodeId:
      getString(row, ["supersedes_qr_code_id", "supersedesQrCodeId"], "") ||
      null,
    rotatedAt: getString(row, ["rotated_at", "rotatedAt"], "") || null,
    revokedAt: getString(row, ["revoked_at", "revokedAt"], "") || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

const INVENTORY_COLUMNS = [
  "id",
  "restaurant_id",
  "label",
  "target_kind",
  "purpose_key",
  "is_canonical",
  "target_path",
  "status",
  "scan_count",
  "last_scanned_at",
  "style_json",
  "config_version",
  "supersedes_qr_code_id",
  "rotated_at",
  "revoked_at",
  "created_at",
  "updated_at"
].join(", ");

async function readSafeConfigVersionConflict(
  client: SupabaseClient,
  id: string
): Promise<OwnerQrRequestError | QrSupabaseFailure> {
  const { data, error } = await client
    .from(QR_TABLE)
    .select(INVENTORY_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    const incidentId = logQrSupabaseIncident({
      operation: "update",
      code: "QR_UPDATE_FAILED",
      supabaseError: error
    });
    return buildQrSupabaseFailure({ code: "QR_UPDATE_FAILED", incidentId });
  }
  if (!data) {
    return { ok: false, code: "not-found", error: "QR introuvable." };
  }
  return {
    ok: false,
    code: "config-version-conflict",
    error: "Le QR a ete modifie ailleurs. Rechargez avant de reessayer.",
    current: mapInventoryRow(data as unknown as AnyRow)
  };
}

async function classifyRotationCanonicalMiss(
  client: SupabaseClient,
  id: string
): Promise<OwnerQrRequestError | QrSupabaseFailure> {
  const { data, error } = await client
    .from(QR_TABLE)
    .select(INVENTORY_COLUMNS)
    .eq("id", id)
    .maybeSingle();
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
  if (!data) {
    return { ok: false, code: "not-found", error: "QR introuvable." };
  }
  return {
    ok: false,
    code: "config-version-conflict",
    error: "Le QR a ete modifie ailleurs. Rechargez avant de reessayer.",
    current: mapInventoryRow(data as unknown as AnyRow)
  };
}

async function classifyLifecycleCanonicalMiss(
  client: SupabaseClient,
  id: string,
  expectedConfigVersion: number
): Promise<OwnerQrRequestError | QrSupabaseFailure> {
  const { data, error } = await client
    .from(QR_TABLE)
    .select(INVENTORY_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    const incidentId = logQrSupabaseIncident({
      operation: "lifecycle",
      code: "QR_LIFECYCLE_FAILED",
      supabaseError: error
    });
    return buildQrSupabaseFailure({ code: "QR_LIFECYCLE_FAILED", incidentId });
  }
  if (!data) {
    return { ok: false, code: "not-found", error: "QR introuvable." };
  }
  const current = mapInventoryRow(data as unknown as AnyRow);
  if (current.configVersion !== expectedConfigVersion) {
    return {
      ok: false,
      code: "config-version-conflict",
      error: "Le QR a ete modifie ailleurs. Rechargez avant de reessayer.",
      current
    };
  }
  return {
    ok: false,
    code: "not-found",
    error: "Ce QR historique n'est plus canonique."
  };
}

export async function listOwnerQrInventory(args: {
  restaurantId: string;
}): Promise<
  | { ok: true; records: OwnerQrInventoryRecord[] }
  | OwnerQrRequestError
  | QrSupabaseFailure
> {
  if (!args.restaurantId.trim()) {
    return { ok: false, code: "invalid-input", error: "Restaurant requis." };
  }
  const admin = getSupabaseAdminClient();
  if (!admin.ok) return canonicalConfigFailure("canonical-read", admin.reason);

  const { data, error } = await admin.client
    .from(QR_TABLE)
    .select(INVENTORY_COLUMNS)
    .eq("restaurant_id", args.restaurantId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) {
    const incidentId = logQrSupabaseIncident({
      operation: "inventory",
      code: "QR_INVENTORY_FAILED",
      supabaseError: error
    });
    return buildQrSupabaseFailure({ code: "QR_INVENTORY_FAILED", incidentId });
  }
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return {
    ok: true,
    records: rows.map((row) => mapInventoryRow(row as unknown as AnyRow))
  };
}

export async function transitionOwnerQrLifecycle(
  id: string,
  args: {
    action: OwnerQrLifecycleAction;
    expectedConfigVersion: number;
    idempotencyKey: string;
  }
): Promise<
  | { ok: true; record: OwnerQrInventoryRecord }
  | OwnerQrRequestError
  | QrSupabaseFailure
> {
  if (
    !id ||
    !["pause", "resume", "archive", "revoke"].includes(args.action) ||
    !Number.isSafeInteger(args.expectedConfigVersion) ||
    args.expectedConfigVersion < 1 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      args.idempotencyKey
    )
  ) {
    return {
      ok: false,
      code: "invalid-input",
      error: "Mutation de cycle de vie invalide."
    };
  }
  const admin = getSupabaseAdminClient();
  if (!admin.ok) return canonicalConfigFailure("canonical-read", admin.reason);
  const { data: currentRow, error: currentError } = await admin.client
    .from(QR_TABLE)
    .select(INVENTORY_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (currentError && !isSupabaseMiss(currentError)) {
    const incidentId = logQrSupabaseIncident({
      operation: "lifecycle",
      code: "QR_LIFECYCLE_FAILED",
      supabaseError: currentError
    });
    return buildQrSupabaseFailure({ code: "QR_LIFECYCLE_FAILED", incidentId });
  }
  if (!currentRow) {
    return { ok: false, code: "not-found", error: "QR canonique introuvable." };
  }
  const current = mapInventoryRow(currentRow as unknown as AnyRow);
  const rpcName =
    args.action === "archive"
      ? "owner_clear_canonical_qr"
      : "owner_set_canonical_qr_lifecycle";
  const rpcArgs =
    args.action === "archive"
      ? {
          p_qr_code_id: id,
          p_restaurant_id: current.restaurantId,
          p_disposition: "archive",
          p_expected_config_version: args.expectedConfigVersion,
          p_operation_id: args.idempotencyKey
        }
      : {
          p_qr_code_id: id,
          p_restaurant_id: current.restaurantId,
          p_action: args.action,
          p_expected_config_version: args.expectedConfigVersion,
          p_operation_id: args.idempotencyKey
        };
  const { data, error } = await admin.client.rpc(rpcName, rpcArgs);
  const errorText = `${error?.message ?? ""}\n${error?.details ?? ""}`;
  if (error && (error.code === "P0002" || /canonical QR.*not found/i.test(errorText))) {
    return classifyLifecycleCanonicalMiss(
      admin.client,
      id,
      args.expectedConfigVersion
    );
  }
  if (error && (error.code === "40001" || /stale[\s\S]*config_version/i.test(errorText))) {
    return {
      ok: false,
      code: "config-version-conflict",
      error: "Le QR a ete modifie ailleurs. Rechargez avant de reessayer."
    };
  }
  if (error && /idempotency key was reused/i.test(errorText)) {
    return {
      ok: false,
      code: "idempotency-conflict",
      error: "Cette cle d'idempotence a deja ete utilisee autrement."
    };
  }
  if (error && /invalid[_ -]lifecycle[_ -]transition/i.test(errorText)) {
    return {
      ok: false,
      code: "invalid-input",
      error: "Transition de cycle de vie non autorisee."
    };
  }
  if (error) {
    const incidentId = logQrSupabaseIncident({
      operation: "lifecycle",
      code: "QR_LIFECYCLE_FAILED",
      supabaseError: error
    });
    return buildQrSupabaseFailure({ code: "QR_LIFECYCLE_FAILED", incidentId });
  }
  const row = firstRpcRow(data);
  if (!row) return { ok: false, code: "not-found", error: "QR introuvable." };
  const { data: inventoryRow, error: inventoryError } = await admin.client
    .from(QR_TABLE)
    .select(INVENTORY_COLUMNS)
    .eq("id", id)
    .eq("restaurant_id", current.restaurantId)
    .maybeSingle();
  if (inventoryError || !inventoryRow) {
    const incidentId = logQrSupabaseIncident({
      operation: "lifecycle",
      code: "QR_LIFECYCLE_FAILED",
      supabaseError: inventoryError ?? { message: "Lifecycle result unavailable." }
    });
    return buildQrSupabaseFailure({ code: "QR_LIFECYCLE_FAILED", incidentId });
  }
  const inventoryRecord = mapInventoryRow(inventoryRow as unknown as AnyRow);
  if (getString(row, ["result_status"], "") === "idempotent") {
    const expectedStatus =
      args.action === "pause"
        ? "paused"
        : args.action === "resume"
          ? "active"
          : args.action === "archive"
            ? "archived"
            : "revoked";
    const shouldRemainCanonical =
      args.action === "pause" || args.action === "resume";
    if (
      inventoryRecord.configVersion !== args.expectedConfigVersion + 1 ||
      inventoryRecord.status !== expectedStatus ||
      inventoryRecord.isCanonical !== shouldRemainCanonical
    ) {
      return {
        ok: false,
        code: "config-version-conflict",
        error: "Le resultat de cette operation a ete remplace. Rechargez avant de reessayer.",
        current: inventoryRecord
      };
    }
  }
  return { ok: true, record: inventoryRecord };
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
  for (const tokenHash of tokenHashes) {
    const { data, error } = await client.rpc("resolve_qr_code_scan_metadata", {
      p_token_hash: tokenHash
    });
    if (error) {
      logQrSupabaseIncident({
        operation: "resolve-metadata",
        code: "QR_RESOLVE_METADATA_FAILED",
        supabaseError: error
      });
      return { ok: false };
    }
    const row = firstRpcRow(data);
    if (!row) continue;
    return resolutionFromRow(row);
  }
  return { ok: false };
}
