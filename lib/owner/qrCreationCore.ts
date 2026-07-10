import {
  buildQrRedirectPath,
  inferOwnerQrTargetKind
} from "./menuUrlCore.ts";
import { DEFAULT_OWNER_QR_STYLE, normalizeOwnerQrStyle } from "./qrStyle.ts";
import type {
  CreateOwnerQrCodeResult,
  OwnerQrCodeRecord,
  OwnerQrTargetKind
} from "./types.ts";

export type CreateOwnerQrCodeArgs = {
  restaurantId: string;
  label: string;
  targetPath: string;
  targetKind?: OwnerQrTargetKind;
  style?: unknown;
};

type CreationDependencies = {
  persistQrCode: (args: CreateOwnerQrCodeArgs) => Promise<QrPersistenceResult>;
  createSignedMenuFallback: (
    args: CreateOwnerQrCodeArgs
  ) => string | CreateOwnerQrCodeResult;
};

export type QrPersistenceResult =
  | CreateOwnerQrCodeResult
  | QrSupabaseFailure;

export type QrSupabaseFailureCode =
  | "QR_CREATE_CONFIG_UNAVAILABLE"
  | "QR_CREATE_INSERT_FAILED"
  | "QR_UPDATE_CONFIG_UNAVAILABLE"
  | "QR_UPDATE_FAILED";

export type QrSupabaseFailure = {
  ok: false;
  error: string;
  code: QrSupabaseFailureCode;
  incidentId: string;
  fallbackEligible?: true;
};

const QR_SUPABASE_FAILURE_MESSAGES: Record<QrSupabaseFailureCode, string> = {
  QR_CREATE_CONFIG_UNAVAILABLE:
    "Le stockage persistant requis pour ce QR n'est pas disponible.",
  QR_CREATE_INSERT_FAILED: "Le QR n'a pas pu etre enregistre.",
  QR_UPDATE_CONFIG_UNAVAILABLE:
    "Le stockage persistant requis pour modifier ce QR n'est pas disponible.",
  QR_UPDATE_FAILED: "Le QR n'a pas pu etre modifie."
};

export function buildQrSupabaseFailure(args: {
  code: QrSupabaseFailureCode;
  incidentId: string;
  fallbackEligible?: true;
}): QrSupabaseFailure {
  return {
    ok: false,
    error: `${QR_SUPABASE_FAILURE_MESSAGES[args.code]} Reference incident : ${args.incidentId}.`,
    code: args.code,
    incidentId: args.incidentId,
    ...(args.fallbackEligible === true ? { fallbackEligible: true as const } : {})
  };
}

export function redactQrIncidentLogText(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  return value
    .replace(/\b(?:p_)?token_hash\b/gi, "[redacted-field]")
    .replace(/\bs1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-token]")
    .replace(/\b[A-Fa-f0-9]{64}\b/g, "[redacted-hash]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted-token]");
}

export async function createOwnerQrCodeWithDependencies(
  args: CreateOwnerQrCodeArgs,
  dependencies: CreationDependencies
): Promise<QrPersistenceResult> {
  const targetKind = args.targetKind ?? inferOwnerQrTargetKind(args.targetPath);
  if (targetKind === "admin" && !args.restaurantId.trim()) {
    return {
      ok: false,
      error: "Un restaurant est requis pour creer un QR admin."
    };
  }

  const persisted = await dependencies.persistQrCode(args);
  const fallbackEligible =
    !persisted.ok &&
    "fallbackEligible" in persisted &&
    persisted.fallbackEligible === true;
  if (persisted.ok || targetKind !== "menu" || !fallbackEligible) return persisted;

  const fallback = dependencies.createSignedMenuFallback(args);
  if (typeof fallback !== "string") return fallback;

  const now = new Date().toISOString();
  const style = args.style ? normalizeOwnerQrStyle(args.style) : DEFAULT_OWNER_QR_STYLE;
  const record: OwnerQrCodeRecord = {
    id: `local-${fallback.slice(0, 6)}`,
    restaurantId: args.restaurantId,
    label: args.label,
    targetKind: "menu",
    tokenPreview: `${fallback.slice(0, 6)}...`,
    targetPath: args.targetPath,
    redirectUrl: buildQrRedirectPath(fallback),
    status: "active",
    scanCount: 0,
    lastScannedAt: null,
    style,
    persisted: false,
    createdAt: now,
    updatedAt: now
  };
  return { ok: true, record, token: fallback, persisted: false };
}
