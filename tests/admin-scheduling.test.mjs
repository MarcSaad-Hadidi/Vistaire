import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScheduleInput, resolveAvailability } from '../lib/admin/scheduling.ts';
const rule = {type:'weekly',days:[6],start:'22:00',end:'03:00',available:true};
const schedule = {base_available:false,manual_override:null,rules:[rule]};
test('schedule resolves overnight in restaurant timezone, DST repeated hour, exceptions and manual precedence', () => {
 assert.equal(resolveAvailability(schedule,'America/Toronto',new Date('2026-11-01T05:30:00Z')),true);
 assert.equal(resolveAvailability(schedule,'America/Toronto',new Date('2026-11-01T06:30:00Z')),true);
 assert.equal(resolveAvailability(schedule,'America/Toronto',new Date('2026-11-01T08:00:00Z')),false);
 const exception={type:'once',days:[],date:'2026-11-01',start:'00:00',end:'02:00',available:false};
 assert.equal(resolveAvailability({...schedule,rules:[rule,exception]},'America/Toronto',new Date('2026-11-01T05:30:00Z')),false);
 assert.equal(resolveAvailability({...schedule,manual_override:true,rules:[exception]},'America/Toronto',new Date('2026-11-01T05:30:00Z')),true);
});
test('input rejects ambiguous dates/times/timezones and client tenant, permits explicit overnight',()=>{
 const input={dishId:'11111111-1111-4111-8111-111111111111',requestId:'22222222-2222-4222-8222-222222222222',expectedRevision:0,timezone:'America/Toronto',expectedTimezone:null,baseAvailable:false,manualOverride:null,rules:[rule]};
 assert.equal(parseScheduleInput(input).ok,true);
 for(const patch of [{timezone:'Mars/Paris'},{restaurantId:'other'},{rules:[{...rule,start:'25:00'}]},{rules:[{...rule,type:'once',date:'2026-02-30'}]},{rules:[{...rule,days:[0]}]},{expectedRevision:-1}]) assert.equal(parseScheduleInput({...input,...patch}).ok,false);
});

test('schedule persistence is service-only, live QR tenant checked, revision guarded and transactionally audited',async()=>{
 const {readFile,readdir}=await import('node:fs/promises');
 const files=await readdir(new URL('../supabase/migrations/',import.meta.url));
 const name=files.find(n=>n.endsWith('_admin_dish_scheduling.sql'));
 assert.ok(name,'scheduling migration exists');
 const sql=await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8');
 assert.match(sql,/enable row level security/);
 assert.match(sql,/from public, anon, authenticated/);
 assert.match(sql,/qr\.restaurant_id = p_restaurant_id/);
 assert.match(sql,/qr\.target_path = '\/admin'/);
 assert.match(sql,/revision <> p_expected_revision/);
 assert.match(sql,/errcode = '40001'/);
 assert.match(sql,/create trigger menu_dish_change_history/);
 assert.match(sql,/create trigger menu_version_change_history/);
 assert.match(sql,/request_id = p_request_id/);
});
