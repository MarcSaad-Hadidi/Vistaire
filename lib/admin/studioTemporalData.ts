/** Server-reduced event counts only. No session identities or raw telemetry leave the server. */
export type StudioMetricCounts = {menu:number;views:number;three:number;ar:number;searches:number};
export type StudioTemporalCell = StudioMetricCounts & {dishId:string|null;categorySlug:string|null;date:string;weekday:number;hour:number};
type Window = {startInclusive:string;endExclusive:string;comparisonStartInclusive:string;comparisonEndExclusive:string};
type Dish = {id:string;slug:string;categorySlug?:string;createdAt?:string|null};
type Event = Record<string,unknown>;
type Period = {cells:StudioTemporalCell[];dates:string[];totals:StudioMetricCounts};
export type StudioTemporalAnalytics = {kind:'available';windowBasis:'UTC';timezone:string;timezoneSource:'configured'|'utc-fallback';current:Period;previous:Period|null;comparison:'observed'|'unobserved'} | {kind:'unavailable';reason:'incomplete-source'|'invalid-window'};
const metrics = {menu_opened:'menu',dish_opened:'views',dish_3d_clicked:'three',dish_ar_clicked:'ar',search_used:'searches'} as const;
const zero=():StudioMetricCounts=>({menu:0,views:0,three:0,ar:0,searches:0});
export function configuredStudioTimezone(settings:unknown):string|null {
 if(!settings||typeof settings!=='object'||Array.isArray(settings))return null;
 const row=settings as Record<string,unknown>;const value=row.timezone??row.timeZone;
 if(typeof value!=='string'||!value.trim())return null;
 try {new Intl.DateTimeFormat('en',{timeZone:value}).format(0);return value;}catch{return null;}
}
/** A present but unknown stable ID must never fall back to a reused slug. */
export function studioEventDishId(event:Event,dishes:readonly Dish[]):string|null {
 if(typeof event.dish_id==='string'&&event.dish_id)return dishes.some(d=>d.id===event.dish_id)?event.dish_id:null;
 if(Number(event.schema_version)>=2)return null;
 const dish=typeof event.dish_slug==='string'?dishes.find(d=>d.slug===event.dish_slug):undefined;
 const created=Date.parse(dish?.createdAt??'');const observed=Date.parse(typeof event.created_at==='string'?event.created_at:'');
 return dish&&Number.isFinite(created)&&Number.isFinite(observed)&&observed>=created?dish.id:null;
}
function parts(timestamp:number,format:Intl.DateTimeFormat){
 const p=Object.fromEntries(format.formatToParts(timestamp).map(x=>[x.type,x.value]));
 const date=`${p.year}-${p.month}-${p.day}`;
 return {date,hour:Number(p.hour),weekday:new Date(`${date}T12:00:00Z`).getUTCDay()};
}
function period(events:Event[],dishes:readonly Dish[],start:string,end:string,format:Intl.DateTimeFormat):Period|null {
 const from=Date.parse(start),to=Date.parse(end);
 if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from||to-from>731*86400000)return null;
 const first=parts(from,format).date,last=parts(to-1,format).date;
 const dates:string[]=[];
 for(let t=Date.parse(`${first}T12:00:00Z`);t<=Date.parse(`${last}T12:00:00Z`);t+=86400000)dates.push(new Date(t).toISOString().slice(0,10));
 const cells=new Map<string,StudioTemporalCell>();const totals=zero();
 for(const event of events){
  const metric=metrics[event.event_name as keyof typeof metrics];if(!metric)continue;
  const timestamp=typeof event.created_at==='string'?Date.parse(event.created_at):NaN;
  if(!Number.isFinite(timestamp)||timestamp<from||timestamp>=to)continue;
  const clock=parts(timestamp,format);const dishId=studioEventDishId(event,dishes);
  const dish=dishId?dishes.find(d=>d.id===dishId):undefined;
  // Only dish-attributed metrics may participate in category filters.
  const categorySlug=dish?.categorySlug??(typeof event.category_slug==='string'&&dishId?event.category_slug:null);
  const key=JSON.stringify([dishId,categorySlug,clock.date,clock.hour]);
  const cell=cells.get(key)??{...zero(),dishId,categorySlug,...clock};cell[metric]++;totals[metric]++;cells.set(key,cell);
 }
 return {cells:[...cells.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.hour-b.hour),dates,totals};
}
export function buildStudioTemporalAnalytics(input:{dishes:readonly Dish[];window:Window;timezone:string|null;current:Event[];previous:Event[];sourceComplete:boolean}):StudioTemporalAnalytics {
 if(!input.sourceComplete||input.current.length>12000||input.previous.length>12000)return {kind:'unavailable',reason:'incomplete-source'};
 const configured=configuredStudioTimezone({timezone:input.timezone});const timezone=configured??'UTC';
 const format=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
 const current=period(input.current,input.dishes,input.window.startInclusive,input.window.endExclusive,format);
 const prior=period(input.previous,input.dishes,input.window.comparisonStartInclusive,input.window.comparisonEndExclusive,format);
 if(!current||!prior)return {kind:'unavailable',reason:'invalid-window'};
 const compatible=Date.parse(input.window.endExclusive)-Date.parse(input.window.startInclusive)===Date.parse(input.window.comparisonEndExclusive)-Date.parse(input.window.comparisonStartInclusive);
 const previous=compatible&&prior.cells.length?prior:null;
 return {kind:'available',windowBasis:'UTC',timezone,timezoneSource:configured?'configured':'utc-fallback',current,previous,comparison:previous?'observed':'unobserved'};
}
export type StudioTemporalMetric=keyof StudioMetricCounts|'immersive';
export function selectStudioTemporalMetrics(data:StudioTemporalAnalytics|undefined,selection:{dishId?:string;dishIds?:string[];categorySlug?:string;metric:StudioTemporalMetric}) {
 const scope=selection.metric==='menu'||selection.metric==='searches'?'menu':selection.dishId?'dish':selection.dishIds!==undefined||selection.categorySlug?'category':'menu';
 const value=(row:StudioMetricCounts)=>selection.metric==='immersive'?row.three+row.ar:row[selection.metric];
 const select=(p:Period|null|undefined)=>{
  if(!p)return null;
  // Evidence for dish-event collection is independent of selected dish/category counts.
  const observed=selection.metric==='menu'?p.totals.menu>0:selection.metric==='searches'?p.totals.searches>0:p.totals.views+p.totals.three+p.totals.ar>0;
  if(!observed)return null;
  const cells=p.cells.filter(c=>scope==='menu'||(scope==='dish'?c.dishId===selection.dishId:selection.dishIds!==undefined?selection.dishIds.includes(c.dishId??''):c.categorySlug===selection.categorySlug));
  const byDate=new Map<string,number>();const byHour=new Map<string,{weekday:number;hour:number;count:number}>();
  for(const cell of cells){const count=value(cell);byDate.set(cell.date,(byDate.get(cell.date)??0)+count);if(!count)continue;const key=`${cell.weekday}:${cell.hour}`;const hour=byHour.get(key)??{weekday:cell.weekday,hour:cell.hour,count:0};hour.count+=count;byHour.set(key,hour);}
  return {daily:p.dates.map(bucket=>({bucket,value:byDate.get(bucket)??0})),hours:[...byHour.values()].sort((a,b)=>a.weekday-b.weekday||a.hour-b.hour),total:cells.reduce((n,c)=>n+value(c),0)};
 };
 const current=select(data?.kind==='available'?data.current:null),previous=select(data?.kind==='available'?data.previous:null);
 return {kind:data?.kind??'unavailable',windowBasis:'UTC' as const,scope,current:current?.daily??[],previous:previous?.daily??[],hours:current?.hours??[],previousHours:previous?.hours??[],total:current?.total??null,previousTotal:previous?.total??null,timezone:data?.kind==='available'?data.timezone:'UTC',timezoneSource:data?.kind==='available'?data.timezoneSource:'utc-fallback'};
}
