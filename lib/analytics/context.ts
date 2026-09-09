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
      },
      dishBelongsToMenu: async (slug, menuId, restaurantId) => {
        const { data, error } = await admin.client
          .from("menu_dishes")
          .select("id")
          .eq("slug", slug)
          .eq("restaurant_id", restaurantId)
          .eq("menu_id", menuId)
          .maybeSingle();
        if (error) throw error;
        return Boolean(data);
      },
      categoryBelongsToMenu: async (slug, menuId, restaurantId) => {
        const { data, error } = await admin.client
          .from("menu_categories")
          .select("id")
          .eq("slug", slug)
          .eq("restaurant_id", restaurantId)
          .eq("menu_id", menuId)
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
