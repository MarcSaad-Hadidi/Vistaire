import { createHmac, timingSafeEqual } from "node:crypto";
import type { AdminRestaurantAccessResult } from "./accessCore.ts";

export const LOCAL_ADMIN_PREVIEW_COOKIE = "vistaire_admin_local_preview";
export const LOCAL_ADMIN_PREVIEW_TTL_SECONDS = 60 * 60;
const LOCAL_ADMIN_PREVIEW_VERSION = 1;
const LOCAL_ADMIN_PREVIEW_AUDIENCE = "local-admin-preview";
const MAX_TOKEN_LENGTH = 512;

function normalizeHostname(hostname: string): string {
  const normalized = hostname.trim().toLowerCase();
  return normalized.startsWith("[") && normalized.endsWith("]")
    ? normalized.slice(1, -1)
    : normalized;
}

function isLoopbackLiteral(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function isLoopbackHostname(hostname: string): boolean {
  if (isLoopbackLiteral(hostname)) return true;
  if (!hostname || /[,\s\\/?#@]/.test(hostname)) return false;
  try {
    return isLoopbackLiteral(new URL(`http://${hostname}`).hostname);
  } catch {
    return false;
  }
}

function isStrongSecret(secret: string): boolean {
  return Buffer.byteLength(secret, "utf8") >= 32;
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function createGrantToken(secret: string, expiresAt: number): string {
  const payload = Buffer.from(
    JSON.stringify({
      v: LOCAL_ADMIN_PREVIEW_VERSION,
      aud: LOCAL_ADMIN_PREVIEW_AUDIENCE,
      exp: expiresAt
    }),
    "utf8"
  ).toString("base64url");
  return `${payload}.${signPayload(payload, secret)}`;
}

function readGrantExpiration(
  token: string | undefined,
  secret: string,
  now: number
): number | null {
  if (!token || token.length > MAX_TOKEN_LENGTH || !isStrongSecret(secret)) return null;
  const segments = token.split(".");
  if (segments.length !== 2) return null;
  const [payload, suppliedSignature] = segments;
  if (!/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]+$/.test(suppliedSignature)) {
    return null;
  }

  const expectedSignature = signPayload(payload, secret);
  const suppliedBytes = Buffer.from(suppliedSignature, "base64url");
  const expectedBytes = Buffer.from(expectedSignature, "base64url");
  if (
    suppliedBytes.length !== expectedBytes.length ||
    suppliedBytes.toString("base64url") !== suppliedSignature ||
    !timingSafeEqual(suppliedBytes, expectedBytes)
  ) {
    return null;
  }

  try {
    const payloadBytes = Buffer.from(payload, "base64url");
    if (payloadBytes.toString("base64url") !== payload) return null;
    const parsed: unknown = JSON.parse(payloadBytes.toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as Record<string, unknown>;
    if (
      Object.keys(value).length !== 3 ||
      value.v !== LOCAL_ADMIN_PREVIEW_VERSION ||
      value.aud !== LOCAL_ADMIN_PREVIEW_AUDIENCE ||
      !Number.isSafeInteger(value.exp) ||
      (value.exp as number) <= now
    ) {
      return null;
    }
    return value.exp as number;
  } catch {
    return null;
  }
}

export function deriveLocalPreviewRequestOrigin(input: {
  nodeEnv: string | undefined;
  host: string | null;
  requestProtocol: string;
}): string | null {
  if (input.nodeEnv === "production" || !input.host) return null;
  if (/[,\s\\/?#@]/.test(input.host)) return null;
  if (input.requestProtocol !== "http:" && input.requestProtocol !== "https:") return null;

  let parsed: URL;
  try {
    parsed = new URL(`${input.requestProtocol}//${input.host}`);
  } catch {
    return null;
  }
  if (!isLoopbackHostname(parsed.hostname)) return null;

  try {
    return new URL(`${input.requestProtocol}//${input.host}`).origin;
  } catch {
    return null;
  }
}

type LocalPreviewGrant =
  | {
      ok: true;
      redirectPath: "/admin";
      redirectOrigin: string;
      cookie: {
        name: typeof LOCAL_ADMIN_PREVIEW_COOKIE;
        value: string;
        options: {
          httpOnly: true;
          sameSite: "lax";
          path: "/admin";
          maxAge: number;
        };
      };
    }
  | { ok: false };

export function createLocalAdminPreviewGrant(input: {
  nodeEnv: string | undefined;
  origin: string | null;
  requestOrigin: string;
  secret: string;
  now?: number;
}): LocalPreviewGrant {
  if (input.nodeEnv === "production" || !input.origin || !isStrongSecret(input.secret)) {
    return { ok: false };
  }
  let requested: URL;
  try {
    requested = new URL(input.requestOrigin);
  } catch {
    return { ok: false };
  }
  if (!isLoopbackHostname(requested.hostname) || input.origin !== requested.origin) {
    return { ok: false };
  }

  const now = input.now ?? Math.floor(Date.now() / 1000);
  return {
    ok: true,
    redirectPath: "/admin",
    redirectOrigin: requested.origin,
    cookie: {
      name: LOCAL_ADMIN_PREVIEW_COOKIE,
      value: createGrantToken(input.secret, now + LOCAL_ADMIN_PREVIEW_TTL_SECONDS),
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/admin",
        maxAge: LOCAL_ADMIN_PREVIEW_TTL_SECONDS
      }
    }
  };
}

export function createLocalAdminPreviewAccess(input: {
  nodeEnv: string | undefined;
  hostname: string;
  capability: "dashboard:read" | "dish:availability:write";
  cookieValue: string | undefined;
  restaurantId: string;
  secret: string;
  now?: number;
}): AdminRestaurantAccessResult | null {
  if (
    input.nodeEnv === "production" ||
    !isLoopbackHostname(input.hostname) ||
    input.capability !== "dashboard:read" ||
    !input.restaurantId
  ) {
    return null;
  }
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const expiresAt = readGrantExpiration(input.cookieValue, input.secret, now);
  if (expiresAt === null) return null;
  return {
    ok: true,
    sessionKind: "local-preview",
    assurance: "signed-loopback-preview",
    qrId: null,
    restaurantId: input.restaurantId,
    expiresAt,
    capabilities: ["dashboard:read"]
  };
}
