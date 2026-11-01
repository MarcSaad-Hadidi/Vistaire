-- Server-only scheduling and append-only history. No anonymous/authenticated grants.
-- Apply through normal reviewed migration process; never via the dashboard.
create table public.dish_schedules (
 dish_id uuid primary key references public.menu_dishes(id) on delete cascade,
 restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 base_available boolean not null,
 manual_override boolean,
 rules jsonb not null default '[]'::jsonb check(jsonb_typeof(rules)='array' and jsonb_array_length(rules)<=100),
 revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default now()
);
create index dish_schedules_restaurant_idx on public.dish_schedules(restaurant_id);
create table public.menu_change_history (
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid not null references public.restaurants(id) on delete cascade,
 dish_id uuid,
 kind text not null check(kind in ('availability','schedule','price','promotion','menu-version')),
 occurred_at timestamptz not null default now(),
 before_value jsonb,
 after_value jsonb,
 request_id uuid,
 unique(restaurant_id,request_id)
);
create index menu_change_history_restaurant_time_idx on public.menu_change_history(restaurant_id,occurred_at desc);
alter table public.dish_schedules enable row level security;
alter table public.menu_change_history enable row level security;
revoke all on public.dish_schedules,public.menu_change_history from public, anon, authenticated;
grant select,insert,update,delete on public.dish_schedules to service_role;
grant select,insert on public.menu_change_history to service_role;

-- The established settings_json projection is visible even when PostgREST's
-- cache has not discovered the new table. Preserve opt-in across owner edits.
create function public.preserve_menu_schedule_capability() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if old.settings_json->>'availabilityScheduleVersion'='1' then
  new.settings_json:=jsonb_set(coalesce(new.settings_json,'{}'::jsonb),'{availabilityScheduleVersion}','1'::jsonb);
 end if;
 return new;
end $$;
revoke execute on function public.preserve_menu_schedule_capability() from public, anon, authenticated;
create trigger preserve_menu_schedule_capability before update of settings_json on public.menus for each row execute function public.preserve_menu_schedule_capability();

