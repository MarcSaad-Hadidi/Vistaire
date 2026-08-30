import { revalidatePath } from "next/cache";
import { requireAdminRestaurantAccess } from "@/lib/admin/access";
import { isSameOriginAdminMutation } from "@/lib/admin/availability/mutationGuard";
import { getAvailabilityAdminClient, readPublishedMenuScope } from "@/lib/admin/availability/repository";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const response = (body: Record<string, unknown>, status: number) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function DELETE(request: Request, { params }: { params: Promise<{ dishId: string; scheduleId: string }> }) {
  if (process.env.ADMIN_AVAILABILITY_SCHEDULING_ENABLED !== "1") return response({ ok: false }, 503);
  if (!isSameOriginAdminMutation(request)) return response({ ok: false }, 403);
  const access = await requireAdminRestaurantAccess("dish:availability:write");
  if (!access.ok || !access.qrId) return response({ ok: false }, 401);
  const { dishId, scheduleId } = await params;
  if (!UUID.test(dishId) || !UUID.test(scheduleId)) return response({ ok: false }, 400);
  const scope = await readPublishedMenuScope(access.restaurantId);
  if (!scope.ok) return response({ ok: false }, 503);
  const admin = getAvailabilityAdminClient();
  if (!admin.ok) return response({ ok: false }, 503);
  const { data, error } = await admin.client.rpc("cancel_admin_dish_availability", { p_qr_id: access.qrId, p_restaurant_id: access.restaurantId, p_dish_id: dishId, p_schedule_id: scheduleId });
  if (error || data !== true) return response({ ok: false }, 409);
  revalidatePath("/admin"); revalidatePath("/admin/availability"); revalidatePath(scope.publicMenuPath);
  return response({ ok: true }, 200);
}
