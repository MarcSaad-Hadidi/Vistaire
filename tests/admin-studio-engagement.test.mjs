import test from 'node:test';
import assert from 'node:assert/strict';
const event=(event_name,metadata={},sequence=1)=>({schema_version:2,event_name,metadata,sequence,session_id:'private-session',dish_id:'a',created_at:'2026-10-18T12:00:00Z'});
test('v2 engagement aggregates active deltas and only matched model outcomes without raw identities',async()=>{
 const {buildStudioEngagementAnalytics}=await import('../lib/admin/studioEngagementData.ts');
 const rows=[event('session_duration',{durationMs:100}),event('dish_dwell',{durationMs:50}),event('model_active_duration',{durationMs:30}),event('search_results',{resultCount:0}),event('search_results',{resultCount:3}),event('model_load_started',{modelAttemptId:'attempt'},2),event('model_load_succeeded',{modelAttemptId:'attempt',loadDurationMs:250},3),event('model_load_failed',{modelAttemptId:'orphan',loadDurationMs:900},4),event('ar_outcome',{outcome:'launched'}),event('ar_outcome',{outcome:'object-placed'}),{...event('session_duration',{durationMs:999}),schema_version:1}];
 const data=buildStudioEngagementAnalytics({current:rows,previous:[],sourceComplete:true,dishes:[{id:'a',slug:'soup'}]});
 assert.equal(data.kind,'available');assert.equal(data.current.activeSessionMs,100);assert.equal(data.current.activeDishMs,50);assert.equal(data.current.activeModelMs,30);
 assert.deepEqual(data.current.search,{results:2,noResults:1});
 assert.deepEqual(data.current.model,{attempts:1,succeeded:1,failed:0,unknown:0,unmatchedOutcomes:1,meanSuccessfulLoadMs:250});
 assert.equal(data.current.ar.outcomes['object-placed'],1);assert.equal(data.current.ar.observableOutcomes,1);assert.equal(data.current.ar.launchIntents,1);
 assert.equal(data.previous.activeSessionMs,null);assert.equal(data.previous.model,null);assert.doesNotMatch(JSON.stringify(data),/private-session|attempt"|orphan/);
});
test('engagement refuses incomplete reads, excludes legacy wall time and does not match reversed/cross-session attempts',async()=>{
 const {buildStudioEngagementAnalytics}=await import('../lib/admin/studioEngagementData.ts');
 const current=[event('model_load_started',{modelAttemptId:'x'},3),event('model_load_succeeded',{modelAttemptId:'x',loadDurationMs:2},2),{...event('model_load_succeeded',{modelAttemptId:'x',loadDurationMs:3},4),session_id:'another'},{...event('session_duration',{durationMs:500}),schema_version:1}];
 const args={current,previous:[],sourceComplete:true,dishes:[]};
 assert.equal(buildStudioEngagementAnalytics({...args,sourceComplete:false}).kind,'unavailable');
 const data=buildStudioEngagementAnalytics(args);assert.equal(data.current.activeSessionMs,null);assert.equal(data.current.model.unknown,1);assert.equal(data.current.model.succeeded,0);assert.equal(data.current.model.unmatchedOutcomes,2);
});
