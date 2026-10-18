import { studioEventDishId } from './studioTemporalData.ts';
type Event=Record<string,unknown>;
type Dish={id:string;slug:string;createdAt?:string|null};
export type StudioEngagementPeriod={
 v2Events:number;
 activeSessionMs:number|null;activeDishMs:number|null;activeModelMs:number|null;
 dishDwell:{dishId:string|null;activeMs:number;samples:number}[];
 search:{results:number;noResults:number}|null;
 model:{attempts:number;succeeded:number;failed:number;unknown:number;unmatchedOutcomes:number;meanSuccessfulLoadMs:number|null}|null;
 ar:{launchIntents:number;observableOutcomes:number;unknownOutcomes:number;outcomes:Record<string,number>}|null;
};
export type StudioEngagementAnalytics={kind:'available';definition:'active-visible-v2';current:StudioEngagementPeriod;previous:StudioEngagementPeriod}|{kind:'unavailable';reason:'incomplete-source'};
const metadata=(row:Event):Record<string,unknown>=>row.metadata&&typeof row.metadata==='object'&&!Array.isArray(row.metadata)?row.metadata as Record<string,unknown>:{};
const number=(value:unknown,max:number)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=max?value:null;
const outcomeNames=new Set(['launched','unsupported','failed','presenting','exited','unknown','session-started','object-placed','ended']);
function aggregate(input:Event[],dishes:readonly Dish[]):StudioEngagementPeriod{
 const events=input.filter(row=>row.schema_version===2);
 const duration=(name:string)=>{const values=events.filter(row=>row.event_name===name).map(row=>number(metadata(row).durationMs,1800000)).filter((n):n is number=>n!==null);return values.length?values.reduce((n,v)=>n+v,0):null;};
 const dwell=new Map<string|null,{dishId:string|null;activeMs:number;samples:number}>();
 for(const row of events){if(row.event_name!=='dish_dwell')continue;const value=number(metadata(row).durationMs,1800000);if(value===null)continue;const dishId=studioEventDishId(row,dishes);const item=dwell.get(dishId)??{dishId,activeMs:0,samples:0};item.activeMs+=value;item.samples++;dwell.set(dishId,item);}
 const searches=events.filter(row=>row.event_name==='search_results').map(row=>number(metadata(row).resultCount,500)).filter((n):n is number=>n!==null);
 // Correlation requires a session, stable attempt token, and observable sequence order.
 // The private keys are discarded after aggregation.
 const key=(row:Event)=>typeof row.session_id==='string'&&row.session_id&&typeof metadata(row).modelAttemptId==='string'&&metadata(row).modelAttemptId?JSON.stringify([row.session_id,row.dish_id??null,metadata(row).modelAttemptId]):null;
 const starts=new Map<string,Event>();
 for(const row of events){const k=key(row);if(row.event_name!=='model_load_started'||!k||!Number.isInteger(row.sequence))continue;const existing=starts.get(k);if(!existing||Number(row.sequence)<Number(existing.sequence))starts.set(k,row);}
 const terminal=new Map<string,Event>();let unmatchedOutcomes=0;
 const outcomes=events.filter(row=>row.event_name==='model_load_succeeded'||row.event_name==='model_load_failed').sort((a,b)=>Number(a.sequence)-Number(b.sequence));
 for(const row of outcomes){const k=key(row);const start=k?starts.get(k):undefined;if(!k||!start||!Number.isInteger(row.sequence)||Number(row.sequence)<=Number(start.sequence)){unmatchedOutcomes++;continue;}if(!terminal.has(k))terminal.set(k,row);}
 const succeeded=[...terminal.values()].filter(row=>row.event_name==='model_load_succeeded');
 const loads=succeeded.map(row=>number(metadata(row).loadDurationMs,120000)).filter((n):n is number=>n!==null);
 const arRows=events.filter(row=>row.event_name==='ar_outcome'&&outcomeNames.has(String(metadata(row).outcome)));
 const arCounts:Record<string,number>={};for(const row of arRows){const name=String(metadata(row).outcome);arCounts[name]=(arCounts[name]??0)+1;}
 return {v2Events:events.length,activeSessionMs:duration('session_duration'),activeDishMs:duration('dish_dwell'),activeModelMs:duration('model_active_duration'),dishDwell:[...dwell.values()],search:searches.length?{results:searches.length,noResults:searches.filter(n=>n===0).length}:null,model:starts.size||outcomes.length?{attempts:starts.size,succeeded:succeeded.length,failed:terminal.size-succeeded.length,unknown:starts.size-terminal.size,unmatchedOutcomes,meanSuccessfulLoadMs:loads.length?loads.reduce((n,v)=>n+v,0)/loads.length:null}:null,ar:arRows.length?{launchIntents:arCounts.launched??0,observableOutcomes:arRows.filter(row=>!['launched','unknown'].includes(String(metadata(row).outcome))).length,unknownOutcomes:arCounts.unknown??0,outcomes:arCounts}:null};
}
/** Aggregate only complete restaurant/menu/environment-scoped reads. No conversion or sale claims. */
export function buildStudioEngagementAnalytics(input:{current:Event[];previous:Event[];sourceComplete:boolean;dishes:readonly Dish[]}):StudioEngagementAnalytics{
 if(!input.sourceComplete||input.current.length>12000||input.previous.length>12000)return {kind:'unavailable',reason:'incomplete-source'};
 return {kind:'available',definition:'active-visible-v2',current:aggregate(input.current,input.dishes),previous:aggregate(input.previous,input.dishes)};
}
