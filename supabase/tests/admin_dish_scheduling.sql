-- Dedicated ephemeral database only. Transaction rolls back all fixtures/schema.
-- Run from repository root: psql -X -v ON_ERROR_STOP=1 -f supabase/tests/admin_dish_scheduling.sql
\set ON_ERROR_STOP on
begin;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
-- Deliberately fail if these tables already exist: never run against an application database.
create table public.restaurants(id uuid primary key);
create table public.menus(id uuid primary key,restaurant_id uuid references public.restaurants(id) on delete cascade,status text,is_primary boolean,settings_json jsonb default '{}',name text,updated_at timestamptz default now());
create table public.menu_dishes(id uuid primary key,restaurant_id uuid references public.restaurants(id) on delete cascade,menu_id uuid references public.menus(id) on delete cascade,slug text,name text,short_description text,description text,is_available boolean,price_cents integer,currency text,metadata jsonb default '{}',updated_at timestamptz default now());
create table public.qr_codes(id uuid primary key,restaurant_id uuid,target_kind text,target_path text,status text);
grant all on public.restaurants,public.menus,public.menu_dishes,public.qr_codes to service_role;
\ir ../migrations/20260710194202_admin_dish_availability_rpc.sql
insert into public.restaurants values('11111111-1111-4111-8111-111111111111'),('22222222-1111-4111-8111-111111111111');
insert into public.menus(id,restaurant_id,status,is_primary,name) values('33333333-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','published',true,'Carte');
insert into public.menu_dishes(id,restaurant_id,menu_id,slug,is_available,price_cents,currency) values('44444444-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','33333333-1111-4111-8111-111111111111','plat',true,1000,'CAD');
insert into public.qr_codes values('55555555-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','admin','/admin','active');
-- Old application/RPC remains usable before the scheduling migration.
select * from public.set_admin_dish_availability('55555555-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','44444444-1111-4111-8111-111111111111',false);
do $$ begin if (select is_available from public.menu_dishes) is distinct from false then raise exception 'Legacy pre-migration availability failed';end if;end $$;
select * from public.set_admin_dish_availability('55555555-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','44444444-1111-4111-8111-111111111111',true);
\ir ../migrations/20261018212202_admin_dish_scheduling.sql
set local role service_role;
select public.save_admin_dish_schedule('55555555-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','44444444-1111-4111-8111-111111111111','America/Toronto',null,false,null,'[{"type":"weekly","days":[1],"start":"22:00","end":"02:00","available":true}]',0,'66666666-1111-4111-8111-111111111111');
do $$ begin if (select settings_json->>'availabilityScheduleVersion' from public.menus) is distinct from '1' then raise exception 'Missing schedule capability marker';end if;end $$;
update public.menus set settings_json='{"timezone":"America/Toronto"}';
do $$ begin if (select settings_json->>'availabilityScheduleVersion' from public.menus) is distinct from '1' then raise exception 'Owner settings replacement removed schedule marker';end if;end $$;
-- Exact retries are idempotent, including the original timezone snapshot.
select public.save_admin_dish_schedule('55555555-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','44444444-1111-4111-8111-111111111111','America/Toronto',null,false,null,'[{"type":"weekly","days":[1],"start":"22:00","end":"02:00","available":true}]',0,'66666666-1111-4111-8111-111111111111');
do $$ begin
 if (select revision from public.dish_schedules)<>1 then raise exception 'Replay changed revision'; end if;
 begin
  perform public.save_admin_dish_schedule('55555555-1111-4111-8111-111111111111','22222222-1111-4111-8111-111111111111','44444444-1111-4111-8111-111111111111','America/Toronto',null,false,null,'[]',0,gen_random_uuid());
  raise exception 'Tenant bypass';
 exception when insufficient_privilege then null; end;
 begin
  perform public.save_admin_dish_schedule('55555555-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','44444444-1111-4111-8111-111111111111','America/Toronto','America/Toronto',false,null,'[]',0,gen_random_uuid());
  raise exception 'Stale revision accepted';
 exception when serialization_failure then null; end;
end $$;
select * from public.set_admin_dish_manual_availability('55555555-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','44444444-1111-4111-8111-111111111111',true);
-- Both entrypoints persist override even if the static flag already matches.
update public.dish_schedules set manual_override=false;
select * from public.set_admin_dish_availability('55555555-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','44444444-1111-4111-8111-111111111111',true);
do $$ begin if (select manual_override from public.dish_schedules) is distinct from true then raise exception 'Legacy entrypoint lost manual override';end if;end $$;
update public.dish_schedules set manual_override=false;
select * from public.set_admin_dish_manual_availability('55555555-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','44444444-1111-4111-8111-111111111111',true);
update public.menu_dishes set price_cents=1200,metadata='{"promotion":{"label":"soir"}}';
do $$ declare k text; begin
 if (select manual_override from public.dish_schedules) is distinct from true then raise exception 'Manual override missing';end if;
 foreach k in array array['schedule','menu-version','availability','price','promotion'] loop
  if not exists(select 1 from public.menu_change_history where kind=k) then raise exception 'Audit missing: %',k;end if;
 end loop;
end $$;
-- Content history records operation/changed field names, never raw descriptions.
insert into public.menu_dishes(id,restaurant_id,menu_id,slug,name,description,is_available,price_cents,currency) values('77777777-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','33333333-1111-4111-8111-111111111111','new-dish','New dish','private note text',true,1000,'CAD');
update public.menu_dishes set name='Edited dish',description='another private note' where id='77777777-1111-4111-8111-111111111111';
delete from public.menu_dishes where id='77777777-1111-4111-8111-111111111111';
do $$ declare operation text; begin
 foreach operation in array array['insert','update','delete'] loop
  if not exists(select 1 from public.menu_change_history where dish_id='77777777-1111-4111-8111-111111111111' and kind='menu-version' and after_value->>'operation'=operation) then raise exception 'Missing dish content operation: %',operation;end if;
 end loop;
 if exists(select 1 from public.menu_change_history where kind='menu-version' and (coalesce(before_value::text,'')||coalesce(after_value::text,'')) like '%private note%') then raise exception 'Raw description in history';end if;
end $$;
-- Cascading restaurant deletion must not be blocked by an orphan audit insert.
delete from public.restaurants where id='11111111-1111-4111-8111-111111111111';
set local role anon;
do $$ begin
 begin perform * from public.dish_schedules;raise exception 'Anonymous read';exception when insufficient_privilege then null;end;
 begin perform public.save_admin_dish_schedule(null,null,null,null,null,null,null,'[]',0,null);raise exception 'Anonymous write';exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
do $$ begin
 begin perform * from public.menu_change_history;raise exception 'Authenticated history read';exception when insufficient_privilege then null;end;
end $$;
rollback;
select 'Scheduling tenant, replay, concurrency, manual override, audit and role tests passed' as result;
