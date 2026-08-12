import "server-only";
import { getSupabaseAdminClient } from "@/utils/supabase/admin";

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
  const { data, error } = await admin.client.from("menus").select("id,settings_json").eq("restaurant_id", restaurantId).eq("status", "published").order("is_primary", { ascending: false }).limit(1).maybeSingle();
  if (error || !data || typeof data.id !== "string") return { ok: false as const };
  const settings = data.settings_json && typeof data.settings_json === "object" ? data.settings_json as Record<string, unknown> : {};
  const timezone = typeof settings.timezone === "string" ? settings.timezone : null;
  if (!timezone) return { ok: false as const };
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(); } catch { return { ok: false as const }; }
  return { ok: true as const, client: admin.client, menuId: data.id, timezone };
}
