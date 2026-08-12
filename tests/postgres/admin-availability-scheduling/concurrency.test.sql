select pg_temp.assert_true(pg_get_functiondef('public.run_due_admin_dish_availability(text,integer)'::regprocedure) ilike '%for update skip locked%','skip locked');
select pg_temp.assert_true(pg_get_functiondef('public.run_due_admin_dish_availability(text,integer)'::regprocedure) ilike '%pg_try_advisory_xact_lock%','advisory lock');
