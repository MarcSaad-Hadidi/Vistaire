import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_ACCESS_TTL_SECONDS = 8 * 60 * 60;
export const ADMIN_ACCESS_COOKIE_NAME = "vistaire_admin_access";

const MIN_SECRET_BYTES = 32;
const PAYLOAD_KEYS = ["exp", "qrId", "restaurantId", "v"];

export type AdminAccessPayloadV1 = {
  v: 1;
  qrId: string;
  restaurantId: string;
  exp: number;
};

export function getAdminAccessCookieOptions(nodeEnv: string | undefined) {
  return {
    httpOnly: true as const,
    secure: nodeEnv === "production",
    sameSite: "lax" as const,
    path: "/admin" as const,
    maxAge: ADMIN_ACCESS_TTL_SECONDS
  };
}

export function getExpiredAdminAccessCookieOptions(nodeEnv: string | undefined) {
  return {
    httpOnly: true as const,
    secure: nodeEnv === "production",
    sameSite: "lax" as const,
    path: "/admin" as const,
    maxAge: 0,
    expires: new Date(0)
  };
}

function isStrongSecret(secret: string): boolean {
  return Buffer.byteLength(secret, "utf8") >= MIN_SECRET_BYTES;
}

function encodeBase64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function isValidId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

export function createAdminAccessToken(
  input: { qrId: string; restaurantId: string; now?: number },
  secret: string
): string {
  if (!isStrongSecret(secret)) {
    throw new Error("Admin session secret must contain at least 32 bytes.");
  }
  if (!isValidId(input.qrId)) throw new Error("A valid QR id is required.");
  if (!isValidId(input.restaurantId)) {
    throw new Error("A valid restaurant id is required.");
  }

  const now = input.now ?? Math.floor(Date.now() / 1000);
  if (!Number.isInteger(now) || now < 0) throw new Error("Invalid session time.");

  const payload: AdminAccessPayloadV1 = {
    v: 1,
    qrId: input.qrId,
    restaurantId: input.restaurantId,
    exp: now + ADMIN_ACCESS_TTL_SECONDS
  };
  const body = encodeBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(body).digest();
  return `${body}.${encodeBase64Url(signature)}`;
}

export function verifyAdminAccessToken(
  token: string,
  secret: string,
  now = Math.floor(Date.now() / 1000)
): AdminAccessPayloadV1 | null {
  if (!isStrongSecret(secret) || !Number.isInteger(now) || now < 0) return null;

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [body, encodedSignature] = parts;
  if (!/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]+$/.test(encodedSignature)) {
    return null;
  }

  let providedSignature: Buffer;
  try {
    providedSignature = Buffer.from(encodedSignature, "base64url");
  } catch {
    return null;
  }
  if (encodeBase64Url(providedSignature) !== encodedSignature) return null;
  const expectedSignature = createHmac("sha256", secret).update(body).digest();
  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    return null;
  }

  try {
    const decoded = Buffer.from(body, "base64url").toString("utf8");
    if (encodeBase64Url(decoded) !== body) return null;
    const payload = JSON.parse(decoded) as Record<string, unknown>;
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      Object.keys(payload).sort().join(",") !== PAYLOAD_KEYS.join(",") ||
      payload.v !== 1 ||
      !isValidId(payload.qrId) ||
      !isValidId(payload.restaurantId) ||
      !Number.isInteger(payload.exp) ||
      (payload.exp as number) <= now
    ) {
      return null;
    }
    return payload as AdminAccessPayloadV1;
  } catch {
    return null;
  }
}
