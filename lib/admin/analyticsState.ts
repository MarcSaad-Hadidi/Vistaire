import type { AdminObservationWindow } from "./dashboardRange.ts";
import { addComparisonEvidence, type AdminRawMetric } from "./analyticsEvidence.ts";
import { buildAdminAnalyticsPanels, type AdminAnalyticsPanels } from "./analyticsPresentation.ts";

type EventRow = Record<string, unknown>;
type Ranked = { slug: string; count: number };
export type AdminEvidence = { label: string; value: string | number };
export type AdminAnalyticsState =
 | { kind:"real"; completeness:"complete"|"limited-sample"; observationWindow:AdminObservationWindow; panels:AdminAnalyticsPanels; lastUpdatedAt:string|null; freshness:"fresh"|"delayed"|"stale"; coverage:{menuOpened:boolean;dishOpened:boolean}; metrics:ReturnType<typeof addComparisonEvidence>[]; activitySeries:{bucket:string;count:number}[]; categoryBreakdown:Ranked[]; topDishes:Ranked[]; searches:{term:string;count:number}[]; immersive:{name:string;count:number}[]; funnel:{kind:"unsupported"}|{kind:"measured";sessions:number;dishOpened:number;rate:number}; comparison:null|Record<string,unknown> }
 | { kind:"insufficient"; reason:"no-relevant-events"|"sample-too-small"|"instrumentation-unproven"; completeness:"complete"|"limited-sample"; observationWindow:AdminObservationWindow; availableEvidence:AdminEvidence[]; missingEvidence:string[] }
 | { kind:"unavailable"; reason:"configuration"|"database"|"query"; completeness:"truncated"|"partial-source"; title:string; explanation:string; retryable:boolean };
export type AdminAnalyticsInput={observationWindow:AdminObservationWindow;events?:EventRow[];previousEvents?:EventRow[];selectedMenuCategorySlugs?:string[];instrumentationProven?:boolean;eventCount?:number;databaseError?:boolean;queryError?:boolean;truncated?:boolean;partialSource?:boolean;lastUpdatedAt?:string|null;metrics?:AdminRawMetric[]};
const text=(row:EventRow,key:string)=>typeof row[key]==="string"?(row[key] as string):"";
const counts=(values:string[])=>[...values.reduce((map,value)=>value?map.set(value,(map.get(value)??0)+1):map,new Map<string,number>())].map(([slug,count])=>({slug,count})).sort((a,b)=>b.count-a.count||a.slug.localeCompare(b.slug));
export function buildAdminAnalyticsState(input:AdminAnalyticsInput):AdminAnalyticsState{
 if(input.databaseError||input.queryError||input.truncated||input.partialSource)return{kind:"unavailable",reason:input.databaseError?"database":"query",completeness:input.truncated?"truncated":"partial-source",title:"Données indisponibles",explanation:"La lecture est incomplète.",retryable:true};
 const events=input.events??[]; const names=events.map(row=>text(row,"event_name"));
 const menuCount=names.filter(name=>name==="menu_opened").length; const dishCount=names.filter(name=>name==="dish_opened").length;
 const proven=input.events?menuCount>0&&dishCount>0:Boolean(input.instrumentationProven); const relevant=input.events?menuCount+dishCount:(input.eventCount??0);
 if(!proven||relevant===0||relevant<5)return{kind:"insufficient",reason:!proven?"instrumentation-unproven":relevant===0?"no-relevant-events":"sample-too-small",completeness:relevant>0?"limited-sample":"complete",observationWindow:input.observationWindow,availableEvidence:[],missingEvidence:!proven?["menu_opened","dish_opened"]:[]};
 const buckets=counts(events.map(row=>text(row,"created_at").slice(0,10))).map(({slug,count})=>({bucket:slug,count})).sort((a,b)=>a.bucket.localeCompare(b.bucket));
 const rankedDishes=dishCount>=20?counts(events.filter(row=>text(row,"event_name")==="dish_opened").map(row=>text(row,"dish_slug"))).filter(item=>item.count>=5):[];
 const categories=dishCount>=20?counts(events.filter(row=>text(row,"event_name")==="dish_opened").map(row=>text(row,"category_slug"))).filter(item=>item.count>=5):[];
 const searchCounts=counts(events.filter(row=>text(row,"event_name")==="search_used").map(row=>text(row,"search_query").trim().toLocaleLowerCase("fr-CA")).filter(term=>term&&!/@|\d{4,}/.test(term))).filter(item=>item.count>=3).map(({slug,count})=>({term:slug,count}));
 const immersive=["dish_3d_clicked","dish_ar_clicked"].map(name=>({name,count:names.filter(value=>value===name).length}));
 const sessions=new Map<string,{menu:number;dish:number}>(); events.forEach((row,index)=>{const id=text(row,"session_id");if(!id)return;const state=sessions.get(id)??{menu:Infinity,dish:Infinity};if(text(row,"event_name")==="menu_opened")state.menu=Math.min(state.menu,index);if(text(row,"event_name")==="dish_opened")state.dish=Math.min(state.dish,index);sessions.set(id,state)}); const qualifying=[...sessions.values()].filter(s=>Number.isFinite(s.menu)); const converted=qualifying.filter(s=>Number.isFinite(s.dish)&&s.menu<s.dish).length;
 const last=input.lastUpdatedAt??events.map(row=>text(row,"created_at")).sort().at(-1)??null; const age=last?Date.now()-new Date(last).getTime():Infinity;
 const currentDurationMs=Date.parse(input.observationWindow.endExclusive)-Date.parse(input.observationWindow.startInclusive); const previousDurationMs=Date.parse(input.observationWindow.comparisonEndExclusive)-Date.parse(input.observationWindow.comparisonStartInclusive);
 return{kind:"real",completeness:relevant<20?"limited-sample":"complete",observationWindow:input.observationWindow,panels:buildAdminAnalyticsPanels({currentEvents:events,previousEvents:input.previousEvents??[],currentDurationMs,previousDurationMs,selectedMenuCategorySlugs:input.selectedMenuCategorySlugs}),lastUpdatedAt:last,freshness:age<=3600000?"fresh":age<=86400000?"delayed":"stale",coverage:{menuOpened:menuCount>0||proven,dishOpened:dishCount>0||proven},metrics:(input.metrics??[{id:"menu-opens",value:menuCount},{id:"dish-opens",value:dishCount}]).map(addComparisonEvidence),activitySeries:buckets,categoryBreakdown:categories,topDishes:rankedDishes,searches:searchCounts,immersive,funnel:qualifying.length>=20?{kind:"measured",sessions:qualifying.length,dishOpened:converted,rate:converted/qualifying.length}:{kind:"unsupported"},comparison:null};
}
