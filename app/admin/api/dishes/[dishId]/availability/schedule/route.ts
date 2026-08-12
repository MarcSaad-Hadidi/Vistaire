import { revalidatePath } from "next/cache";
import { requireAdminRestaurantAccess } from "@/lib/admin/access";
import { isSameOriginAdminMutation } from "@/lib/admin/availability/mutationGuard";
import { readPublishedMenuScope } from "@/lib/admin/availability/repository";
import { localScheduleToInstant } from "@/lib/admin/availability/scheduling";
import { readBoundedJsonBody } from "@/lib/admin/requestBody";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,128}$/;
const response = (body: Record<string, unknown>, status: number) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request, { params }: { params: Promise<{ dishId: string }> }) {
  if (process.env.ADMIN_AVAILABILITY_SCHEDULING_ENABLED !== "1") return response({ ok: false, error: "Planification indisponible." }, 503);
  if (!isSameOriginAdminMutation(request)) return response({ ok: false, error: "Requête refusée." }, 403);
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") return response({ ok: false, error: "Corps JSON requis." }, 415);
  const access = await requireAdminRestaurantAccess("dish:availability:write");
  if (!access.ok || !access.qrId) return response({ ok: false, error: "Accès admin requis." }, 401);
  const { dishId } = await params;
  if (!UUID.test(dishId)) return response({ ok: false, error: "Plat invalide." }, 400);
  const parsed = await readBoundedJsonBody(request, 2_048);
  if (!parsed.ok) return response({ ok: false, error: parsed.reason === "too-large" ? "Corps trop volumineux." : "Corps JSON invalide." }, parsed.reason === "too-large" ? 413 : 400);
  if (!parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) return response({ ok: false, error: "Corps JSON invalide." }, 400);
  const body = parsed.value as Record<string, unknown>;
  const allowed = new Set(["available", "dstDisambiguation", "idempotencyKey", "internalNote", "scheduledLocalDate", "scheduledLocalTime"]);
  const required = ["available", "idempotencyKey", "scheduledLocalDate", "scheduledLocalTime"];
  const disambiguationValid = body.dstDisambiguation === undefined || body.dstDisambiguation === "earlier" || body.dstDisambiguation === "later";
  if (Object.keys(body).some((key) => !allowed.has(key)) || !required.every((key) => Object.hasOwn(body, key)) || typeof body.available !== "boolean" || typeof body.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(body.idempotencyKey) || typeof body.scheduledLocalDate !== "string" || typeof body.scheduledLocalTime !== "string" || !disambiguationValid || (body.internalNote !== undefined && (typeof body.internalNote !== "string" || body.internalNote.length > 120))) return response({ ok: false, error: "Planification invalide." }, 400);
  const scope = await readPublishedMenuScope(access.restaurantId);
  if (!scope.ok) return response({ ok: false, error: "Planification indisponible." }, 503);
  const instant = localScheduleToInstant({ date: body.scheduledLocalDate, time: body.scheduledLocalTime, timezone: scope.timezone, ...(body.dstDisambiguation ? { disambiguation: body.dstDisambiguation as "earlier" | "later" } : {}) });
  if (!instant.ok || Date.parse(instant.instant) <= Date.now()) return response({ ok: false, error: instant.ok ? "invalid-input" : instant.reason }, 400);
  const { data, error } = await scope.client.rpc("schedule_admin_dish_availability", { p_qr_id: access.qrId, p_restaurant_id: access.restaurantId, p_menu_id: scope.menuId, p_dish_id: dishId, p_available: body.available, p_scheduled_for: instant.instant, p_timezone: scope.timezone, p_idempotency_key: body.idempotencyKey, p_internal_note: typeof body.internalNote === "string" ? body.internalNote : null });
  if (error || !data) return response({ ok: false, error: "Planification indisponible." }, 503);
  revalidatePath("/admin"); revalidatePath("/admin/availability"); revalidatePath(scope.publicMenuPath);
  return response({ ok: true, schedule: data }, 201);
}
