-- Vistaire owner menu UI configs
-- Internal draft/published renderer configuration per restaurant.
--
-- Security model:
--   * Owners read/write through authenticated Next.js owner APIs only.
--   * Public menus read only the published config server-side.
--   * The browser never receives SUPABASE_SERVICE_ROLE_KEY.
--   * RLS is enabled and anon/authenticated grants are revoked.

create extension if not exists "pgcrypto";

create table if not exists public.menu_ui_configs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  theme text not null default 'fresh-homemade',
  config_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.menu_ui_configs
  add column if not exists restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  add column if not exists theme text not null default 'fresh-homemade',
  add column if not exists config_json jsonb not null default '{}'::jsonb,
  add column if not exists status text not null default 'draft',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'menu_ui_configs_status_check'
      and conrelid = 'public.menu_ui_configs'::regclass
  ) then
    alter table public.menu_ui_configs
      add constraint menu_ui_configs_status_check
      check (status in ('draft', 'published', 'archived'));
  end if;
end $$;

create index if not exists menu_ui_configs_restaurant_id_idx
  on public.menu_ui_configs (restaurant_id);

create unique index if not exists menu_ui_configs_restaurant_draft_key
  on public.menu_ui_configs (restaurant_id)
  where status = 'draft';

create unique index if not exists menu_ui_configs_restaurant_published_key
  on public.menu_ui_configs (restaurant_id)
  where status = 'published';

create or replace function public.set_menu_ui_configs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists menu_ui_configs_set_updated_at on public.menu_ui_configs;
create trigger menu_ui_configs_set_updated_at
  before update on public.menu_ui_configs
  for each row
  execute function public.set_menu_ui_configs_updated_at();

alter table public.menu_ui_configs enable row level security;

revoke all on table public.menu_ui_configs from anon, authenticated;
grant select, insert, update, delete on table public.menu_ui_configs to service_role;

