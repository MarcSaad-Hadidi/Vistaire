import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SIGNED_PREFIX = "s1.";

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64url(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

/**
 * Server-only secret used to sign stateless fallback tokens. Never exposed to
 * the client and never returned in API responses.
 */
function getQrSigningSecret(): string {
  return (
    process.env.VISTAIRE_QR_TOKEN_SECRET ||
    process.env.CLERK_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    // Last-resort dev-only constant so /q resolves locally without secrets.
    // Production MUST set VISTAIRE_QR_TOKEN_SECRET (documented in docs/owner-qr-schema.md).
    "vistaire-dev-qr-secret"
  );
}

export function canUseSignedQrFallback(): boolean {
  return (
    Boolean(process.env.VISTAIRE_QR_TOKEN_SECRET) ||
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PHASE === "phase-production-build"
  );
}

/**
 * Generates a non-guessable, URL-safe opaque token using crypto.randomBytes.
 * This is the value encoded into the QR (https://vistaire.ca/q/<token>).
 * Never use Math.random for this.
 */
export function generateQrToken(): string {
  return base64url(randomBytes(24));
}

/**
 * One-way hash stored in qr_codes.token_hash. The raw token is never persisted.
 * Uses HMAC-SHA256 with the server secret when available (acts as a pepper),
 * falling back to SHA-256. Deterministic so /q lookups work.
 */
export function hashQrToken(token: string): string {
  const secret = process.env.VISTAIRE_QR_TOKEN_SECRET;
  if (secret) {
    return createHmac("sha256", secret).update(token).digest("hex");
  }
  return createHash("sha256").update(token).digest("hex");
}

/** Current storage format. Versioning keeps future rotations explicit. */
export function hashQrTokenForStorage(token: string): string {
  return `sha256:${createHash("sha256").update(token).digest("hex")}`;
}

function configuredPreviousLegacySecrets(env: NodeJS.ProcessEnv): string[] {
  return [
    env.VISTAIRE_QR_TOKEN_PREVIOUS_SECRETS,
    env.VISTAIRE_QR_TOKEN_SECRET_PREVIOUS,
    env.VISTAIRE_QR_TOKEN_PREVIOUS_SECRET
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(/[\s,;]+/))
    .map((value) => value.trim())
    .filter(Boolean);
}

/** Bounded lookup candidates for current and grandfathered token hashes. */
export function qrTokenHashCandidates(
  token: string,
  env: NodeJS.ProcessEnv = process.env
): string[] {
  const candidates = [
    hashQrTokenForStorage(token),
    createHash("sha256").update(token).digest("hex")
  ];
  if (env.VISTAIRE_QR_TOKEN_SECRET) {
    candidates.push(
      createHmac("sha256", env.VISTAIRE_QR_TOKEN_SECRET).update(token).digest("hex")
    );
  }
  for (const secret of configuredPreviousLegacySecrets(env).slice(0, 4)) {
    candidates.push(createHmac("sha256", secret).update(token).digest("hex"));
  }
  return [...new Set(candidates)];
}

/** Short, safe preview for the owner UI (never the full token). */
export function tokenPreview(token: string): string {
  return `${token.slice(0, 6)}…`;
}

type SignedQrPayload = {
  t: string; // target path
  r: string; // restaurant id
  v: 1;
};

/**
 * Dev/build fallback only: encodes the target path into a signed, tamper-proof
 * token so /q works without a persisted qr_codes row. Not used when Supabase is
 * configured; the persistent table is the production path.
 */
export function createSignedQrToken(args: {
  targetPath: string;
  restaurantId: string;
}): string {
  if (!canUseSignedQrFallback()) {
    throw new Error("Signed QR fallback requires VISTAIRE_QR_TOKEN_SECRET in production.");
  }
  const payload: SignedQrPayload = {
    t: args.targetPath,
    r: args.restaurantId,
    v: 1
  };
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", getQrSigningSecret())
    .update(body)
    .digest();
  return `${SIGNED_PREFIX}${body}.${base64url(signature)}`;
}

export function isSignedQrToken(token: string): boolean {
  return token.startsWith(SIGNED_PREFIX);
}

export function verifySignedQrToken(
  token: string
): { targetPath: string; restaurantId: string } | null {
  if (!canUseSignedQrFallback()) return null;
  if (!isSignedQrToken(token)) return null;
  const rest = token.slice(SIGNED_PREFIX.length);
  const separator = rest.lastIndexOf(".");
  if (separator <= 0) return null;

  const body = rest.slice(0, separator);
  const providedSignature = rest.slice(separator + 1);

  const expected = createHmac("sha256", getQrSigningSecret())
    .update(body)
    .digest();
  let provided: Buffer;
  try {
    provided = fromBase64url(providedSignature);
  } catch {
    return null;
  }
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(fromBase64url(body).toString("utf8")) as SignedQrPayload;
    if (
      payload.v !== 1 ||
      typeof payload.t !== "string" ||
      !payload.t.startsWith("/")
    ) {
      return null;
    }
    return { targetPath: payload.t, restaurantId: String(payload.r ?? "") };
  } catch {
    return null;
  }
}
