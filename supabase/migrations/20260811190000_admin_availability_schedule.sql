create table if not exists public.admin_dish_availability_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id),
  menu_id uuid not null references public.menus(id),
  dish_id uuid not null references public.menu_dishes(id),
  previous_available boolean not null,
  final_available boolean not null,
  actor_kind text not null check (actor_kind in ('admin_qr', 'schedule_worker')),
  requester_qr_id uuid references public.qr_codes(id),
  schedule_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_dish_availability_schedules (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id),
  menu_id uuid not null references public.menus(id),
  dish_id uuid not null references public.menu_dishes(id),
  final_available boolean not null,
  scheduled_for timestamptz not null,
  timezone text not null,
  status text not null default 'pending' check (status in ('pending', 'cancelled', 'applied', 'failed')),
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  requester_qr_id uuid not null references public.qr_codes(id),
  attempts integer not null default 0 check (attempts >= 0),
  applied_at timestamptz,
  error_at timestamptz,
  created_at timestamptz not null default now(),
  unique (restaurant_id, menu_id, idempotency_key)
);

alter table public.admin_dish_availability_events
  add constraint admin_availability_events_schedule_fk foreign key (schedule_id)
  references public.admin_dish_availability_schedules(id);

create table if not exists public.admin_availability_workers (
  worker_id text primary key,
  schema_version integer not null check (schema_version = 1),
  last_attempt_at timestamptz,
  last_success_at timestamptz
);

alter table public.admin_dish_availability_events enable row level security;
alter table public.admin_dish_availability_schedules enable row level security;
alter table public.admin_availability_workers enable row level security;

revoke all on table public.admin_dish_availability_events, public.admin_dish_availability_schedules, public.admin_availability_workers from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
grant select, insert on table public.admin_dish_availability_events to service_role;
grant select, insert, update on table public.admin_dish_availability_schedules to service_role;
grant select, insert, update on table public.admin_availability_workers to service_role;

create or replace function public.prevent_admin_availability_event_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'availability events are append-only';
end;
$$;
create trigger admin_availability_events_append_only before update or delete on public.admin_dish_availability_events for each row execute function public.prevent_admin_availability_event_mutation();

create or replace function public.set_admin_dish_availability(p_qr_id uuid,p_restaurant_id uuid,p_dish_id uuid,p_available boolean)
returns table(dish_id uuid,dish_slug text,is_available boolean,updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_menu_id uuid; v_previous boolean;
begin
  if not exists(select 1 from public.qr_codes q where q.id=p_qr_id and q.restaurant_id=p_restaurant_id and q.status='active' and q.target_kind='admin' and q.target_path='/admin' for update) then return; end if;
  select m.id into v_menu_id from public.menus m where m.restaurant_id=p_restaurant_id and (m.status='published' or (m.status='draft' and m.is_primary is true)) order by case when m.status='published' and m.is_primary is true then 0 when m.status='published' then 1 else 2 end,m.updated_at desc,m.id limit 1;
  if v_menu_id is null then return; end if;
  select d.is_available into v_previous from public.menu_dishes d where d.id=p_dish_id and d.restaurant_id=p_restaurant_id and d.menu_id=v_menu_id for update;
  if not found then return; end if;
  if v_previous is distinct from p_available then
    update public.menu_dishes d set is_available=p_available,updated_at=now() where d.id=p_dish_id and d.restaurant_id=p_restaurant_id and d.menu_id=v_menu_id;
    insert into public.admin_dish_availability_events(restaurant_id,menu_id,dish_id,previous_available,final_available,actor_kind,requester_qr_id) values(p_restaurant_id,v_menu_id,p_dish_id,v_previous,p_available,'admin_qr',p_qr_id);
  end if;
  return query select d.id,d.slug,d.is_available,d.updated_at from public.menu_dishes d where d.id=p_dish_id and d.restaurant_id=p_restaurant_id and d.menu_id=v_menu_id;
end;
$$;

create or replace function public.get_admin_availability_capability()
returns table(schema_version integer, worker_last_attempt_at timestamptz, worker_last_success_at timestamptz)
language sql security definer set search_path = '' as $$
  select 1, worker.last_attempt_at, worker.last_success_at
  from public.admin_availability_workers worker where worker.worker_id = 'primary';
$$;

create or replace function public.schedule_admin_dish_availability(
  p_qr_id uuid, p_restaurant_id uuid, p_menu_id uuid, p_dish_id uuid,
  p_available boolean, p_scheduled_for timestamptz, p_timezone text, p_idempotency_key text
)
returns public.admin_dish_availability_schedules
language plpgsql security definer set search_path = '' as $$
declare v_result public.admin_dish_availability_schedules;
begin
  if p_scheduled_for <= now() then raise exception 'schedule must be future'; end if;
  if not exists (select 1 from public.qr_codes q where q.id=p_qr_id and q.restaurant_id=p_restaurant_id and q.status='active' and q.target_kind='admin' and q.target_path='/admin') then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.menus m where m.id=p_menu_id and m.restaurant_id=p_restaurant_id and m.status='published') then raise exception 'menu scope mismatch'; end if;
  if not exists (select 1 from public.menu_dishes d where d.id=p_dish_id and d.restaurant_id=p_restaurant_id and d.menu_id=p_menu_id) then raise exception 'dish scope mismatch'; end if;
  insert into public.admin_dish_availability_schedules(restaurant_id,menu_id,dish_id,final_available,scheduled_for,timezone,idempotency_key,requester_qr_id)
  values(p_restaurant_id,p_menu_id,p_dish_id,p_available,p_scheduled_for,p_timezone,p_idempotency_key,p_qr_id)
  on conflict (restaurant_id,menu_id,idempotency_key) do update set idempotency_key=excluded.idempotency_key
  returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.cancel_admin_dish_availability(p_qr_id uuid, p_restaurant_id uuid, p_schedule_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.qr_codes q where q.id=p_qr_id and q.restaurant_id=p_restaurant_id and q.status='active' and q.target_kind='admin' and q.target_path='/admin') then return false; end if;
  update public.admin_dish_availability_schedules s set status='cancelled' where s.id=p_schedule_id and s.restaurant_id=p_restaurant_id and s.status='pending';
  return found;
