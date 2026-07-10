begin;

create table if not exists public.analytics_events (
  id uuid default gen_random_uuid() not null,
  restaurant_id uuid not null,
  menu_id uuid,
  dish_id uuid,
  session_id text not null,
  event_name text not null,
  source text default 'demo'::text not null,
  dish_slug text,
  category_slug text,
  search_query text,
  filter_name text,
  cta_name text,
  viewport jsonb,
  user_agent text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  constraint analytics_events_pkey primary key (id),
  constraint analytics_events_restaurant_id_fkey foreign key (restaurant_id) references public.restaurants(id) on delete cascade,
  constraint analytics_events_menu_id_fkey foreign key (menu_id) references public.menus(id) on delete set null,
  constraint analytics_events_dish_id_fkey foreign key (dish_id) references public.menu_dishes(id) on delete set null,
  constraint analytics_events_event_name_check check (event_name = any (array['menu_opened','dish_opened','search_used','filter_used','category_viewed','dish_3d_clicked','dish_ar_clicked','cta_clicked']::text[])),
  constraint analytics_events_source_check check (source = any (array['demo','production']::text[]))
);

do $$
declare
  actual_columns integer;
begin
  select count(*) into actual_columns
  from information_schema.columns
  where table_schema = 'public' and table_name = 'analytics_events';
  if actual_columns <> 16 then
    raise exception 'analytics_events incompatible column count: expected 16, got %', actual_columns;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'analytics_events'
      and ((column_name in ('restaurant_id','session_id','event_name','source','metadata','created_at','id') and is_nullable <> 'NO')
        or (column_name in ('menu_id','dish_id','dish_slug','category_slug','search_query','filter_name','cta_name','viewport','user_agent') and is_nullable <> 'YES'))
  ) then
    raise exception 'analytics_events incompatible column nullability';
  end if;
end $$;

create index if not exists analytics_events_restaurant_id_idx on public.analytics_events (restaurant_id);
create index if not exists analytics_events_menu_id_idx on public.analytics_events (menu_id);
create index if not exists analytics_events_dish_id_idx on public.analytics_events (dish_id);
create index if not exists analytics_events_session_id_idx on public.analytics_events (session_id);
create index if not exists analytics_events_event_name_idx on public.analytics_events (event_name);
create index if not exists analytics_events_source_idx on public.analytics_events (source);
create index if not exists analytics_events_created_at_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_restaurant_created_at_idx on public.analytics_events (restaurant_id, created_at desc);
create index if not exists analytics_events_dashboard_scope_idx on public.analytics_events (restaurant_id, menu_id, source, created_at desc);

alter table public.analytics_events enable row level security;
revoke all on table public.analytics_events from public;
revoke all on table public.analytics_events from anon, authenticated;
grant select, insert on table public.analytics_events to service_role;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='analytics_events' and policyname='vistaire_no_direct_public_access') then
    create policy vistaire_no_direct_public_access on public.analytics_events as restrictive for all to anon, authenticated using (false) with check (false);
  end if;
end $$;

commit;