create function public.save_admin_dish_schedule(p_qr_id uuid,p_restaurant_id uuid,p_dish_id uuid,p_timezone text,p_expected_timezone text,p_base_available boolean,p_manual_override boolean,p_rules jsonb,p_expected_revision integer,p_request_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare v_menu uuid; v_settings jsonb; v_before jsonb; v_revision integer; r jsonb; d jsonb; v_saved jsonb;
begin
 perform 1 from public.qr_codes qr where qr.id=p_qr_id and qr.restaurant_id = p_restaurant_id and qr.status='active' and qr.target_kind='admin' and qr.target_path = '/admin' for update;
 if not found then raise exception 'Admin access required' using errcode='42501'; end if;
 select id,settings_json into v_menu,v_settings from public.menus where restaurant_id=p_restaurant_id and (status='published' or (status='draft' and is_primary)) order by case when status='published' and is_primary then 0 when status='published' then 1 else 2 end,updated_at desc,id limit 1 for update;
 perform 1 from public.menu_dishes where id=p_dish_id and restaurant_id=p_restaurant_id and menu_id=v_menu for update;
 if not found then raise exception 'Dish outside selected menu' using errcode='42501'; end if;
 if p_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) or p_base_available is null or p_request_id is null or p_expected_revision is null or p_expected_revision<0 or p_rules is null or jsonb_typeof(p_rules)<>'array' or jsonb_array_length(p_rules)>100 then raise exception 'Invalid schedule' using errcode='22023'; end if;
 for r in select value from jsonb_array_elements(p_rules) loop
  if jsonb_typeof(r)<>'object' or coalesce(r->>'type','') not in ('weekly','once') or jsonb_typeof(r->'available') is distinct from 'boolean' or coalesce(r->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(r->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or r->>'start'=r->>'end' or jsonb_typeof(r->'days') is distinct from 'array' then raise exception 'Invalid rule' using errcode='22023'; end if;
  if r->>'type'='weekly' and (jsonb_array_length(r->'days')=0 or r ? 'date') then raise exception 'Invalid weekdays' using errcode='22023'; end if;
  for d in select value from jsonb_array_elements(r->'days') loop
   if d::text !~ '^[1-7]$' then raise exception 'Invalid weekday' using errcode='22023'; end if;
  end loop;
  if r->>'type'='once' and (jsonb_array_length(r->'days')<>0 or coalesce(r->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char((r->>'date')::date,'YYYY-MM-DD')<>r->>'date') then raise exception 'Invalid exception date' using errcode='22023'; end if;
 end loop;
 select after_value into v_saved from public.menu_change_history where restaurant_id=p_restaurant_id and request_id = p_request_id;
 if found then
  if v_saved=jsonb_build_object('dishId',p_dish_id,'timezone',p_timezone,'baseAvailable',p_base_available,'manualOverride',p_manual_override,'rules',p_rules) then return; end if;
  raise exception 'Request identifier already used' using errcode = '40001';
 end if;
 if v_settings->>'timezone' is distinct from p_expected_timezone then raise exception 'Timezone changed' using errcode = '40001'; end if;
 select to_jsonb(s),s.revision into v_before,v_revision from public.dish_schedules s where s.dish_id=p_dish_id and s.restaurant_id=p_restaurant_id;
 v_revision:=coalesce(v_revision,0);
 if v_revision <> p_expected_revision then raise exception 'Schedule changed' using errcode = '40001'; end if;
 insert into public.dish_schedules(dish_id,restaurant_id,base_available,manual_override,rules,revision) values(p_dish_id,p_restaurant_id,p_base_available,p_manual_override,p_rules,v_revision+1)
 on conflict(dish_id) do update set base_available=excluded.base_available,manual_override=excluded.manual_override,rules=excluded.rules,revision=excluded.revision,updated_at=now();
 update public.menus set settings_json=jsonb_set(jsonb_set(coalesce(settings_json,'{}'::jsonb),'{timezone}',to_jsonb(p_timezone)),'{availabilityScheduleVersion}','1'::jsonb),updated_at=now() where id=v_menu and (settings_json->>'timezone' is distinct from p_timezone or settings_json->>'availabilityScheduleVersion' is distinct from '1');
 insert into public.menu_change_history(restaurant_id,dish_id,kind,before_value,after_value,request_id) values(p_restaurant_id,p_dish_id,'schedule',v_before,jsonb_build_object('dishId',p_dish_id,'timezone',p_timezone,'baseAvailable',p_base_available,'manualOverride',p_manual_override,'rules',p_rules),p_request_id);
end $$;
revoke execute on function public.save_admin_dish_schedule(uuid,uuid,uuid,text,text,boolean,boolean,jsonb,integer,uuid) from public, anon, authenticated;
grant execute on function public.save_admin_dish_schedule(uuid,uuid,uuid,text,text,boolean,boolean,jsonb,integer,uuid) to service_role;

-- Capture real existing mutation paths in their transaction, never synthetic analytics.
create function public.record_menu_change_history() returns trigger language plpgsql security invoker set search_path='' as $$
declare v_before jsonb; v_after jsonb; k text; v_fields jsonb; v_row jsonb;
begin
 if tg_table_name='menu_dishes' then
  -- Content history stores operation and changed field names, not raw text,
  -- media metadata, or full dish snapshots.
  if tg_op in ('INSERT','DELETE') then
   v_row:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
   -- The parent deletion also removes its history; do not recreate an orphan.
   if tg_op='DELETE' and not exists(select 1 from public.restaurants where id=old.restaurant_id) then return old; end if;
   insert into public.menu_change_history(restaurant_id,dish_id,kind,after_value) values((v_row->>'restaurant_id')::uuid,(v_row->>'id')::uuid,'menu-version',jsonb_build_object('operation',lower(tg_op),'menu_id',v_row->>'menu_id'));
   if tg_op='DELETE' then return old; else return new; end if;
  end if;
  select jsonb_agg(field order by field) into v_fields from unnest(array['name','short_description','description']) field where to_jsonb(old)->field is distinct from to_jsonb(new)->field;
  if v_fields is not null then
   insert into public.menu_change_history(restaurant_id,dish_id,kind,after_value) values(new.restaurant_id,new.id,'menu-version',jsonb_build_object('operation','update','menu_id',new.menu_id,'fields',v_fields));
  end if;
  foreach k in array array['availability','price','promotion'] loop
   v_before:=case k when 'availability' then to_jsonb(old.is_available) when 'price' then jsonb_build_object('price_cents',old.price_cents,'currency',old.currency) else coalesce(old.metadata,'{}'::jsonb)->'promotion' end;
   v_after:=case k when 'availability' then to_jsonb(new.is_available) when 'price' then jsonb_build_object('price_cents',new.price_cents,'currency',new.currency) else coalesce(new.metadata,'{}'::jsonb)->'promotion' end;
   if v_before is distinct from v_after then
    insert into public.menu_change_history(restaurant_id,dish_id,kind,before_value,after_value) values(new.restaurant_id,new.id,k,v_before,v_after);
    if k='availability' then update public.dish_schedules set manual_override=new.is_available,revision=revision+1,updated_at=now() where dish_id=new.id and restaurant_id=new.restaurant_id; end if;
   end if;
  end loop;
 else
  select jsonb_agg(field order by field) into v_fields from unnest(array['status','name','settings_json']) field where to_jsonb(old)->field is distinct from to_jsonb(new)->field;
  if v_fields is not null then insert into public.menu_change_history(restaurant_id,kind,after_value) values(new.restaurant_id,'menu-version',jsonb_build_object('operation','update','menu_id',new.id,'fields',v_fields)); end if;
 end if;
 return new;
end $$;
revoke execute on function public.record_menu_change_history() from public, anon, authenticated;
create trigger menu_dish_change_history after insert or update or delete on public.menu_dishes for each row execute function public.record_menu_change_history();
create trigger menu_version_change_history after update on public.menus for each row execute function public.record_menu_change_history();

-- Upgrade the original signature too: old deployed clients and stale PostgREST
-- schema caches must retain the same manual-override semantics after migration.
create or replace function public.set_admin_dish_availability(
  p_qr_id uuid,
  p_restaurant_id uuid,
  p_dish_id uuid,
  p_available boolean
)
returns table (
  dish_id uuid,
  dish_slug text,
  is_available boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qr_id uuid;
  v_menu_id uuid;
  v_current_available boolean;
  v_override boolean;
begin
  select qr.id
  into v_qr_id
    from public.qr_codes as qr
    where qr.id = p_qr_id
      and qr.restaurant_id = p_restaurant_id
      and qr.status = 'active'
      and qr.target_kind = 'admin'
      and qr.target_path = '/admin'
    for update;

  if v_qr_id is null then
    return;
  end if;

  select menu.id
  into v_menu_id
  from public.menus as menu
  where menu.restaurant_id = p_restaurant_id
    and (
      menu.status = 'published'
      or (menu.status = 'draft' and menu.is_primary is true)
    )
  order by
    case
      when menu.status = 'published' and menu.is_primary is true then 0
      when menu.status = 'published' then 1
      when menu.status = 'draft' and menu.is_primary is true then 2
      else 3
    end,
    menu.updated_at desc,
    menu.id asc
  limit 1;

  if v_menu_id is null then
    return;
  end if;

  select dish.is_available
  into v_current_available
  from public.menu_dishes as dish
  where dish.id = p_dish_id
    and dish.restaurant_id = p_restaurant_id
    and dish.menu_id = v_menu_id
  for update;

  if not found then
    return;
  end if;

  -- Same static flag can still need an explicit override of a live schedule.
  if v_current_available is not distinct from p_available then
    select schedule.manual_override into v_override
    from public.dish_schedules as schedule
    where schedule.dish_id = p_dish_id and schedule.restaurant_id = p_restaurant_id
    for update;
    if found and v_override is distinct from p_available then
      update public.dish_schedules as schedule
      set manual_override = p_available, revision = schedule.revision + 1, updated_at = now()
      where schedule.dish_id = p_dish_id and schedule.restaurant_id = p_restaurant_id;
      insert into public.menu_change_history(restaurant_id,dish_id,kind,before_value,after_value)
      values(p_restaurant_id,p_dish_id,'availability',jsonb_build_object('manual_override',v_override),jsonb_build_object('manual_override',p_available));
    end if;
  end if;

  if v_current_available is distinct from p_available then
    return query
    update public.menu_dishes as dish
    set is_available = p_available,
        updated_at = now()
    where dish.id = p_dish_id
      and dish.restaurant_id = p_restaurant_id
      and dish.menu_id = v_menu_id
    returning dish.id, dish.slug, dish.is_available, dish.updated_at;
  else
    return query
    select dish.id, dish.slug, dish.is_available, dish.updated_at
    from public.menu_dishes as dish
    where dish.id = p_dish_id
      and dish.restaurant_id = p_restaurant_id
      and dish.menu_id = v_menu_id;
  end if;
end;
$$;

revoke execute on function public.set_admin_dish_availability(uuid, uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.set_admin_dish_availability(uuid, uuid, uuid, boolean)
  to service_role;

create function public.set_admin_dish_manual_availability(p_qr_id uuid,p_restaurant_id uuid,p_dish_id uuid,p_available boolean)
returns table(dish_id uuid,dish_slug text,is_available boolean,updated_at timestamptz)
language sql security invoker set search_path='' as $$
 select * from public.set_admin_dish_availability(p_qr_id,p_restaurant_id,p_dish_id,p_available);
$$;
revoke execute on function public.set_admin_dish_manual_availability(uuid,uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.set_admin_dish_manual_availability(uuid,uuid,uuid,boolean) to service_role;
