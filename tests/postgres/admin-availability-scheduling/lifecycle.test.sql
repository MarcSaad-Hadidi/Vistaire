select pg_temp.assert_true(exists(select 1 from pg_constraint where conname='admin_dish_availability_schedules_restaurant_id_menu_id_idempotency_key_key'),'idempotency unique');
select pg_temp.assert_true(exists(select 1 from pg_trigger where tgname='admin_availability_events_append_only'),'audit append-only');
