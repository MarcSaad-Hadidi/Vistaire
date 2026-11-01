import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAnalyticsEvent } from '../lib/analytics/validationCore.mjs';
const base = {eventName:'menu_opened', restaurantId:'11111111-1111-1111-1111-111111111111',menuId:'22222222-2222-2222-2222-222222222222',sessionId:'33333333-3333-4333-8333-333333333333',source:'production'};
const v2 = {...base,schemaVersion:2,sequence:1,eventId:'44444444-4444-4444-8444-444444444444'};
test('v2 events retain only bounded allowlisted measurements and require dedup identity',()=>{
 const result=validateAnalyticsEvent({...v2,eventName:'search_results',metadata:{resultCount:0,queryLengthBucket:'4-10',locale:'fr',url:'https://private',query:'private',campaign:'private',deviceClass:'mobile'}});
 assert.equal(result.ok,true);
 assert.deepEqual(result.payload.metadata,{resultCount:0,queryLengthBucket:'4-10',locale:'fr',deviceClass:'mobile'});
 assert.equal(validateAnalyticsEvent({...v2,eventId:undefined}).ok,false);
 assert.equal(validateAnalyticsEvent({...v2,eventName:'dish_dwell',dishSlug:'sole',metadata:{durationMs:1800001}}).ok,false);
 assert.equal(validateAnalyticsEvent({...v2,eventName:'model_load_succeeded',dishSlug:'sole',metadata:{loadDurationMs:100}}).ok,true);
});
test('legacy events remain countable without retaining raw searches, viewport or arbitrary identifiers',()=>{
 const result=validateAnalyticsEvent({...base,eventName:'search_used',searchQuery:'private medical details',viewport:{width:390,height:844},metadata:{durationMs:12,referrer:'secret',nested:{email:'a@b.com'}}});
 assert.equal(result.ok,true);
 assert.equal(result.payload.searchQuery,undefined);
 assert.equal(result.payload.viewport,undefined);
 assert.deepEqual(result.payload.metadata,{durationMs:12});
 assert.equal(validateAnalyticsEvent({...base,sessionId:'person@example.com'}).ok,false);
 assert.equal(validateAnalyticsEvent({...v2,schemaVersion:3}).ok,false);
});
test('client emits v2 opaque IDs and safe measurements without raw browser/search data',async()=>{
 const sent=[];const oldWindow=globalThis.window,oldFetch=globalThis.fetch;const storage=new Map();
 globalThis.window={innerWidth:390, localStorage: { getItem: () => '{"version":1,"analytics":true}' },sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},location:{search:'?placement=table&source=qr&campaign=person@example.com'}};
 globalThis.fetch=async(_,o)=>{sent.push(JSON.parse(o.body));return {ok:true}};
 try {const {trackMenuEvent}=await import('../lib/analytics/client.ts');trackMenuEvent({...base,eventName:'search_used',searchQuery:'private query',metadata:{url:'secret'}});
 assert.equal(sent.length,1);assert.equal(sent[0].schemaVersion,2);assert.match(sent[0].eventId,/^[a-f0-9-]{36}$/);assert.equal(sent[0].searchQuery,undefined);assert.equal(sent[0].viewport,undefined);assert.equal(sent[0].metadata.placement,'table');assert.equal(sent[0].metadata.campaign,undefined);assert.equal(sent[0].metadata.queryLengthBucket,'11-30');
 }finally{globalThis.window=oldWindow;globalThis.fetch=oldFetch;}
});
test('lifecycle measurements cannot claim outcomes without bounded evidence',()=>{
 for (const [eventName,metadata] of [['search_results',{}],['model_load_succeeded',{}],['model_load_failed',{}],['model_interacted',{}],['ar_outcome',{}],['locale_changed',{}]]) assert.equal(validateAnalyticsEvent({...v2,eventName,dishSlug:'sole',metadata}).ok,false,eventName);
});
test('legacy session elapsed durations keep their original bound and are not reclassified as active',()=>{
 const result=validateAnalyticsEvent({...base,eventName:'session_duration',metadata:{durationMs:3600000}});
 assert.equal(result.ok,true);assert.equal(result.payload.schemaVersion,1);assert.equal(result.payload.metadata.durationMs,3600000);
 assert.equal(validateAnalyticsEvent({...v2,eventName:'session_duration',metadata:{durationMs:3600000}}).ok,false);
});
test('synthetic demo context is isolated and duration deltas are never suppressed',async()=>{
 const {getPublicMenuAnalyticsContext,trackMenuEvent}=await import('../lib/analytics/client.ts');
 assert.equal(getPublicMenuAnalyticsContext({source:'demo',restaurantId:'trouvable-demo'}).source,'demo');
 assert.equal(getPublicMenuAnalyticsContext({source:'supabase',restaurantId:'trouvable-demo'}),null);
 const sent=[],oldWindow=globalThis.window,oldFetch=globalThis.fetch;
 globalThis.window={innerWidth:390, localStorage: { getItem: () => '{"version":1,"analytics":true}' },sessionStorage:{getItem:()=>null,setItem:()=>{}}};globalThis.fetch=async(_,o)=>{sent.push(JSON.parse(o.body));return {ok:true}};
 try {for(let i=0;i<2;i++) trackMenuEvent({...base,eventName:'session_duration',metadata:{durationMs:100}});
 assert.equal(sent.filter(e=>e.eventName==='session_duration').length,2);
 }finally{globalThis.window=oldWindow;globalThis.fetch=oldFetch}
});
test('session arrival is recorded once per tenant and accepts only known demo labels',async()=>{
 const client=await import('../lib/analytics/client.ts');assert.equal(typeof client.trackPublicMenuSessionStarted,'function');
 const sent=[],oldWindow=globalThis.window,oldFetch=globalThis.fetch;
 globalThis.window={innerWidth:390, localStorage: { getItem: () => '{"version":1,"analytics":true}' },sessionStorage:{getItem:()=>null,setItem:()=>{}}};globalThis.fetch=async(_,o)=>{sent.push(JSON.parse(o.body));return {ok:true}};
 try {const menu={source:'demo',restaurantId:'trouvable-demo',slug:'le-trouvable'};
 client.trackPublicMenuSessionStarted(menu);client.trackPublicMenuSessionStarted(menu);
 assert.equal(sent.filter(e=>e.eventName==='session_started').length,1);assert.equal(sent[0].metadata.demoMenu,'le-trouvable');
 assert.equal(validateAnalyticsEvent({...v2,metadata:{demoMenu:'private-user'}}).payload.metadata.demoMenu,undefined);
 }finally{globalThis.window=oldWindow;globalThis.fetch=oldFetch}
});
test('distinct AR outcomes inside one second remain distinct',async()=>{
 const {trackMenuEvent}=await import('../lib/analytics/client.ts');const sent=[],oldWindow=globalThis.window,oldFetch=globalThis.fetch;
 globalThis.window={innerWidth:390, localStorage: { getItem: () => '{"version":1,"analytics":true}' },sessionStorage:{getItem:()=>null,setItem:()=>{}}};globalThis.fetch=async(_,o)=>{sent.push(JSON.parse(o.body));return {ok:true}};
 try {for(const outcome of ['unknown','presenting'])trackMenuEvent({...base,eventName:'ar_outcome',dishSlug:'sole',metadata:{outcome}});assert.equal(sent.length,2)}finally{globalThis.window=oldWindow;globalThis.fetch=oldFetch}
});

