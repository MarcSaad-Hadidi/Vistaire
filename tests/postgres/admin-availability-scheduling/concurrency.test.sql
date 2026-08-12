select pg_temp.assert_true(pg_get_functiondef('public.run_due_admin_dish_availability(text,integer)'::regprocedure) ilike '%for update skip locked%','concurrent workers skip claimed rows');
select pg_temp.assert_true(pg_get_functiondef('public.run_due_admin_dish_availability(text,integer)'::regprocedure) ilike '%pg_try_advisory_xact_lock%','worker has a global advisory lock');
select pg_temp.assert_true((select count(*)=count(distinct idempotency_key) from public.admin_dish_availability_schedules),'idempotency keys remain unique');
select pg_temp.assert_true(public.run_due_admin_dish_availability('primary',25)=0,'already applied jobs are not replayed');
select pg_temp.assert_true((select count(*)=1 from public.admin_dish_availability_events where schedule_id=(select id from public.admin_dish_availability_schedules where idempotency_key='availability-due-0000001')),'repeated worker run creates no duplicate audit');
