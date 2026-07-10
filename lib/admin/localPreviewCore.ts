import type { AdminRestaurantAccessResult } from "./accessCore.ts";

export const LOCAL_ADMIN_PREVIEW_COOKIE = "vistaire_admin_local_preview";
export const LOCAL_ADMIN_PREVIEW_TTL_SECONDS = 60 * 60;
const LOCAL_ADMIN_PREVIEW_VALUE = "vistaire-local-admin-preview-v1";

function isLoopbackHostname(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  const hostname = normalized.startsWith("[")
    ? normalized.slice(1, normalized.indexOf("]"))
    : normalized.split(":", 1)[0];
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isAllowedLocalOrigin(origin: string | null, requestOrigin: string): boolean {
  if (!origin || origin === requestOrigin) return true;
  try {
    const supplied = new URL(origin);
    const requested = new URL(requestOrigin);
    return (
      isLoopbackHostname(supplied.hostname) &&
      isLoopbackHostname(requested.hostname) &&
      supplied.protocol === requested.protocol &&
      supplied.port === requested.port
    );
  } catch {
    return false;
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
  hostname: string;
  origin: string | null;
  requestOrigin: string;
}): LocalPreviewGrant {
  if (input.nodeEnv === "production" || !isLoopbackHostname(input.hostname)) {
    return { ok: false };
  }
  if (!isAllowedLocalOrigin(input.origin, input.requestOrigin)) return { ok: false };

  return {
    ok: true,
    redirectPath: "/admin",
    redirectOrigin: input.origin ?? input.requestOrigin,
    cookie: {
      name: LOCAL_ADMIN_PREVIEW_COOKIE,
      value: LOCAL_ADMIN_PREVIEW_VALUE,
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
  now?: number;
}): AdminRestaurantAccessResult | null {
  if (
    input.nodeEnv === "production" ||
    !isLoopbackHostname(input.hostname) ||
    input.capability !== "dashboard:read" ||
    input.cookieValue !== LOCAL_ADMIN_PREVIEW_VALUE ||
    !input.restaurantId
  ) {
    return null;
  }
  const now = input.now ?? Math.floor(Date.now() / 1000);
  return {
    ok: true,
    qrId: "local-preview",
    restaurantId: input.restaurantId,
    expiresAt: now + LOCAL_ADMIN_PREVIEW_TTL_SECONDS
  };
}
