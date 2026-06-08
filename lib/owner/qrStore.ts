import "server-only";

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
  hashQrToken,
  isSignedQrToken,
  tokenPreview,
  verifySignedQrToken
} from "@/lib/owner/qrTokens";
import {
  inferOwnerQrTargetKind,
  isOwnerQrTargetPathAllowed,
  sanitizeOwnerQrTargetPath
} from "@/lib/owner/menuUrlCore";
import type {
  CreateOwnerQrCodeResult,
  OwnerQrCodeRecord,
  OwnerQrCodeStatus,
  OwnerQrTargetKind,
  OwnerQrStyle
} from "@/lib/owner/types";

const QR_TABLE = "qr_codes";

const QR_STATUS_VALUES = new Set<OwnerQrCodeStatus>([
  "active",
  "paused",
  "archived"
]);

function normalizeStatus(value: string): OwnerQrCodeStatus {
  return QR_STATUS_VALUES.has(value as OwnerQrCodeStatus)
    ? (value as OwnerQrCodeStatus)
    : "active";
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
    if (normalizeStatus(getString(row, ["status"], "active")) !== "active") continue;
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
    console.warn("[Vistaire owner] mark restaurant qr_ready failed", error.message);
  }
}

function mapQrRow(row: AnyRow): OwnerQrCodeRecord {
  const id = getString(row, ["id"], "");
  const token = getString(row, ["token_preview", "tokenPreview"], "");
  return {
    id,
    restaurantId: getString(row, ["restaurant_id", "restaurantId"], ""),
    label: getString(row, ["label"], "QR menu"),
    targetKind: inferOwnerQrTargetKind(
      getString(row, ["target_path", "targetPath"], "/")
    ),
    tokenPreview: token,
    targetPath: getString(row, ["target_path", "targetPath"], "/"),
    redirectUrl: "",
    status: normalizeStatus(getString(row, ["status"], "active")),
    scanCount: getNumber(row, ["scan_count", "scanCount"], 0),
    lastScannedAt:
      getString(row, ["last_scanned_at", "lastScannedAt"], "") || null,
    style: parseStyle(row.style_json ?? row.styleJson ?? row.style),
    persisted: true,
    createdAt: getString(row, ["created_at", "createdAt"], ""),
    updatedAt: getString(row, ["updated_at", "updatedAt"], "")
  };
}

export async function createOwnerQrCode(args: {
  restaurantId: string;
  label: string;
  targetPath: string;
  targetKind?: OwnerQrTargetKind;
  style?: unknown;
}): Promise<CreateOwnerQrCodeResult> {
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
  const now = new Date().toISOString();
  const admin = getSupabaseAdminClient();

  // Persistent path: real qr_codes row, raw token returned once, only the hash stored.
  if (admin.ok) {
    const token = generateQrToken();
    const tokenHash = hashQrToken(token);
    const insertRow = {
      restaurant_id: args.restaurantId || null,
      label,
      token_hash: tokenHash,
      token_preview: tokenPreview(token),
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
      console.error("[Vistaire owner] create qr_code failed", error.message);
      return {
        ok: false,
        error:
          "Le QR n'a pas pu etre enregistre. Verifiez que la table qr_codes existe (voir docs/owner-qr-schema.md)."
      };
    }

    const record = mapQrRow((data ?? insertRow) as AnyRow);
    record.style = style;
    record.targetKind = targetKind;
    record.redirectUrl = buildQrRedirectUrl(token);
    await markRestaurantQrReady(admin.client, args.restaurantId);
    return { ok: true, record, token, persisted: true };
  }

  // Dev/build fallback only: stateless signed token, nothing persisted.
  if (!canUseSignedQrFallback()) {
    return {
      ok: false,
      error:
        "Le QR fallback signe requiert VISTAIRE_QR_TOKEN_SECRET en production."
    };
  }
  const token = createSignedQrToken({
    targetPath,
    restaurantId: args.restaurantId
  });
  const record: OwnerQrCodeRecord = {
    id: `local-${tokenPreview(token)}`,
    restaurantId: args.restaurantId,
    label,
    targetKind,
    tokenPreview: tokenPreview(token),
    targetPath,
    redirectUrl: buildQrRedirectUrl(token),
    status: "active",
    scanCount: 0,
    lastScannedAt: null,
    style,
    persisted: false,
    createdAt: now,
    updatedAt: now
  };
  return { ok: true, record, token, persisted: false };
}

export async function updateOwnerQrCode(
  id: string,
  patch: { status?: OwnerQrCodeStatus; style?: unknown; label?: string }
): Promise<{ ok: true; record: OwnerQrCodeRecord } | { ok: false; error: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return {
      ok: false,
      error:
        "Mise a jour QR non persistee : Supabase n'est pas configure (table qr_codes requise)."
    };
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

  if (error || !data) {
    return { ok: false, error: "QR introuvable ou non modifiable." };
  }

  return { ok: true, record: mapQrRow(data as AnyRow) };
}

/**
 * Resolves an incoming /q token to an internal redirect target.
 * Uses resolve_qr_code_scan RPC for atomic scan_count increment when available.
 */
export async function resolveQrToken(
  token: string
): Promise<{ ok: true; targetPath: string } | { ok: false }> {
  if (!token || token.length > 800) return { ok: false };

  const admin = getSupabaseAdminClient();

  if (admin.ok && !isSignedQrToken(token)) {
    const tokenHash = hashQrToken(token);
    const resolved = await resolvePersistedQrToken(admin.client, tokenHash);
    if (resolved.ok) return resolved;
  }

  // Signed fallback token (dev/build, or when DB lookup missed).
  const signed = verifySignedQrToken(token);
  if (signed) {
    const targetPath = sanitizeOwnerQrTargetPath(signed.targetPath);
    if (targetPath && isOwnerQrTargetPathAllowed("menu", targetPath)) {
      return { ok: true, targetPath };
    }
  }

  return { ok: false };
}

async function resolvePersistedQrToken(
  client: SupabaseClient,
  tokenHash: string
): Promise<{ ok: true; targetPath: string } | { ok: false }> {
  const { data, error } = await client.rpc("resolve_qr_code_scan", {
    p_token_hash: tokenHash
  });

  if (!error && data) {
    const targetPath = sanitizeOwnerQrTargetPath(String(data));
    if (targetPath) return { ok: true, targetPath };
    return { ok: false };
  }

  // Fallback when RPC migration is not applied yet: redirect without RMW increment.
  if (error) {
    console.warn("[Vistaire owner] resolve_qr_code_scan RPC unavailable", error.message);
  }

  const { data: row, error: selectError } = await client
    .from(QR_TABLE)
    .select("target_path, status")
    .eq("token_hash", tokenHash)
    .limit(1)
    .maybeSingle();

  if (selectError || !row) return { ok: false };

  const status = normalizeStatus(getString(row as AnyRow, ["status"], "active"));
  if (status !== "active") return { ok: false };

  const targetPath = sanitizeOwnerQrTargetPath(
    getString(row as AnyRow, ["target_path", "targetPath"], "")
  );
  if (!targetPath) return { ok: false };

  return { ok: true, targetPath };
}
