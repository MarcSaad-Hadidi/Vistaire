import { verifyAdminAccessToken } from "./accessSessionCore.ts";
import { isOwnerQrResolvedTargetPathAllowed } from "../owner/menuUrlCore.ts";

export type AdminCapability = "dashboard:read" | "dish:availability:write";

export type LiveQrAccessRow = {
  id: string;
  restaurantId: string;
  targetKind: "menu" | "admin";
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
  | { ok: false; reason: "configuration" | "session" | "revoked" };

export async function requireAdminRestaurantAccess(
  _capability: AdminCapability,
  dependencies: AdminAccessDependencies
): Promise<AdminRestaurantAccessResult> {
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
