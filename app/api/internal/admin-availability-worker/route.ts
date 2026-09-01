import { getAvailabilityAdminClient } from "@/lib/admin/availability/repository";
import { boundedWorkerBatch, validWorkerAuthorization } from "@/lib/admin/availability/worker";
import { readBoundedJsonBody } from "@/lib/admin/requestBody";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.ADMIN_AVAILABILITY_SCHEDULING_ENABLED !== "1") return Response.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  if (!validWorkerAuthorization(request.headers.get("authorization"), process.env.ADMIN_AVAILABILITY_WORKER_SECRET)) return Response.json({ ok: false }, { status: 401 });
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") return Response.json({ ok: false }, { status: 415, headers: { "cache-control": "no-store" } });
  const parsed = await readBoundedJsonBody(request, 1_024);
  if (!parsed.ok) return Response.json({ ok: false }, { status: parsed.reason === "too-large" ? 413 : 400, headers: { "cache-control": "no-store" } });
  const body = parsed.value;
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => key !== "batchSize")) return Response.json({ ok: false }, { status: 400, headers: { "cache-control": "no-store" } });
  const batch = boundedWorkerBatch(body && typeof body === "object" && "batchSize" in body ? (body as { batchSize?: unknown }).batchSize : undefined);
  const admin = getAvailabilityAdminClient();
  if (!admin.ok) return Response.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  const attempt = await admin.client.rpc("mark_admin_availability_worker_attempt", { p_worker_id: "primary" });
  if (attempt.error) return Response.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  const { data, error } = await admin.client.rpc("run_due_admin_dish_availability", { p_worker_id: "primary", p_batch_size: batch });
  if (error) return Response.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  return Response.json({ ok: true, processed: data }, { headers: { "cache-control": "no-store" } });
}
