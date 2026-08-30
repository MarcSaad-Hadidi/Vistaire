select pg_temp.assert_true((select relrowsecurity from pg_class where oid='public.admin_dish_availability_schedules'::regclass),'schedules RLS');
set local role anon;
select pg_temp.assert_true(not has_table_privilege(current_user,'public.admin_dish_availability_schedules','select'),'anon denied schedules');
select pg_temp.assert_true(not has_function_privilege(current_user,'public.run_due_admin_dish_availability(text,integer)','execute'),'anon denied worker');
reset role;
set local role authenticated;
select pg_temp.assert_true(not has_table_privilege(current_user,'public.admin_dish_availability_events','select'),'authenticated denied events');
select pg_temp.assert_true(not has_function_privilege(current_user,'public.cancel_admin_dish_availability(uuid,uuid,uuid,uuid)','execute'),'authenticated denied cancel');
reset role;
select pg_temp.assert_true(has_function_privilege('service_role','public.run_due_admin_dish_availability(text,integer)','execute'),'service role worker allowed');
select pg_temp.assert_true(
  case
    when to_regclass('public.restaurants_id_seq') is null then true
    else not has_sequence_privilege('anon',to_regclass('public.restaurants_id_seq'),'usage')
  end,
  'availability migration does not broaden sequence access'
);
