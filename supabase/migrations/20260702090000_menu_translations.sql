-- Stores generated public menu translations. Public rendering reads these rows
-- server-side through the service role; no anon/authenticated SELECT policy is
-- created here on purpose.

create table if not exists public.menu_translations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  menu_id uuid not null references public.menus(id) on delete cascade,
  locale text not null,
  translation_status text not null default 'missing',
  provider text,
  source_hash text not null default '',
  field_hashes jsonb not null default '{}'::jsonb,
  content jsonb not null default '{}'::jsonb,
  manual_overrides jsonb not null default '{}'::jsonb,
  error_message text,
  translated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_translations_locale_not_empty check (length(trim(locale)) > 0),
  constraint menu_translations_status_check check (
    translation_status in ('source', 'missing', 'pending', 'in_progress', 'up_to_date', 'stale', 'error')
  ),
  constraint menu_translations_field_hashes_is_object check (jsonb_typeof(field_hashes) = 'object'),
  constraint menu_translations_content_is_object check (jsonb_typeof(content) = 'object'),
  constraint menu_translations_manual_overrides_is_object check (jsonb_typeof(manual_overrides) = 'object')
);

create unique index if not exists menu_translations_menu_locale_idx
  on public.menu_translations (menu_id, locale);
create index if not exists menu_translations_restaurant_locale_idx
  on public.menu_translations (restaurant_id, locale);

create table if not exists public.menu_category_translations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  menu_id uuid not null references public.menus(id) on delete cascade,
  category_id uuid not null references public.menu_categories(id) on delete cascade,
  locale text not null,
  translation_status text not null default 'missing',
  provider text,
  source_hash text not null default '',
  field_hashes jsonb not null default '{}'::jsonb,
  content jsonb not null default '{}'::jsonb,
  manual_overrides jsonb not null default '{}'::jsonb,
  error_message text,
  translated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_category_translations_locale_not_empty check (length(trim(locale)) > 0),
  constraint menu_category_translations_status_check check (
    translation_status in ('source', 'missing', 'pending', 'in_progress', 'up_to_date', 'stale', 'error')
  ),
  constraint menu_category_translations_field_hashes_is_object check (jsonb_typeof(field_hashes) = 'object'),
  constraint menu_category_translations_content_is_object check (jsonb_typeof(content) = 'object'),
  constraint menu_category_translations_manual_overrides_is_object check (jsonb_typeof(manual_overrides) = 'object')
);

create unique index if not exists menu_category_translations_category_locale_idx
  on public.menu_category_translations (category_id, locale);
create index if not exists menu_category_translations_menu_locale_idx
  on public.menu_category_translations (menu_id, locale);

create table if not exists public.menu_dish_translations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  menu_id uuid not null references public.menus(id) on delete cascade,
  dish_id uuid not null references public.menu_dishes(id) on delete cascade,
  locale text not null,
  translation_status text not null default 'missing',
  provider text,
  source_hash text not null default '',
  field_hashes jsonb not null default '{}'::jsonb,
  content jsonb not null default '{}'::jsonb,
  manual_overrides jsonb not null default '{}'::jsonb,
  error_message text,
  translated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_dish_translations_locale_not_empty check (length(trim(locale)) > 0),
  constraint menu_dish_translations_status_check check (
    translation_status in ('source', 'missing', 'pending', 'in_progress', 'up_to_date', 'stale', 'error')
  ),
  constraint menu_dish_translations_field_hashes_is_object check (jsonb_typeof(field_hashes) = 'object'),
  constraint menu_dish_translations_content_is_object check (jsonb_typeof(content) = 'object'),
  constraint menu_dish_translations_manual_overrides_is_object check (jsonb_typeof(manual_overrides) = 'object')
);

create unique index if not exists menu_dish_translations_dish_locale_idx
  on public.menu_dish_translations (dish_id, locale);
create index if not exists menu_dish_translations_menu_locale_idx
  on public.menu_dish_translations (menu_id, locale);

create table if not exists public.menu_translation_jobs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  menu_id uuid not null references public.menus(id) on delete cascade,
  locale text not null,
  status text not null default 'queued',
  provider text,
  estimated_characters integer not null default 0,
  translated_characters integer not null default 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_translation_jobs_locale_not_empty check (length(trim(locale)) > 0),
  constraint menu_translation_jobs_status_check check (
    status in ('queued', 'running', 'succeeded', 'failed')
  ),
  constraint menu_translation_jobs_estimated_non_negative check (estimated_characters >= 0),
  constraint menu_translation_jobs_translated_non_negative check (translated_characters >= 0)
);

create index if not exists menu_translation_jobs_menu_locale_created_idx
  on public.menu_translation_jobs (menu_id, locale, created_at desc);

alter table public.menu_translations enable row level security;
alter table public.menu_category_translations enable row level security;
alter table public.menu_dish_translations enable row level security;
alter table public.menu_translation_jobs enable row level security;

revoke all on table public.menu_translations from anon, authenticated;
revoke all on table public.menu_category_translations from anon, authenticated;
revoke all on table public.menu_dish_translations from anon, authenticated;
revoke all on table public.menu_translation_jobs from anon, authenticated;

grant select, insert, update, delete on table public.menu_translations to service_role;
grant select, insert, update, delete on table public.menu_category_translations to service_role;
grant select, insert, update, delete on table public.menu_dish_translations to service_role;
grant select, insert, update, delete on table public.menu_translation_jobs to service_role;

drop policy if exists vistaire_no_direct_public_access on public.menu_translations;
drop policy if exists vistaire_no_direct_public_access on public.menu_category_translations;
drop policy if exists vistaire_no_direct_public_access on public.menu_dish_translations;
drop policy if exists vistaire_no_direct_public_access on public.menu_translation_jobs;
