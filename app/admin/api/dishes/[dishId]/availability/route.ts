import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { requireAdminRestaurantAccess } from "@/lib/admin/access";
import {
  handleAdminAvailabilityRequest,
  type AvailabilityUpdateResult
} from "@/lib/admin/availability";
import { selectAdminDashboardMenu } from "@/lib/admin/menuReadiness";
import { revalidateOwnerMenuMutationPaths } from "@/lib/owner/menuMutationRevalidation";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function updateDishAvailability({
  restaurantId,
  dishId,
  available
}: {
  restaurantId: string;
  dishId: string;
  available: boolean;
}): Promise<AvailabilityUpdateResult> {
  const admin = getSupabaseAdminClient();
  if (!admin.ok) return { ok: false, status: 503 };

  const menus = await admin.client
    .from("menus")
    .select("id,status,is_primary,updated_at")
    .eq("restaurant_id", restaurantId)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(50);
  if (menus.error) return { ok: false, status: 503 };
  const selectedMenu = selectAdminDashboardMenu(menus.data ?? []);
  if (!selectedMenu) return { ok: false, status: 404 };
  const menuId = selectedMenu.id;

  const updatedAt = new Date().toISOString();
  const { data, error } = await admin.client
    .from("menu_dishes")
    .update({
      is_available: available,
      updated_at: updatedAt
    })
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId)
    .eq("menu_id", menuId)
    .select("id,slug,is_available")
    .maybeSingle();

  if (error) return { ok: false, status: 503 };
  if (!data) return { ok: false, status: 404 };

  revalidatePath("/admin");
  await revalidateOwnerMenuMutationPaths({
    client: admin.client,
    restaurantId,
    dishSlug: typeof data.slug === "string" ? data.slug : ""
  });

  return {
    ok: true,
    dishId: typeof data.id === "string" ? data.id : dishId,
    dishSlug: typeof data.slug === "string" ? data.slug : "",
    available: data.is_available === true
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dishId: string }> }
) {
  return handleAdminAvailabilityRequest(request, params, {
    requireAccess: () =>
      requireAdminRestaurantAccess("dish:availability:write"),
    updateAvailability: updateDishAvailability
  });
}
