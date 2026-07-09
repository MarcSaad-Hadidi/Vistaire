import "server-only";

import { cookies } from "next/headers";
import { inferOwnerQrTargetKind } from "@/lib/owner/menuUrlCore";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";
import {
  requireAdminRestaurantAccess as requireAdminRestaurantAccessCore,
  type AdminAccessDependencies,
  type AdminCapability,
  type AdminRestaurantAccessResult,
  type LiveQrAccessRow
} from "@/lib/admin/accessCore";

export type {
  AdminAccessDependencies,
  AdminCapability,
  AdminRestaurantAccessResult,
  LiveQrAccessRow
} from "@/lib/admin/accessCore";

const ADMIN_ACCESS_COOKIE = "vistaire_admin_access";

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
    targetPath,
    status: typeof data.status === "string" ? data.status : ""
  };
}

export async function requireAdminRestaurantAccess(
  capability: AdminCapability,
  dependencies: AdminAccessDependencies = {}
): Promise<AdminRestaurantAccessResult> {
  return requireAdminRestaurantAccessCore(capability, {
    secret: dependencies.secret ?? process.env.VISTAIRE_ADMIN_SESSION_SECRET,
    now: dependencies.now,
    getCookieValue: dependencies.getCookieValue ?? readCookieValue,
    readQrCode: dependencies.readQrCode ?? readLiveQrCode
  });
}
