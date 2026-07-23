import { isCanonicalUuid } from "../owner/storageSafeIdentifier.ts";

export const UNIQUE_MENU_DESIGN_STATUS_VALUES = [
  "pending",
  "draft",
  "ready",
  "published",
  "archived"
] as const;

export type UniqueMenuDesignStatus =
  (typeof UNIQUE_MENU_DESIGN_STATUS_VALUES)[number];

export type UniqueMenuDesign = {
  mode: "unique";
  designId: string;
  status: UniqueMenuDesignStatus;
  rendererKey: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export const UNIQUE_DESIGN_VERSION_MIN = 1;
export const UNIQUE_DESIGN_VERSION_MAX = 9999;
export const RENDERER_KEY_MAX_LENGTH = 64;
export const RENDERER_KEY_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

const UNSAFE_KEY_PATTERN =
  /(^__proto__$|^constructor$|^prototype$|secret|password|token|bearer|service[_-]?role|api[_-]?key|signature)/i;
const UNSAFE_VALUE_PATTERN =
  /(sk_live_|sk_test_|service_role|bearer\s+[a-z0-9._-]{12,}|eyJ[a-z0-9_-]{12,})/i;
const ISO_TIMESTAMP_MAX = 40;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function includesValue<T extends readonly string[]>(
  values: T,
  value: unknown
): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

export function isUniqueMenuDesignStatus(
  value: unknown
): value is UniqueMenuDesignStatus {
  return includesValue(UNIQUE_MENU_DESIGN_STATUS_VALUES, value);
}

export function isSafeRendererKeyCandidate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length < 2 || value.length > RENDERER_KEY_MAX_LENGTH) return false;
  if (!RENDERER_KEY_PATTERN.test(value)) return false;
  if (/[./\\]|^https?:|^\/|^\.\./i.test(value)) return false;
  return true;
}

function cleanIsoTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().slice(0, ISO_TIMESTAMP_MAX);
  if (!trimmed) return fallback;
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return fallback;
  return new Date(parsed).toISOString();
}

function cleanVersion(value: unknown, fallback = 1): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return fallback;
  if (value < UNIQUE_DESIGN_VERSION_MIN || value > UNIQUE_DESIGN_VERSION_MAX) {
    return fallback;
  }
  return value;
}

function hasUnsafeKeys(value: unknown, depth = 0): boolean {
  if (!isRecord(value) || depth > 6) return false;
  for (const [key, nested] of Object.entries(value)) {
    if (UNSAFE_KEY_PATTERN.test(key)) return true;
    if (typeof nested === "string" && UNSAFE_VALUE_PATTERN.test(nested)) {
      return true;
    }
    if (hasUnsafeKeys(nested, depth + 1)) return true;
  }
  return false;
}

export function createPendingUniqueMenuDesign(args?: {
  designId?: string;
  now?: string;
}): UniqueMenuDesign {
  const now = args?.now ?? new Date().toISOString();
  const designId =
    args?.designId && isCanonicalUuid(args.designId)
      ? args.designId
      : crypto.randomUUID();

  return {
    mode: "unique",
    designId,
    status: "pending",
    rendererKey: null,
    version: 1,
    createdAt: now,
    updatedAt: now
  };
}

export function normalizeUniqueMenuDesign(
  input: unknown,
  options?: { now?: string }
): UniqueMenuDesign | null {
  if (input == null) return null;
  if (!isRecord(input)) return null;
  if (hasUnsafeKeys(input)) return null;

  const now = options?.now ?? new Date().toISOString();
  const designId =
    typeof input.designId === "string" ? input.designId.trim() : "";
  if (!isCanonicalUuid(designId)) return null;

  const status = isUniqueMenuDesignStatus(input.status)
    ? input.status
    : "pending";

  let rendererKey: string | null = null;
  if (input.rendererKey != null) {
    if (!isSafeRendererKeyCandidate(input.rendererKey)) return null;
    rendererKey = input.rendererKey;
  }

  if (status === "published" && rendererKey == null) {
    // Invalid published contract — fail closed to pending-like identity for
    // persistence, public routing will still use generic fallback.
    return {
      mode: "unique",
      designId,
      status: "draft",
      rendererKey: null,
      version: cleanVersion(input.version, 1),
      createdAt: cleanIsoTimestamp(input.createdAt, now),
      updatedAt: cleanIsoTimestamp(input.updatedAt, now)
    };
  }

  return {
    mode: "unique",
    designId,
    status,
    rendererKey,
    version: cleanVersion(input.version, 1),
    createdAt: cleanIsoTimestamp(input.createdAt, now),
    updatedAt: cleanIsoTimestamp(input.updatedAt, now)
  };
}

export function validateUniqueMenuDesign(
  input: unknown
): { ok: true; value: UniqueMenuDesign } | { ok: false; error: string } {
  if (input == null) {
    return { ok: false, error: "Identité de design unique manquante." };
  }
  if (!isRecord(input)) {
    return { ok: false, error: "Identité de design unique invalide." };
  }
  if (hasUnsafeKeys(input)) {
    return { ok: false, error: "Identité de design unique non autorisée." };
  }
  if (input.mode !== "unique") {
    return { ok: false, error: "mode de design unique invalide." };
  }
  if (!isCanonicalUuid(input.designId)) {
    return { ok: false, error: "designId unique invalide." };
  }
  if (!isUniqueMenuDesignStatus(input.status)) {
    return { ok: false, error: "Statut de design unique invalide." };
  }
  if (input.rendererKey != null && !isSafeRendererKeyCandidate(input.rendererKey)) {
    return { ok: false, error: "rendererKey unique invalide." };
  }
  if (
    typeof input.version !== "number" ||
    !Number.isInteger(input.version) ||
    input.version < UNIQUE_DESIGN_VERSION_MIN ||
    input.version > UNIQUE_DESIGN_VERSION_MAX
  ) {
    return { ok: false, error: "version de design unique invalide." };
  }
  if (input.status === "published" && input.rendererKey == null) {
    return {
      ok: false,
      error: "Un design unique publié exige un rendererKey enregistré."
    };
  }

  const normalized = normalizeUniqueMenuDesign(input);
  if (!normalized) {
    return { ok: false, error: "Identité de design unique invalide." };
  }
  return { ok: true, value: normalized };
}

export function uniqueMenuDesignOwnerStatusLabel(
  status: UniqueMenuDesignStatus | null | undefined
): string {
  switch (status) {
    case "pending":
      return "À construire";
    case "draft":
      return "En développement";
    case "ready":
      return "Prêt à publier";
    case "published":
      return "Publié";
    case "archived":
      return "Archivé";
    default:
      return "À construire";
  }
}

export function cloneUniqueMenuDesign(
  design: UniqueMenuDesign
): UniqueMenuDesign {
  return {
    mode: "unique",
    designId: design.designId,
    status: design.status,
    rendererKey: design.rendererKey,
    version: design.version,
    createdAt: design.createdAt,
    updatedAt: design.updatedAt
  };
}
