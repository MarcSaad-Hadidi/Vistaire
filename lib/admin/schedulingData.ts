import 'server-only';
import { getSupabaseAdminClient } from '@/utils/supabase/admin';
import { validTimezone, type DishSchedule } from './scheduling';
import { selectAdminDashboardMenu } from './menuReadiness';
export async function readSchedulingData(restaurantId:string) {
 const admin=getSupabaseAdminClient(); if(!admin.ok) return {ok:false as const};
 const [menus,schedules,history,dishes]=await Promise.all([
  admin.client.from('menus').select('id,status,is_primary,updated_at,settings_json').eq('restaurant_id',restaurantId),
  admin.client.from('dish_schedules').select('dish_id,base_available,manual_override,revision,rules').eq('restaurant_id',restaurantId),
  admin.client.from('menu_change_history').select('id,kind,occurred_at,dish_id,before_value,after_value').eq('restaurant_id',restaurantId).order('occurred_at',{ascending:false}).limit(100),
  admin.client.from('menu_dishes').select('id,menu_id,is_available').eq('restaurant_id',restaurantId)
 ]);
 if(menus.error||schedules.error||history.error||dishes.error||(menus.data?.length??0)>=1000||(schedules.data?.length??0)>=1000||(dishes.data?.length??0)>=1000) return {ok:false as const};
 const menu=selectAdminDashboardMenu(menus.data??[]); if(!menu)return {ok:false as const};
 const settings=menus.data?.find(m=>m.id===menu.id)?.settings_json;
 const timezone=validTimezone(settings?.timezone)?settings.timezone:null;
 const stored=new Map((schedules.data??[]).map(s=>[s.dish_id,s as DishSchedule]));
 return {ok:true as const,timezone,schedules:(dishes.data??[]).filter(d=>d.menu_id===menu.id).map(d=>stored.get(d.id)??{dish_id:d.id,base_available:d.is_available===true,manual_override:null,revision:0,rules:[]}),history:history.data??[]};
}
