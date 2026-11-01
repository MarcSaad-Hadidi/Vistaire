import { requireAdminApiAccess } from '@/lib/admin/apiAuth';
import { readBoundedJsonBody } from '@/lib/admin/requestBody';
import { parseScheduleInput } from '@/lib/admin/scheduling';
import { readSchedulingData } from '@/lib/admin/schedulingData';
import { getSupabaseAdminClient } from '@/utils/supabase/admin';
import { resolvePublicMutationIdentity, invalidateCommittedPublicMutation } from '@/lib/owner/menuMutationRevalidation';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){
 const access=await requireAdminApiAccess('dashboard:read');if(!access.ok)return access.response;
 const result=await readSchedulingData(access.restaurantId);
 return result.ok?json(result):json({ok:false,error:'Planning et historique indisponibles. La migration doit être appliquée et la connexion vérifiée.'},503);
}
export async function PATCH(request:Request){
 const origin=request.headers.get('origin'); const site=request.headers.get('sec-fetch-site');
 if((site&&site!=='same-origin'&&site!=='none') || (!origin&&site!=='same-origin'&&site!=='none') || (origin&&origin!==new URL(request.url).origin))return json({ok:false,error:'Requête refusée.'},403);
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return json({ok:false,error:'Corps JSON requis.'},415);
 const access=await requireAdminApiAccess('dish:availability:write');if(!access.ok)return access.response;
 if(!access.qrId)return json({ok:false,error:'Accès en écriture requis.'},403);
 const body=await readBoundedJsonBody(request,32768);if(!body.ok)return json({ok:false,error:'Corps invalide.'},400);
 const parsed=parseScheduleInput(body.value);if(!parsed.ok)return json({ok:false,error:'Horaire, date ou fuseau invalide.'},400);
 const admin=getSupabaseAdminClient();if(!admin.ok)return json({ok:false,error:'Planning indisponible.'},503);
 const p=parsed.value;
 const {error}=await admin.client.rpc('save_admin_dish_schedule',{p_qr_id:access.qrId,p_restaurant_id:access.restaurantId,p_dish_id:p.dishId,p_timezone:p.timezone,p_expected_timezone:p.expectedTimezone,p_base_available:p.baseAvailable,p_manual_override:p.manualOverride,p_rules:p.rules,p_expected_revision:p.expectedRevision,p_request_id:p.requestId});
 if(error)return json({ok:false,error:error.code==='40001'?'Ce planning a changé. Rechargez avant de réessayer.':'Le planning n’a pas pu être enregistré.'},error.code==='40001'?409:error.code==='42501'?403:503);
 // Persistence succeeded even if invalidation needs a retry; never invite replay.
 let revalidation='complete';try{const identity=await resolvePublicMutationIdentity({client:admin.client,restaurantId:access.restaurantId,dishId:p.dishId});const result=await invalidateCommittedPublicMutation(identity);if(result.enqueueErrors.length)revalidation='retry-required';}catch{revalidation='retry-required';}
 return json({ok:true,revalidation});
}
