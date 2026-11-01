export type ScheduleRule = { type: 'weekly' | 'once'; days: number[]; date?: string; start: string; end: string; available: boolean };
export type DishSchedule = { dish_id: string; base_available: boolean; manual_override: boolean | null; revision: number; rules: ScheduleRule[] };
export type ScheduleInput = { dishId: string; timezone: string; expectedTimezone: string | null; baseAvailable: boolean; manualOverride: boolean | null; rules: ScheduleRule[]; expectedRevision: number; requestId: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export function validTimezone(value: unknown): value is string {
 if (typeof value !== 'string' || value.length > 100) return false;
 try { new Intl.DateTimeFormat('en', {timeZone:value}).format(); return true; } catch { return false; }
}
export function parseScheduleInput(value: unknown): {ok:true;value:ScheduleInput}|{ok:false} {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return {ok:false};
 const v = value as Record<string,unknown>;
 if (Object.keys(v).some(k=>!['dishId','timezone','expectedTimezone','baseAvailable','manualOverride','rules','expectedRevision','requestId'].includes(k)) || typeof v.dishId !== 'string' || !uuid.test(v.dishId) || typeof v.requestId !== 'string' || !uuid.test(v.requestId) || !validTimezone(v.timezone) || (v.expectedTimezone !== null && !validTimezone(v.expectedTimezone)) || typeof v.baseAvailable !== 'boolean' || (v.manualOverride !== null && typeof v.manualOverride !== 'boolean') || !Number.isSafeInteger(v.expectedRevision) || (v.expectedRevision as number)<0 || !Array.isArray(v.rules) || v.rules.length>100) return {ok:false};
 for (const rule of v.rules) {
  if (!rule || typeof rule!=='object' || Array.isArray(rule)) return {ok:false};
  const r=rule as Record<string,unknown>;
  if (Object.keys(r).some(k=>!['type','days','date','start','end','available'].includes(k)) || !['weekly','once'].includes(String(r.type)) || typeof r.available!=='boolean' || typeof r.start!=='string' || typeof r.end!=='string' || !time.test(r.start) || !time.test(r.end) || r.start===r.end || !Array.isArray(r.days) || r.days.some(d=>!Number.isInteger(d)||d<1||d>7) || new Set(r.days).size!==r.days.length) return {ok:false};
  if (r.type==='weekly' && (!r.days.length || r.date!==undefined)) return {ok:false};
  if (r.type==='once' && (r.days.length!==0 || typeof r.date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || r.date.startsWith('0000-') || !Number.isFinite(Date.parse(r.date)) || new Date(r.date).toISOString().slice(0,10)!==r.date)) return {ok:false};
 }
 return {ok:true,value:{...v,timezone:new Intl.DateTimeFormat('en',{timeZone:v.timezone as string}).resolvedOptions().timeZone} as ScheduleInput};
}
export function localScheduleTime(now:Date, timezone:string) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};
}
export function resolveAvailability(schedule:Pick<DishSchedule,'base_available'|'manual_override'|'rules'>, timezone:string, now:Date):boolean {
 if (schedule.manual_override!==null) return schedule.manual_override;
 const local=localScheduleTime(now,timezone);
 const previous=new Date(`${local.date}T12:00:00Z`); previous.setUTCDate(previous.getUTCDate()-1);
 const previousDate=previous.toISOString().slice(0,10);
 const matches=(r:ScheduleRule,date:string)=>r.type==='once'?r.date===date:r.days.includes(new Date(`${date}T12:00:00Z`).getUTCDay()||7);
 const active=schedule.rules.filter(r=>r.end>r.start ? matches(r,local.date)&&local.time>=r.start&&local.time<r.end : (matches(r,local.date)&&local.time>=r.start)||(matches(r,previousDate)&&local.time<r.end));
 // Date exceptions override recurring rules; unavailable wins within either layer.
 const once=active.filter(r=>r.type==='once'); const effective=once.length?once:active;
 return effective.length?effective.every(r=>r.available):schedule.base_available;
}
export function applyScheduleAvailability<T extends Record<string,unknown>>(rows:T[], schedules:DishSchedule[], timezone:string, now=new Date()):T[] {
 const byId=new Map(schedules.map(s=>[s.dish_id,s]));
 return rows.map(row=> {const s=byId.get(String(row.id));return s?{...row,is_available:resolveAvailability(s,timezone,now)}:row;});
}
