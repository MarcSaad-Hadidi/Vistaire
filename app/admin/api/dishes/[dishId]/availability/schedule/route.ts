import { revalidatePath } from "next/cache";
import { requireAdminRestaurantAccess } from "@/lib/admin/access";
import { localScheduleToInstant } from "@/lib/admin/availability/scheduling";
import { readPublishedMenuScope } from "@/lib/admin/availability/repository";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const response=(body:Record<string,unknown>,status:number)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
export async function POST(request:Request,{params}:{params:Promise<{dishId:string}>}) {
  if (process.env.ADMIN_AVAILABILITY_SCHEDULING_ENABLED !== "1") return response({ok:false,error:"Planification indisponible."},503);
  if (request.headers.get("content-type")?.split(";")[0].toLowerCase() !== "application/json" || (request.headers.get("origin") && new URL(request.headers.get("origin")!).origin !== new URL(request.url).origin)) return response({ok:false,error:"Requête refusée."},415);
  const access=await requireAdminRestaurantAccess("dish:availability:write"); if(!access.ok||!access.qrId)return response({ok:false,error:"Accès admin requis."},401);
  const {dishId}=await params; if(!UUID.test(dishId)) return response({ok:false,error:"Plat invalide."},400);
  const body=await request.json() as Record<string,unknown>; const keys=Object.keys(body).sort().join(","); if(!["available,dstDisambiguation,idempotencyKey,scheduledLocalDate,scheduledLocalTime","available,idempotencyKey,scheduledLocalDate,scheduledLocalTime"].includes(keys)||typeof body.available!=="boolean"||typeof body.idempotencyKey!=="string") return response({ok:false,error:"Planification invalide."},400);
  const scope=await readPublishedMenuScope(access.restaurantId); if(!scope.ok)return response({ok:false,error:"Planification indisponible."},503);
  const instant=localScheduleToInstant({date:String(body.scheduledLocalDate),time:String(body.scheduledLocalTime),timezone:scope.timezone,...(body.dstDisambiguation === "earlier" || body.dstDisambiguation === "later" ? {disambiguation:body.dstDisambiguation}: {})}); if(!instant.ok)return response({ok:false,error:instant.reason},400);
  const {data,error}=await scope.client.rpc("schedule_admin_dish_availability",{p_qr_id:access.qrId,p_restaurant_id:access.restaurantId,p_menu_id:scope.menuId,p_dish_id:dishId,p_available:body.available,p_scheduled_for:instant.instant,p_timezone:scope.timezone,p_idempotency_key:body.idempotencyKey}); if(error||!data)return response({ok:false,error:"Planification indisponible."},503); revalidatePath("/admin/availability"); return response({ok:true,schedule:data},201);
}
