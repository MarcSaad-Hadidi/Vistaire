select public.schedule_admin_dish_availability(
  'a1100000-0000-4000-8000-000000000031','a1100000-0000-4000-8000-000000000001',
  'a1100000-0000-4000-8000-000000000011','a1100000-0000-4000-8000-000000000021',true,
  now()+interval '2 hours','America/Toronto','availability-idempotency-0001','service du soir');
select public.schedule_admin_dish_availability(
  'a1100000-0000-4000-8000-000000000031','a1100000-0000-4000-8000-000000000001',
  'a1100000-0000-4000-8000-000000000011','a1100000-0000-4000-8000-000000000021',true,
  now()+interval '2 hours','America/Toronto','availability-idempotency-0001','service du soir');
select pg_temp.assert_true((select count(*)=1 from public.admin_dish_availability_schedules where idempotency_key='availability-idempotency-0001'),'idempotency returns one schedule');
select pg_temp.assert_true(not public.cancel_admin_dish_availability('a1100000-0000-4000-8000-000000000031','a1100000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000022',(select id from public.admin_dish_availability_schedules where idempotency_key='availability-idempotency-0001')),'cancel rejects a different dish');
select pg_temp.assert_true(public.cancel_admin_dish_availability('a1100000-0000-4000-8000-000000000031','a1100000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000021',(select id from public.admin_dish_availability_schedules where idempotency_key='availability-idempotency-0001')),'cancel accepts scoped dish');

insert into public.admin_dish_availability_schedules(restaurant_id,menu_id,dish_id,final_available,scheduled_for,timezone,idempotency_key,requester_qr_id)
values('a1100000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000011','a1100000-0000-4000-8000-000000000021',false,now()-interval '1 minute','America/Toronto','availability-due-0000001','a1100000-0000-4000-8000-000000000031');
select public.mark_admin_availability_worker_attempt('primary');
select pg_temp.assert_true(public.run_due_admin_dish_availability('primary',25)=1,'one due schedule applied');
select pg_temp.assert_true((select status='applied' and attempts=1 from public.admin_dish_availability_schedules where idempotency_key='availability-due-0000001'),'pending becomes applied');
select pg_temp.assert_true((select is_available=false from public.menu_dishes where id='a1100000-0000-4000-8000-000000000021'),'dish final state applied');
select pg_temp.assert_true((select count(*)=1 from public.admin_dish_availability_events where schedule_id=(select id from public.admin_dish_availability_schedules where idempotency_key='availability-due-0000001')),'worker audit is atomic');

create or replace function pg_temp.reject_availability_update() returns trigger language plpgsql as $$ begin if new.id='a1100000-0000-4000-8000-000000000022'::uuid then raise exception 'fixture update failure'; end if; return new; end $$;
create trigger availability_fixture_failure before update on public.menu_dishes for each row execute function pg_temp.reject_availability_update();
insert into public.admin_dish_availability_schedules(restaurant_id,menu_id,dish_id,final_available,scheduled_for,timezone,idempotency_key,requester_qr_id)
values('a1100000-0000-4000-8000-000000000002','a1100000-0000-4000-8000-000000000012','a1100000-0000-4000-8000-000000000022',false,now()-interval '1 minute','America/Toronto','availability-retry-00001','a1100000-0000-4000-8000-000000000032');
update public.admin_availability_workers set last_success_at='2000-01-01T00:00:00Z' where worker_id='primary';
select public.run_due_admin_dish_availability('primary',25);
select public.run_due_admin_dish_availability('primary',25);
select public.run_due_admin_dish_availability('primary',25);
select pg_temp.assert_true((select status='failed' and attempts=3 and error_at is not null from public.admin_dish_availability_schedules where idempotency_key='availability-retry-00001'),'failed jobs retry three times without poisoning the batch');
select pg_temp.assert_true((select is_available=true from public.menu_dishes where id='a1100000-0000-4000-8000-000000000022'),'failed job rolls back dish mutation');
select pg_temp.assert_true((select count(*)=0 from public.admin_dish_availability_events where schedule_id=(select id from public.admin_dish_availability_schedules where idempotency_key='availability-retry-00001')),'failed job writes no audit');
select pg_temp.assert_true((select last_success_at='2000-01-01T00:00:00Z'::timestamptz from public.admin_availability_workers where worker_id='primary'),'failed jobs do not advance worker success');
drop trigger availability_fixture_failure on public.menu_dishes;
select public.run_due_admin_dish_availability('primary',25);
select pg_temp.assert_true((select last_success_at > '2000-01-01T00:00:00Z'::timestamptz from public.admin_availability_workers where worker_id='primary'),'healthy empty cycle advances worker success');

