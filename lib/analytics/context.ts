import "server-only";

import type { AnalyticsEventPayload } from "@/lib/analytics/types";
import { validateAnalyticsContext } from "./validationCore.mjs";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

type AnalyticsContextResult =
  | { ok: true }
  | { ok: false; status: 400 | 503; error: string };

export async function validateAnalyticsEventContext(
  payload: AnalyticsEventPayload
): Promise<AnalyticsContextResult> {
  const admin = getSupabaseAdminClient();
  if (!admin.ok) {
    return {
      ok: false,
      status: 503,
      error: "Analytics context is unavailable."
    };
  }

  try {
    const result = await validateAnalyticsContext(payload, {
      publicQrBelongsToRestaurant: async (qrId, restaurantId) => {
        const [qr, restaurant] = await Promise.all([
          admin.client.from("qr_codes").select("target_path")
            .eq("id", qrId).eq("restaurant_id", restaurantId)
            .eq("target_kind", "menu").eq("status", "active").maybeSingle(),
          admin.client.from("restaurants").select("slug").eq("id", restaurantId).maybeSingle()
        ]);
        if (qr.error || restaurant.error) throw qr.error ?? restaurant.error;
        if (!qr.data || !restaurant.data?.slug) return false;
        try {
          const target = new URL(qr.data.target_path, "https://vistaire.local");
          return target.origin === "https://vistaire.local"
            && decodeURIComponent(target.pathname).replace(/\/$/, "") === `/menu/${restaurant.data.slug}`;
        } catch { return false; }
      },
      restaurantExists: async (restaurantId) => {
        const { data, error } = await admin.client
          .from("restaurants")
          .select("id")
          .eq("id", restaurantId)
          .maybeSingle();
        if (error) throw error;
        return Boolean(data);
      },
      menuBelongsToRestaurant: async (menuId, restaurantId) => {
        const { data, error } = await admin.client
          .from("menus")
          .select("id")
          .eq("id", menuId)
          .eq("restaurant_id", restaurantId)
          .maybeSingle();
        if (error) throw error;
        return Boolean(data);
      }
    });

    if (!result) {
      return {
        ok: false,
        status: 400,
        error: "Analytics restaurant/menu context is incoherent."
      };
    }

    return { ok: true };
  } catch {
    console.error("[Vistaire analytics] context lookup failed");
    return {
      ok: false,
      status: 503,
      error: "Analytics context is unavailable."
    };
  }
}
