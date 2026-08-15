import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { requireAdminRestaurantAccess } from "@/lib/admin/access";
import {
  handleAdminAvailabilityRequest,
  preserveAvailabilityResultAfterRevalidation,
  type AvailabilityUpdateResult
} from "@/lib/admin/availability";
import { revalidateOwnerMenuMutationPaths } from "@/lib/owner/menuMutationRevalidation";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function updateDishAvailability({
  qrId,
  restaurantId,
  dishId,
  available
}: {
  qrId: string;
  restaurantId: string;
  dishId: string;
  available: boolean;
}): Promise<AvailabilityUpdateResult> {
  const admin = getSupabaseAdminClient();
  if (!admin.ok) return { ok: false, status: 503 };

  const { data, error } = await admin.client
    .rpc("set_admin_dish_availability", {
      p_qr_id: qrId,
      p_restaurant_id: restaurantId,
      p_dish_id: dishId,
      p_available: available
    })
    .maybeSingle();

  if (error) return { ok: false, status: 503 };
  if (!data) return { ok: false, status: 404 };
  const row = data as Record<string, unknown>;

  const result: AvailabilityUpdateResult = {
    ok: true,
    dishId: typeof row.dish_id === "string" ? row.dish_id : dishId,
    dishSlug: typeof row.dish_slug === "string" ? row.dish_slug : "",
    available: row.is_available === true
  };

  return preserveAvailabilityResultAfterRevalidation(
    result,
    async () => {
      const menuRevalidation = await revalidateOwnerMenuMutationPaths({
        client: admin.client,
        restaurantId,
        dishId,
        dishSlug: result.ok ? result.dishSlug : ""
      });
      let adminPathOk = true;
      try {
        revalidatePath("/admin");
      } catch {
        adminPathOk = false;
      }
      return { ok: menuRevalidation.ok && adminPathOk };
    },
    {
      retrySignal: {
        kind: "menu-revalidation-retry-required",
        schemaVersion: 1,
        source: "admin-availability",
        restaurantId,
        dishId,
        failures: ["post-commit-revalidation"]
      }
    }
  );
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
