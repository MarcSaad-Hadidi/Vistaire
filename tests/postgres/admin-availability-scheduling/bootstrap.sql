\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.assert_true(value boolean, message text)
returns void language plpgsql as $$ begin if not coalesce(value,false) then raise exception 'assertion failed: %',message; end if; end $$;

select pg_temp.assert_true(to_regclass('public.admin_dish_availability_schedules') is not null, 'availability migration must be applied');

insert into public.restaurants(id,name,slug,status) values
  ('a1100000-0000-4000-8000-000000000001','Availability A','availability-a','active'),
  ('a1100000-0000-4000-8000-000000000002','Availability B','availability-b','active');
insert into public.menus(id,restaurant_id,name,slug,status,is_primary,settings_json) values
  ('a1100000-0000-4000-8000-000000000011','a1100000-0000-4000-8000-000000000001','Menu A','menu-a','published',true,'{"timezone":"America/Toronto"}'::jsonb),
  ('a1100000-0000-4000-8000-000000000012','a1100000-0000-4000-8000-000000000002','Menu B','menu-b','published',true,'{"timezone":"America/Toronto"}'::jsonb);
insert into public.menu_dishes(id,restaurant_id,menu_id,slug,name,is_available) values
  ('a1100000-0000-4000-8000-000000000021','a1100000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000011','dish-a','Dish A',true),
  ('a1100000-0000-4000-8000-000000000022','a1100000-0000-4000-8000-000000000002','a1100000-0000-4000-8000-000000000012','dish-b','Dish B',true);
insert into public.qr_codes(id,restaurant_id,label,token_hash,token_preview,target_path,target_kind,status) values
  ('a1100000-0000-4000-8000-000000000031','a1100000-0000-4000-8000-000000000001','Admin A','availability-admin-a-hash','admin-a','/admin','admin','active'),
  ('a1100000-0000-4000-8000-000000000032','a1100000-0000-4000-8000-000000000002','Admin B','availability-admin-b-hash','admin-b','/admin','admin','active');
