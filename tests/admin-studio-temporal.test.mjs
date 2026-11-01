import test from 'node:test';
import assert from 'node:assert/strict';
const window = {startInclusive:'2026-11-01T04:00:00Z',endExclusive:'2026-11-03T05:00:00Z',comparisonStartInclusive:'2026-10-30T03:00:00Z',comparisonEndExclusive:'2026-11-01T04:00:00Z'};
const dishes=[{id:'a',slug:'renamed',categorySlug:'starter'},{id:'b',slug:'salad',categorySlug:'main'}];
test('temporal metrics reconcile filtered stable identities, previous 3D/AR and local DST dates',async()=>{
 const {buildStudioTemporalAnalytics,selectStudioTemporalMetrics,configuredStudioTimezone}=await import('../lib/admin/studioTemporalData.ts');
 assert.equal(configuredStudioTimezone({timezone:'America/Toronto'}),'America/Toronto');
 assert.equal(configuredStudioTimezone({timezone:'invented'}),null);
 assert.equal(configuredStudioTimezone({}),null);
 const event=(event_name,dish_id,created_at,dish_slug='old')=>({event_name,dish_id,dish_slug,created_at});
 const data=buildStudioTemporalAnalytics({dishes,window,timezone:'America/Toronto',current:[event('dish_opened','a','2026-11-01T05:30:00Z'),event('dish_3d_clicked','a','2026-11-01T06:30:00Z'),event('dish_ar_clicked','b','2026-11-02T05:30:00Z','salad'),event('dish_opened','deleted','2026-11-01T07:00:00Z','salad'),event('menu_opened',null,'2026-11-01T08:00:00Z')],previous:[event('dish_3d_clicked','a','2026-10-31T12:00:00Z')],sourceComplete:true});
 const all=selectStudioTemporalMetrics(data,{metric:'views'});
 assert.equal(all.total,2);
 const scoped=selectStudioTemporalMetrics(data,{metric:'three',categorySlug:'starter'});
 assert.equal(scoped.total,1);assert.equal(scoped.previousTotal,1);
 assert.deepEqual(scoped.current.map(x=>x.bucket),['2026-11-01','2026-11-02']);
 assert.equal(scoped.current.reduce((n,x)=>n+x.value,0),scoped.total);
 assert.deepEqual(scoped.hours,[{weekday:0,hour:1,count:1}]);
 assert.equal(selectStudioTemporalMetrics(data,{metric:'views',dishId:'b'}).total,0);
 assert.equal(selectStudioTemporalMetrics(data,{metric:'menu',categorySlug:'starter'}).total,1);
 assert.equal(selectStudioTemporalMetrics(data,{metric:'menu',categorySlug:'starter'}).scope,'menu');
});
test('missing history, incomplete source and unproven empty windows never become fabricated coverage',async()=>{
 const {buildStudioTemporalAnalytics,selectStudioTemporalMetrics}=await import('../lib/admin/studioTemporalData.ts');
 const args={dishes,window,current:[],previous:[],timezone:null,sourceComplete:true};
 const data=buildStudioTemporalAnalytics(args);
 assert.equal(data.kind,'available');assert.equal(data.timezone,'UTC');assert.equal(data.timezoneSource,'utc-fallback');assert.equal(data.windowBasis,'UTC');
 const result=selectStudioTemporalMetrics(data,{metric:'ar'});
 assert.equal(result.total,null);assert.equal(result.previousTotal,null);assert.deepEqual(result.current,[]);
 assert.equal(buildStudioTemporalAnalytics({...args,sourceComplete:false}).kind,'unavailable');
 assert.equal(buildStudioTemporalAnalytics({...args,current:Array.from({length:12001},()=>({}))}).kind,'unavailable');
});
test('v2 technical outcomes do not inflate legacy activity counts and read scope excludes preview',async()=>{
 const {buildAdminAnalyticsPanels}=await import('../lib/admin/analyticsPresentation.ts');
 const events=[{event_name:'dish_opened',created_at:'2026-11-01T05:30:00Z'},{event_name:'model_loaded',created_at:'2026-11-01T05:31:00Z'}];
 const panels=buildAdminAnalyticsPanels({currentEvents:events,previousEvents:[],currentDurationMs:1,previousDurationMs:1});
 assert.equal(panels.hourWeekday.data.reduce((n,r)=>n+r.count,0),1);
 const {readFile}=await import('node:fs/promises');
 const source=await readFile('lib/analytics/serverRows.ts','utf8');
 assert.match(source,/\.in\("environment",\s*\["production",\s*"legacy"\]\)/);
});
test('deleted v2 identities and reused legacy slugs remain unattributed without lifetime evidence',async()=>{
 const {studioEventDishId}=await import('../lib/admin/studioTemporalData.ts');
 const dishes=[{id:'new',slug:'salad',createdAt:'2026-10-01T00:00:00Z'}];
 assert.equal(studioEventDishId({schema_version:2,dish_id:null,dish_slug:'salad',created_at:'2026-11-01T00:00:00Z'},dishes),null);
 assert.equal(studioEventDishId({schema_version:1,dish_id:null,dish_slug:'salad',created_at:'2026-09-01T00:00:00Z'},dishes),null);
 assert.equal(studioEventDishId({schema_version:1,dish_id:null,dish_slug:'salad',created_at:'2026-11-01T00:00:00Z'},dishes),'new');
 assert.equal(studioEventDishId({dish_slug:'salad',created_at:'2026-11-01T00:00:00Z'},[{id:'new',slug:'salad'}]),null);
});
test('a category label selection can include several exact dish identities across slugs',async()=>{
 const {buildStudioTemporalAnalytics,selectStudioTemporalMetrics}=await import('../lib/admin/studioTemporalData.ts');
 const data=buildStudioTemporalAnalytics({dishes,window,timezone:null,sourceComplete:true,previous:[],current:[{event_name:'dish_opened',dish_id:'a',created_at:'2026-11-01T06:00:00Z'},{event_name:'dish_opened',dish_id:'b',created_at:'2026-11-01T06:00:00Z'},{event_name:'dish_opened',dish_id:'deleted',created_at:'2026-11-01T06:00:00Z'}]});
 const selected=selectStudioTemporalMetrics(data,{metric:'views',dishIds:['a','b']});
 assert.equal(selected.scope,'category');assert.equal(selected.total,2);
 assert.equal(selectStudioTemporalMetrics(data,{metric:'views',dishIds:[]}).total,0);
});