end;
$$;

create or replace function public.run_due_admin_dish_availability(p_worker_id text, p_batch_size integer default 25)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_job public.admin_dish_availability_schedules; v_previous boolean; v_count integer := 0;
begin
  insert into public.admin_availability_workers(worker_id,schema_version,last_attempt_at) values(p_worker_id,1,now()) on conflict(worker_id) do update set last_attempt_at=excluded.last_attempt_at;
  if not pg_try_advisory_xact_lock(hashtext('admin-availability-worker')) then return 0; end if;
  for v_job in select * from public.admin_dish_availability_schedules where status='pending' and scheduled_for <= now() order by scheduled_for,id for update skip locked limit greatest(1,least(p_batch_size,100)) loop
    select is_available into v_previous from public.menu_dishes where id=v_job.dish_id and restaurant_id=v_job.restaurant_id and menu_id=v_job.menu_id for update;
    update public.menu_dishes set is_available=v_job.final_available,updated_at=now() where id=v_job.dish_id and restaurant_id=v_job.restaurant_id and menu_id=v_job.menu_id;
    update public.admin_dish_availability_schedules set status='applied',attempts=attempts+1,applied_at=now() where id=v_job.id;
    insert into public.admin_dish_availability_events(restaurant_id,menu_id,dish_id,previous_available,final_available,actor_kind,requester_qr_id,schedule_id) values(v_job.restaurant_id,v_job.menu_id,v_job.dish_id,v_previous,v_job.final_available,'schedule_worker',v_job.requester_qr_id,v_job.id);
    v_count := v_count + 1;
  end loop;
  update public.admin_availability_workers set last_success_at=now() where worker_id=p_worker_id;
  return v_count;
end;
$$;

revoke execute on function public.prevent_admin_availability_event_mutation() from public, anon, authenticated;
revoke execute on function public.set_admin_dish_availability(uuid,uuid,uuid,boolean) from public, anon, authenticated;
revoke execute on function public.get_admin_availability_capability() from public, anon, authenticated;
revoke execute on function public.schedule_admin_dish_availability(uuid,uuid,uuid,uuid,boolean,timestamptz,text,text) from public, anon, authenticated;
revoke execute on function public.cancel_admin_dish_availability(uuid,uuid,uuid) from public, anon, authenticated;
revoke execute on function public.run_due_admin_dish_availability(text,integer) from public, anon, authenticated;
grant execute on function public.get_admin_availability_capability() to service_role;
grant execute on function public.set_admin_dish_availability(uuid,uuid,uuid,boolean) to service_role;
grant execute on function public.schedule_admin_dish_availability(uuid,uuid,uuid,uuid,boolean,timestamptz,text,text) to service_role;
grant execute on function public.cancel_admin_dish_availability(uuid,uuid,uuid) to service_role;
grant execute on function public.run_due_admin_dish_availability(text,integer) to service_role;
