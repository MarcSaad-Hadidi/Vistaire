import "server-only";

import { cookies, headers } from "next/headers";
import { getDemoRestaurantId } from "@/lib/analytics/insights";
import { inferOwnerQrTargetKind } from "@/lib/owner/menuUrlCore";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";
import {
  createLocalAdminPreviewAccess,
  LOCAL_ADMIN_PREVIEW_COOKIE
} from "@/lib/admin/localPreviewCore";
import { getLocalAdminPreviewSecret } from "@/lib/admin/localPreviewSecret";
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
  const usesDefaultAccess =
    dependencies.getCookieValue === undefined &&
    dependencies.readQrCode === undefined &&
    dependencies.secret === undefined &&
    dependencies.now === undefined;
  if (usesDefaultAccess && process.env.NODE_ENV !== "production") {
    const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
    const previewSecret = getLocalAdminPreviewSecret();
    const previewAccess = createLocalAdminPreviewAccess({
      nodeEnv: process.env.NODE_ENV,
      hostname: requestHeaders.get("host") ?? "",
      capability,
      cookieValue: cookieStore.get(LOCAL_ADMIN_PREVIEW_COOKIE)?.value,
      restaurantId: getDemoRestaurantId(),
      secret: previewSecret ?? ""
    });
    if (previewAccess) return previewAccess;
  }

  return requireAdminRestaurantAccessCore(capability, {
    secret: dependencies.secret ?? process.env.VISTAIRE_ADMIN_SESSION_SECRET,
    now: dependencies.now,
    getCookieValue: dependencies.getCookieValue ?? readCookieValue,
    readQrCode: dependencies.readQrCode ?? readLiveQrCode
  });
}
