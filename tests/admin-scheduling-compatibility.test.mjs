import test from 'node:test';
import assert from 'node:assert/strict';
import { mutateAvailabilityWithSchedulingFallback } from '../lib/admin/schedulingAvailability.ts';
test('availability uses legacy RPC only for explicitly missing new RPC during rollout',async()=>{
 const committed={data:{dish_id:'dish'},error:null};
 for(const error of [{code:'PGRST202',message:'Could not find the function public.set_admin_dish_manual_availability in the schema cache'},{code:'42883',message:'function public.set_admin_dish_manual_availability(uuid, uuid, uuid, boolean) does not exist'}]){
  const calls=[];
  const result=await mutateAvailabilityWithSchedulingFallback(async name=>{calls.push(name);return calls.length===1?{data:null,error}:committed;});
  assert.deepEqual(calls,['set_admin_dish_manual_availability','set_admin_dish_availability']);assert.equal(result,committed);
 }
 for(const error of [null,{code:'42501',message:'permission denied'},{code:'40001',message:'conflict'},{code:'PGRST202',message:'Could not find another_function'},{code:'08006',message:'connection lost'}]){
  const calls=[];const outcome={data:error?null:{dish_id:'dish'},error};
  assert.equal(await mutateAvailabilityWithSchedulingFallback(async name=>{calls.push(name);return outcome;}),outcome);
  assert.deepEqual(calls,['set_admin_dish_manual_availability']);
 }
});