test('v2 journey ordering and model attempt correlation are bounded',()=>{
 assert.equal(validateAnalyticsEvent({...v2,sequence:undefined}).ok,false);
 assert.equal(validateAnalyticsEvent({...v2,sequence:3601}).ok,false);
 const result=validateAnalyticsEvent({...v2,metadata:{modelAttemptId:v2.eventId}});
 assert.equal(result.payload.sequence,1);assert.equal(result.payload.metadata.modelAttemptId,v2.eventId);
 assert.equal(validateAnalyticsEvent({...v2,metadata:{modelAttemptId:'person@example.com'}}).payload.metadata.modelAttemptId,undefined);
});
test('session arrival deduplication and event sequence survive page reload within the short session',async()=>{
 const sent=[],store=new Map(),oldWindow=globalThis.window,oldFetch=globalThis.fetch;
 globalThis.window={innerWidth:390, localStorage: { getItem: () => '{"version":1,"analytics":true}' },sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)}};globalThis.fetch=async(_,o)=>{sent.push(JSON.parse(o.body));return {ok:true}};
 try {const menu={source:'supabase',restaurantId:base.restaurantId,menuId:base.menuId};
 const first=await import('../lib/analytics/client.ts?first-page');first.trackPublicMenuSessionStarted(menu);
 const next=await import('../lib/analytics/client.ts?next-page');next.trackPublicMenuSessionStarted(menu);next.trackPublicMenuEvent(menu,{eventName:'menu_opened'});
 assert.equal(sent.filter(e=>e.eventName==='session_started').length,1);assert.deepEqual(sent.map(e=>e.sequence),[1,2]);
 }finally{globalThis.window=oldWindow;globalThis.fetch=oldFetch}
});
test('new event vocabulary cannot bypass v2 deduplication using a legacy envelope',()=>{
 assert.equal(validateAnalyticsEvent({...base,eventName:'menu_list_viewed'}).ok,false);
 assert.equal(validateAnalyticsEvent({...base,eventName:'menu_opened'}).ok,true);
});
test('rolling deployment fallback is limited to legacy baseline and confirmed missing v2 columns', async()=>{
 const {canRetryLegacyAnalyticsInsert}=await import('../lib/analytics/validationCore.mjs');
 assert.equal(typeof canRetryLegacyAnalyticsInsert,'function');
 const missing={code:'PGRST204',message:"Could not find the 'schema_version' column of 'analytics_events' in the schema cache"};
 assert.equal(canRetryLegacyAnalyticsInsert({...base,schemaVersion:1,environment:'production'},missing),true);
 assert.equal(canRetryLegacyAnalyticsInsert({...base,source:'demo',environment:'preview'},missing),true);
 assert.equal(canRetryLegacyAnalyticsInsert({...base,environment:'preview'},missing),false);
 assert.equal(canRetryLegacyAnalyticsInsert({...v2,environment:'production'},missing),false);
 assert.equal(canRetryLegacyAnalyticsInsert({...base,eventName:'dish_visible',environment:'production'},missing),false);
 assert.equal(canRetryLegacyAnalyticsInsert({...base,environment:'production'},{code:'23505',message:'duplicate event_id'}),false);
 assert.equal(canRetryLegacyAnalyticsInsert({...base,environment:'production'},{code:'42703',message:'column dish_id does not exist'}),false);
});
test('public QR attribution never propagates credentials or admin identities and requires server scope', async()=>{
 const core=await import('../lib/analytics/validationCore.mjs');
 assert.equal(typeof core.publicQrAttributionPath,'function');
 const qrId='55555555-5555-4555-8555-555555555555';
 assert.equal(core.publicQrAttributionPath({targetKind:'menu',targetPath:'/menu/maison-elyse?lang=en',qrId}),`/menu/maison-elyse?lang=en&source=qr&qrId=${qrId}`);
 assert.equal(core.publicQrAttributionPath({targetKind:'admin',targetPath:'/admin',qrId}),'/admin');
 assert.equal(core.publicQrAttributionPath({targetKind:'menu',targetPath:'/demo',qrId:'signed-menu-fallback'}),'/demo');
 const payload={...v2,metadata:{qrId}};
 assert.equal(core.validateAnalyticsEvent(payload).payload.metadata.qrId,qrId);
 assert.equal(await core.validateAnalyticsContext(payload,{menuBelongsToRestaurant:async()=>true,restaurantExists:async()=>true,publicQrBelongsToRestaurant:async()=>false}),false);
 assert.equal(await core.validateAnalyticsContext(payload,{menuBelongsToRestaurant:async()=>true,restaurantExists:async()=>true,publicQrBelongsToRestaurant:async()=>true}),true);
});
test("locale changes accept every canonical menu locale prefix and still strip unknown values", async () => {
  const { PUBLIC_MENU_LOCALE_OPTIONS } = await import("../lib/menu/publicMenuSettings.ts");
  for (const { value } of PUBLIC_MENU_LOCALE_OPTIONS) {
    const locale = value.split("-")[0];
    const result = validateAnalyticsEvent({ ...v2, eventName: "locale_changed", metadata: { locale } });
    assert.equal(result.ok, true, value);
    assert.equal(result.payload.metadata.locale, locale, value);
  }
  assert.equal(validateAnalyticsEvent({
    ...v2,
    eventName: "locale_changed",
    metadata: { locale: "unknown-private-value" }
  }).ok, false);
});
