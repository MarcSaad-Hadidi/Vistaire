import { verifyAdminAccessToken } from "./accessSessionCore.ts";
import { isOwnerQrResolvedTargetPathAllowed } from "../owner/menuUrlCore.ts";

export const ADMIN_CAPABILITIES = [
  "dashboard:read",
  "dish:availability:write"
] as const;

export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number];

export function isAdminCapability(value: unknown): value is AdminCapability {
  return (
    typeof value === "string" &&
    (ADMIN_CAPABILITIES as readonly string[]).includes(value)
  );
}

export type LiveQrAccessRow = {
  id: string;
  restaurantId: string;
  targetKind: "menu" | "admin" | null;
  targetPath: string;
  status: string;
};

export type AdminAccessDependencies = {
  getCookieValue?: () => Promise<string | undefined> | string | undefined;
  readQrCode?: (qrId: string) => Promise<LiveQrAccessRow | null>;
  secret?: string;
  now?: number;
};

export type AdminRestaurantAccessResult =
  | {
      ok: true;
      qrId: string;
      restaurantId: string;
      expiresAt: number;
    }
  | {
      ok: false;
      reason: "capability" | "configuration" | "session" | "revoked";
    };

export async function requireAdminRestaurantAccess(
  capability: AdminCapability,
  dependencies: AdminAccessDependencies
): Promise<AdminRestaurantAccessResult> {
  if (!isAdminCapability(capability)) {
    return { ok: false, reason: "capability" };
  }
  if (
    !dependencies.secret ||
    !dependencies.getCookieValue ||
    !dependencies.readQrCode
  ) {
    return { ok: false, reason: "configuration" };
  }

  try {
    const token = await dependencies.getCookieValue();
    if (!token) return { ok: false, reason: "session" };
    const payload = verifyAdminAccessToken(
      token,
      dependencies.secret,
      dependencies.now
    );
    if (!payload) return { ok: false, reason: "session" };

    const qr = await dependencies.readQrCode(payload.qrId);
    if (
      !qr ||
      qr.id !== payload.qrId ||
      qr.restaurantId !== payload.restaurantId ||
      qr.targetKind !== "admin" ||
      !isOwnerQrResolvedTargetPathAllowed(qr.targetKind, qr.targetPath) ||
      qr.status !== "active"
    ) {
      return { ok: false, reason: "revoked" };
    }

    return {
      ok: true,
      qrId: payload.qrId,
      restaurantId: payload.restaurantId,
      expiresAt: payload.exp
    };
  } catch {
    return { ok: false, reason: "configuration" };
  }
}
