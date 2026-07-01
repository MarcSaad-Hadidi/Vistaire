-- Vistaire menu settings schema catch-up
-- Keeps older Supabase projects compatible with the public menu settings
-- runtime before and after the canonical settings_json migration is applied.

alter table public.menus
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists settings_json jsonb default '{}'::jsonb;

update public.menus
set metadata = '{}'::jsonb
where metadata is null;

update public.menus
set settings_json = '{}'::jsonb
where settings_json is null;

alter table public.menus
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null,
  alter column settings_json set default '{}'::jsonb,
  alter column settings_json set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'menus_metadata_is_object'
      and conrelid = 'public.menus'::regclass
  ) then
    alter table public.menus
      add constraint menus_metadata_is_object
      check (jsonb_typeof(metadata) = 'object');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'menus_settings_json_is_object'
      and conrelid = 'public.menus'::regclass
  ) then
    alter table public.menus
      add constraint menus_settings_json_is_object
      check (jsonb_typeof(settings_json) = 'object');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'menus_settings_json_max_bytes'
      and conrelid = 'public.menus'::regclass
  ) then
    alter table public.menus
      add constraint menus_settings_json_max_bytes
      check (octet_length(settings_json::text) <= 32768);
  end if;
end $$;

alter table public.menu_dishes
  drop constraint if exists menu_dishes_currency_check;

alter table public.menu_dishes
  add constraint menu_dishes_currency_check
  check (currency ~ '^[A-Z]{3}$');

notify pgrst, 'reload schema';
