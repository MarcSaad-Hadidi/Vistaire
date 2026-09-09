import "server-only";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";
import type { AvailabilityHistoryItem, AvailabilityOperationsState, AvailabilityScheduleItem } from "./contracts";

export function getAvailabilityAdminClient() { return getSupabaseAdminClient(); }
export async function readAvailabilityCapability() {
  const admin = getSupabaseAdminClient(); if (!admin.ok) throw new Error("availability-admin-client");
  const { data, error } = await admin.client.rpc("get_admin_availability_capability");
  if (error) { const failure = new Error("availability-capability"); Object.assign(failure, { code: error.code }); throw failure; }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const value = row as Record<string, unknown>;
  return { schemaVersion: Number(value.schema_version), workerLastSuccessAt: typeof value.worker_last_success_at === "string" ? value.worker_last_success_at : null, workerLastAttemptAt: typeof value.worker_last_attempt_at === "string" ? value.worker_last_attempt_at : null };
}
export async function readPublishedMenuScope(restaurantId: string) {
  const admin = getSupabaseAdminClient(); if (!admin.ok) return { ok: false as const };
  const [{ data, error }, restaurantRead] = await Promise.all([
    admin.client.from("menus").select("id,settings_json").eq("restaurant_id", restaurantId).eq("status", "published").order("is_primary", { ascending: false }).limit(1).maybeSingle(),
    admin.client.from("restaurants").select("slug").eq("id", restaurantId).maybeSingle()
  ]);
  if (error || restaurantRead.error || !data || typeof data.id !== "string" || typeof restaurantRead.data?.slug !== "string" || !restaurantRead.data.slug.trim()) return { ok: false as const };
  const settings = data.settings_json && typeof data.settings_json === "object" ? data.settings_json as Record<string, unknown> : {};
  const timezone = typeof settings.timezone === "string" ? settings.timezone : null;
  if (!timezone) return { ok: false as const };
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(); } catch { return { ok: false as const }; }
  return { ok: true as const, client: admin.client, menuId: data.id, timezone, publicMenuPath: `/menu/${encodeURIComponent(restaurantRead.data.slug.trim())}` };
}

const text = (row: Record<string, unknown>, key: string) => typeof row[key] === "string" ? row[key] as string : "";
const missingSchema = (code: unknown) => code === "42P01" || code === "PGRST205";

export async function readAvailabilityOperations(input: { restaurantId: string; menuId: string }): Promise<AvailabilityOperationsState> {
  const admin = getSupabaseAdminClient();
  if (!admin.ok) return { kind: "error", retryable: true };
  const [scheduleRead, historyRead] = await Promise.all([
    admin.client.from("admin_dish_availability_schedules").select("id,dish_id,final_available,scheduled_for,timezone,status").eq("restaurant_id", input.restaurantId).eq("menu_id", input.menuId).in("status", ["pending", "failed"]).order("scheduled_for", { ascending: true }).limit(100),
    admin.client.from("admin_dish_availability_events").select("id,dish_id,previous_available,final_available,actor_kind,created_at").eq("restaurant_id", input.restaurantId).eq("menu_id", input.menuId).order("created_at", { ascending: false }).limit(50)
  ]);
  const failure = scheduleRead.error ?? historyRead.error;
  if (failure) return missingSchema(failure.code) ? { kind: "unavailable", reason: "schema-not-deployed" } : { kind: "error", retryable: failure.code !== "42501" };
  const schedules = ((scheduleRead.data ?? []) as Record<string, unknown>[]).flatMap((row): AvailabilityScheduleItem[] => {
    const status = text(row, "status");
    if (!text(row, "id") || !text(row, "dish_id") || !text(row, "scheduled_for") || !text(row, "timezone") || !["pending", "cancelled", "applied", "failed"].includes(status)) return [];
    return [{ id: text(row, "id"), dishId: text(row, "dish_id"), finalAvailable: row.final_available === true, scheduledFor: text(row, "scheduled_for"), timezone: text(row, "timezone"), status: status as AvailabilityScheduleItem["status"] }];
  });
  const history = ((historyRead.data ?? []) as Record<string, unknown>[]).flatMap((row): AvailabilityHistoryItem[] => {
    const actorKind = text(row, "actor_kind");
    if (!text(row, "id") || !text(row, "dish_id") || !text(row, "created_at") || !["admin_qr", "schedule_worker"].includes(actorKind)) return [];
    return [{ id: text(row, "id"), dishId: text(row, "dish_id"), previousAvailable: row.previous_available === true, finalAvailable: row.final_available === true, actorKind: actorKind as AvailabilityHistoryItem["actorKind"], createdAt: text(row, "created_at") }];
  });
  return { kind: "available", schedules, history };
}
