-- Vistaire owner restaurants
-- Production restaurant records used by the owner cockpit, public menu lookup,
-- QR generation, and readiness views.
--
-- Security model:
--   * Writes are performed by authenticated owner-only Next.js routes.
--   * The browser never receives SUPABASE_SERVICE_ROLE_KEY.
--   * RLS is enabled and anon/authenticated grants are revoked, so direct Data
--     API access from public clients is not the access path.

create extension if not exists "pgcrypto";

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  location text not null default '',
  cuisine_type text not null default '',
  status text not null default 'setup_needed'
    check (status in ('demo', 'active', 'setup_needed', 'paused', 'archived')),
  contact_name text not null default '',
  contact_email text not null default '',
  contact_phone text,
  notes text,
  public_menu_url text,
  qr_ready boolean not null default false,
  qr_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.restaurants
  add column if not exists name text not null default '',
  add column if not exists slug text not null default '',
  add column if not exists location text not null default '',
  add column if not exists cuisine_type text not null default '',
  add column if not exists status text not null default 'setup_needed',
  add column if not exists contact_name text not null default '',
  add column if not exists contact_email text not null default '',
  add column if not exists contact_phone text,
  add column if not exists notes text,
  add column if not exists public_menu_url text,
  add column if not exists qr_ready boolean not null default false,
  add column if not exists qr_generated_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'restaurants_status_check'
      and conrelid = 'public.restaurants'::regclass
  ) then
    alter table public.restaurants
      add constraint restaurants_status_check
      check (status in ('demo', 'active', 'setup_needed', 'paused', 'archived'));
  end if;
end $$;

create unique index if not exists restaurants_slug_key
  on public.restaurants (slug);

create index if not exists restaurants_status_idx
  on public.restaurants (status);

create index if not exists restaurants_created_at_idx
  on public.restaurants (created_at desc);

create or replace function public.set_restaurants_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists restaurants_set_updated_at on public.restaurants;
create trigger restaurants_set_updated_at
  before update on public.restaurants
  for each row
  execute function public.set_restaurants_updated_at();

alter table public.restaurants enable row level security;

revoke all on table public.restaurants from anon, authenticated;
grant select, insert, update, delete on table public.restaurants to service_role;