insert into public.admin_dish_availability_schedules(restaurant_id,menu_id,dish_id,final_available,scheduled_for,timezone,idempotency_key,requester_qr_id)
values
  ('a1100000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000011','a1100000-0000-4000-8000-000000000021',true,now()-interval '1 minute','America/Toronto','availability-revoked-due','a1100000-0000-4000-8000-000000000031'),
  ('a1100000-0000-4000-8000-000000000002','a1100000-0000-4000-8000-000000000012','a1100000-0000-4000-8000-000000000022',false,now()-interval '1 minute','America/Toronto','availability-draft-due01','a1100000-0000-4000-8000-000000000032');
update public.qr_codes set status='revoked',revoked_at=now() where id='a1100000-0000-4000-8000-000000000031';
update public.menus set status='draft' where id='a1100000-0000-4000-8000-000000000012';
update public.admin_availability_workers set last_success_at='2000-01-01T00:00:00Z' where worker_id='primary';
select public.run_due_admin_dish_availability('primary',25);
select pg_temp.assert_true((select count(*)=2 from public.admin_dish_availability_schedules where idempotency_key in ('availability-revoked-due','availability-draft-due01') and status='pending' and attempts=1),'worker retries due jobs whose authority is no longer valid');
select pg_temp.assert_true((select is_available=false from public.menu_dishes where id='a1100000-0000-4000-8000-000000000021'),'revoked QR cannot apply a queued availability mutation');
select pg_temp.assert_true((select is_available=true from public.menu_dishes where id='a1100000-0000-4000-8000-000000000022'),'unpublished menu cannot receive a queued availability mutation');
select pg_temp.assert_true((select last_success_at='2000-01-01T00:00:00Z'::timestamptz from public.admin_availability_workers where worker_id='primary'),'invalid queued authority does not advance worker success');
update public.admin_dish_availability_schedules
set status='cancelled'
where idempotency_key in ('availability-revoked-due','availability-draft-due01');
update public.menus set status='published' where id='a1100000-0000-4000-8000-000000000012';

do $$ declare denied boolean := false; begin
  update public.qr_codes set status='revoked',revoked_at=now() where id='a1100000-0000-4000-8000-000000000031';
  begin perform public.schedule_admin_dish_availability('a1100000-0000-4000-8000-000000000031','a1100000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000011','a1100000-0000-4000-8000-000000000021',true,now()+interval '3 hours','America/Toronto','availability-revoked-01',null); exception when others then denied := true; end;
  if not denied then raise exception 'revoked QR accepted'; end if;
end $$;

do $$ declare denied boolean := false; begin
  begin perform public.schedule_admin_dish_availability('a1100000-0000-4000-8000-000000000032','a1100000-0000-4000-8000-000000000002','a1100000-0000-4000-8000-000000000012','a1100000-0000-4000-8000-000000000021',true,now()+interval '3 hours','America/Toronto','availability-cross-menu1',null); exception when others then denied := true; end;
  if not denied then raise exception 'cross-menu dish accepted'; end if;
end $$;

do $$ declare denied boolean := false; begin
  begin update public.admin_dish_availability_events set final_available=not final_available where schedule_id is not null; exception when others then denied := true; end;
  if not denied then raise exception 'append-only audit mutated'; end if;
end $$;
