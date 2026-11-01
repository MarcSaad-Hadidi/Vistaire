import "server-only";

import type { AnalyticsEventPayload } from "@/lib/analytics/types";
import { canRetryLegacyAnalyticsInsert } from "./validationCore.mjs";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

type InsertEventResult =
  | { ok: true; persisted: true }
  | { ok: false; error: string };

export async function insertAnalyticsEvent(payload: AnalyticsEventPayload): Promise<InsertEventResult> {
  const admin = getSupabaseAdminClient();
  if (!admin.ok) return { ok: false, error: admin.reason };

  let dishId: string | undefined;
  if (payload.dishSlug && payload.menuId) {
    const { data, error } = await admin.client.from("menu_dishes").select("id")
      .eq("restaurant_id", payload.restaurantId).eq("menu_id", payload.menuId)
      .eq("slug", payload.dishSlug).maybeSingle();
    if (error) return { ok: false, error: "Analytics dish context is unavailable." };
    dishId = data?.id;
  }
  // V2 always requires its schema; old browsers retain a narrow baseline-only
  // retry during schema-first rollouts after a confirmed missing-column error.
  const row = {
    event_name: payload.eventName, restaurant_id: payload.restaurantId,
    menu_id: payload.menuId, session_id: payload.sessionId, source: payload.source,
    dish_id: dishId, dish_slug: payload.dishSlug, category_slug: payload.categorySlug,
    filter_name: payload.filterName, cta_name: payload.ctaName,
    schema_version: payload.schemaVersion ?? 1, event_id: payload.eventId, sequence: payload.sequence,
    environment: payload.environment ?? "development", metadata: payload.metadata ?? {}
  };
  let { error } = await admin.client.from("analytics_events").insert(row);
  if (canRetryLegacyAnalyticsInsert(payload, error)) {
    const legacyRow: Record<string, unknown> = { ...row };
    for (const key of ["schema_version", "event_id", "sequence", "environment"]) delete legacyRow[key];
    ({ error } = await admin.client.from("analytics_events").insert(legacyRow));
  }
  // A retry with the same event ID is already persisted, not another observation.
  if (error?.code === "23505" && payload.eventId && error.message?.includes("analytics_events_event_id")) return { ok: true, persisted: true };
  if (error) {
    console.error("[Vistaire analytics] insert failed");
    return { ok: false, error: "Analytics event could not be persisted." };
  }
  return { ok: true, persisted: true };
}
