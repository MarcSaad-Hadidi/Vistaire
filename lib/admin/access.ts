import "server-only";

import { cookies } from "next/headers";
import { verifyAdminAccessToken } from "@/lib/admin/accessSessionCore";
import { inferOwnerQrTargetKind } from "@/lib/owner/menuUrlCore";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

const ADMIN_ACCESS_COOKIE = "vistaire_admin_access";

export type AdminCapability = "dashboard:read" | "dish:availability:write";

type LiveQrAccessRow = {
  id: string;
  restaurantId: string;
  targetKind: "menu" | "admin";
  status: string;
};

type AdminAccessDependencies = {
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

async function readCookieValue(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_ACCESS_COOKIE)?.value;
}

async function readLiveQrCode(qrId: string): Promise<LiveQrAccessRow | null> {
  const admin = getSupabaseAdminClient();
  if (!admin.ok) throw new Error(admin.reason);

  const { data, error } = await admin.client
    .from("qr_codes")
    .select("id, restaurant_id, target_kind, target_path, status")
    .eq("id", qrId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const targetPath = typeof data.target_path === "string" ? data.target_path : "";
  const storedKind = data.target_kind;
  const targetKind =
    storedKind === "menu" || storedKind === "admin"
      ? storedKind
      : inferOwnerQrTargetKind(targetPath);
  return {
    id: typeof data.id === "string" ? data.id : "",
    restaurantId:
      typeof data.restaurant_id === "string" ? data.restaurant_id : "",
    targetKind,
    status: typeof data.status === "string" ? data.status : ""
  };
}

export async function requireAdminRestaurantAccess(
  _capability: AdminCapability,
  dependencies: AdminAccessDependencies = {}
): Promise<AdminRestaurantAccessResult> {
  const secret = dependencies.secret ?? process.env.VISTAIRE_ADMIN_SESSION_SECRET;
  if (!secret) return { ok: false, reason: "configuration" };

  try {
    const token = await (dependencies.getCookieValue ?? readCookieValue)();
    if (!token) return { ok: false, reason: "session" };
    const payload = verifyAdminAccessToken(token, secret, dependencies.now);
    if (!payload) return { ok: false, reason: "session" };

    const qr = await (dependencies.readQrCode ?? readLiveQrCode)(payload.qrId);
    if (
      !qr ||
      qr.id !== payload.qrId ||
      qr.restaurantId !== payload.restaurantId ||
      qr.targetKind !== "admin" ||
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
