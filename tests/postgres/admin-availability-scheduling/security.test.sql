select pg_temp.assert_true((select relrowsecurity from pg_class where oid='public.admin_dish_availability_schedules'::regclass),'schedules RLS');
select pg_temp.assert_true(not has_table_privilege('anon','public.admin_dish_availability_schedules','select'),'anon denied');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.run_due_admin_dish_availability(text,integer)','execute'),'authenticated denied');
select pg_temp.assert_true(has_function_privilege('service_role','public.run_due_admin_dish_availability(text,integer)','execute'),'service role allowed');
