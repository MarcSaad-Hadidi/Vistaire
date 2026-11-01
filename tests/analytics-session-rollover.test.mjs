import test from 'node:test';
import assert from 'node:assert/strict';
const menu = {source:'supabase',restaurantId:'11111111-1111-4111-8111-111111111112',menuId:'22222222-2222-4222-8222-222222222223'};
test('visible public session rollover initializes before direct model events, once and within cap', async () => {
 const client = await import('../lib/analytics/client.ts?rollover');
 const previous = {window:globalThis.window,fetch:globalThis.fetch,now:Date.now};
 let now=2_000_000, visible=true; const sent=[],storage=new Map();
 Date.now=()=>now;
 globalThis.window={innerWidth:390, localStorage: { getItem: () => '{"version":1,"analytics":true}' },sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
 globalThis.fetch=async(_,options)=>{sent.push(JSON.parse(options.body));return {ok:true}};
 try {
  const stop=client.registerPublicMenuVisibility(menu,{slug:'sole',categorySlug:'mains'},()=>visible);
  const event=()=>client.trackMenuEvent({...client.getPublicMenuAnalyticsContext(menu),eventName:'model_active_duration',dishSlug:'sole',metadata:{durationMs:100}});
  event(); event();
  assert.deepEqual(sent.map(e=>e.eventName),['session_started','dish_opened','model_active_duration','model_active_duration']);
  now+=1_800_001; event();
  const second=sent.at(-1).sessionId;
  assert.notEqual(second,sent[0].sessionId);
  assert.deepEqual(sent.filter(e=>e.sessionId===second).map(e=>e.eventName),['session_started','dish_opened','model_active_duration']);
  const key='vistaire.analytics.sessionId.v2',saved=JSON.parse(storage.get(key)); saved.sequence=3599;storage.set(key,JSON.stringify(saved));
  event(); const third=sent.at(-1).sessionId;
  assert.notEqual(third,second);
  assert.deepEqual(sent.filter(e=>e.sessionId===third).map(e=>[e.eventName,e.sequence]),[['session_started',1],['dish_opened',2],['model_active_duration',3]]);
  visible=false;now+=1_800_001;const beforeHidden=sent.length;const sessionBeforeHidden=storage.get(key);event();
  assert.equal(sent.length,beforeHidden);assert.equal(storage.get(key),sessionBeforeHidden);
  assert.equal(sent.filter(e=>e.eventName==='session_started').length,3);
  visible=true; event();event();
  assert.equal(sent.filter(e=>e.eventName==='session_started').length,4);
  assert.equal(sent.filter(e=>e.eventName==='dish_opened').length,4);
  stop();
 } finally {globalThis.window=previous.window;globalThis.fetch=previous.fetch;Date.now=previous.now;}
});

test('hidden or revoked collection cannot consume initialization; rate-limited arrival retries', async () => {
 const client=await import('../lib/analytics/client.ts?privacy-rollover');
 const old={window:globalThis.window,fetch:globalThis.fetch,now:Date.now,disabled:process.env.NEXT_PUBLIC_ANALYTICS_DISABLED};
 let now=10_000_000,visible=false;const sent=[],storage=new Map();Date.now=()=>now;
 globalThis.window={innerWidth:390, localStorage: { getItem: () => '{"version":1,"analytics":true}' },sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
 globalThis.fetch=async(_,o)=>{sent.push(JSON.parse(o.body));return {ok:true}};
 try {
  process.env.NEXT_PUBLIC_ANALYTICS_DISABLED='true';
  client.trackPublicMenuSessionStarted(menu);
  assert.equal(storage.size,0);assert.equal(sent.length,0);
  process.env.NEXT_PUBLIC_ANALYTICS_DISABLED='false';
  for(let i=0;i<120;i++)client.trackPublicMenuEvent(menu,{eventName:'session_duration',metadata:{durationMs:1}});
  assert.equal(sent.filter(e=>e.eventName==='session_started').length,0);
  const stop=client.registerPublicMenuVisibility(menu,undefined,()=>visible);
  visible=true;
  client.trackPublicMenuEvent(menu,{eventName:'menu_opened'});
  assert.equal(JSON.parse([...storage.values()][0]).started,undefined);
  now+=60_001;
  client.trackPublicMenuEvent(menu,{eventName:'menu_opened'});
  client.trackPublicMenuEvent(menu,{eventName:'menu_opened'});
  assert.deepEqual(sent.slice(120).map(e=>e.eventName),['session_started','menu_opened']);
  stop();now+=1_800_001;client.trackPublicMenuEvent(menu,{eventName:'session_duration',metadata:{durationMs:1}});
  assert.equal(sent.filter(e=>e.eventName==='session_started').length,1);
 } finally {globalThis.window=old.window;globalThis.fetch=old.fetch;Date.now=old.now;if(old.disabled===undefined)delete process.env.NEXT_PUBLIC_ANALYTICS_DISABLED;else process.env.NEXT_PUBLIC_ANALYTICS_DISABLED=old.disabled;}
});

test('overlaid detail, repeated visits, demo identity and advancing-clock batches retain correct openings', async () => {
 const client=await import('../lib/analytics/client.ts?overlays');
 const old={window:globalThis.window,fetch:globalThis.fetch,now:Date.now};let now=20_000_000;const sent=[],storage=new Map();
 Date.now=()=>now;
 globalThis.window={innerWidth:390, localStorage: { getItem: () => '{"version":1,"analytics":true}' },sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
 globalThis.fetch=async(_,o)=>{sent.push(JSON.parse(o.body));return {ok:true}};
 try {
  const stops=[client.registerPublicMenuVisibility(menu,undefined,()=>true)];
  const dish={slug:'sole'},scope={};let stop=client.registerPublicMenuVisibility(menu,dish,()=>true,scope);
  const open=()=>client.trackPublicMenuEvent(menu,{eventName:'dish_opened',dishSlug:'sole'});
  open();open();assert.deepEqual(sent.map(e=>e.eventName),['session_started','dish_opened']);
  stop();stop=client.registerPublicMenuVisibility(menu,dish,()=>true,scope);now+=1001;open();
  assert.equal(sent.filter(e=>e.eventName==='dish_opened').length,1,'same mounted identity effect rerun');
  stop();stop=client.registerPublicMenuVisibility(menu,dish,()=>true);now+=1001;open();
  assert.equal(sent.filter(e=>e.eventName==='dish_opened').length,2,'genuine revisit');
  assert.equal(sent.filter(e=>e.eventName==='session_started').length,1);
  const stored=JSON.parse([...storage.values()][0]);now=stored.expires-1;Date.now=()=>now++;
  stop();stop=client.registerPublicMenuVisibility(menu,dish,()=>true);
  client.trackPublicMenuEvent(menu,{eventName:'model_active_duration',dishSlug:'sole',metadata:{durationMs:10}});
  const batch=sent.slice(-2);assert.deepEqual(batch.map(e=>e.eventName),['dish_opened','model_active_duration']);
  assert.equal(batch[0].sessionId,batch[1].sessionId,'expiry crossing inside batch cannot split identity');
  stop();stops.forEach(fn=>fn());Date.now=()=>now;
  const a={source:'demo',restaurantId:'demo-a',slug:'sauge-noire'},b={source:'demo',restaurantId:'demo-b',slug:'maison-elyse'};
  const stopA=client.registerPublicMenuVisibility(a,undefined,()=>true),stopB=client.registerPublicMenuVisibility(b,undefined,()=>true);
  client.trackPublicMenuEvent(b,{eventName:'menu_opened'});
  assert.equal(sent.at(-1).metadata.demoMenu,'maison-elyse');
  assert.equal(sent.filter(e=>e.eventName==='session_started'&&e.metadata.demoMenu==='sauge-noire').length,0);
  stopA();stopB();
 }finally {globalThis.window=old.window;globalThis.fetch=old.fetch;Date.now=old.now;}
});
test('withdrawing analytics consent ends the in-memory session, so a later acceptance starts a new one', async () => {
 const client = await import('../lib/analytics/client.ts?withdrawal');
 const { clearVistaireAnalyticsSession } = await import('../lib/privacy/consent.ts');
 const previous = {window:globalThis.window,fetch:globalThis.fetch};
 const sent=[],storage=new Map();
 globalThis.window={innerWidth:390, localStorage: { getItem: () => '{"version":1,"analytics":true}' },sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};
 globalThis.fetch=async(_,options)=>{sent.push(JSON.parse(options.body));return {ok:true}};
 try {
  const event=()=>client.trackPublicMenuEvent(menu,{eventName:'menu_opened'});
  event();
  const first=sent.at(-1).sessionId;
  clearVistaireAnalyticsSession();
  event();
  assert.ok(first);
  assert.notEqual(sent.at(-1).sessionId,first);
 } finally {globalThis.window=previous.window;globalThis.fetch=previous.fetch;}
});
test('a first acceptance does not resume a session recorded before consent existed', async () => {
 const client = await import('../lib/analytics/client.ts?first-acceptance');
 const { writePrivacyConsent } = await import('../lib/privacy/consent.ts');
 const previous = {window:globalThis.window,fetch:globalThis.fetch};
 const legacyId='11111111-2222-4333-8444-555555555555';
 const session=new Map([['vistaire.analytics.sessionId.v2',JSON.stringify({id:legacyId,expires:Date.now()+600000,sequence:4,started:['legacy']})]]);
 const local=new Map();const sent=[];
 globalThis.window={innerWidth:390,dispatchEvent:()=>true,
  localStorage:{getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v)},
  sessionStorage:{getItem:k=>session.get(k),setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)}};
 globalThis.fetch=async(_,options)=>{sent.push(JSON.parse(options.body));return {ok:true}};
 try {
  writePrivacyConsent(true);
  client.trackPublicMenuEvent(menu,{eventName:'menu_opened'});
  assert.ok(sent.length > 0);
  assert.ok(sent.every((event)=>event.sessionId!==legacyId), 'pre-consent session must not be reused');
 } finally {globalThis.window=previous.window;globalThis.fetch=previous.fetch;}
});
