-- Vistaire owner restaurant creation transaction
-- Creates the restaurant, primary published menu, categories, dishes, and
-- draft UI config in a single Postgres transaction. Called only by the
-- server-side owner API through the service role.

create extension if not exists "pgcrypto";

create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  slug text not null,
  status text not null default 'active'
    check (status in ('draft', 'active', 'published', 'archived')),
  is_primary boolean not null default false,
  display_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.menus
  add column if not exists restaurant_id uuid references public.restaurants(id) on delete cascade,
  add column if not exists name text,
  add column if not exists slug text,
  add column if not exists status text default 'active',
  add column if not exists is_primary boolean default false,
  add column if not exists display_order integer default 0,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists menus_restaurant_slug_key
  on public.menus (restaurant_id, slug);

create unique index if not exists menus_primary_restaurant_key
  on public.menus (restaurant_id)
  where is_primary is true;

create index if not exists menus_restaurant_id_idx
  on public.menus (restaurant_id);

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  menu_id uuid not null references public.menus(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  display_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.menu_categories
  add column if not exists restaurant_id uuid references public.restaurants(id) on delete cascade,
  add column if not exists menu_id uuid references public.menus(id) on delete cascade,
  add column if not exists name text,
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists display_order integer default 0,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists menu_categories_menu_slug_key
  on public.menu_categories (menu_id, slug);

create index if not exists menu_categories_restaurant_id_idx
  on public.menu_categories (restaurant_id);

create index if not exists menu_categories_menu_id_order_idx
  on public.menu_categories (menu_id, display_order);

create table if not exists public.menu_dishes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  menu_id uuid not null references public.menus(id) on delete cascade,
  category_id uuid references public.menu_categories(id) on delete set null,
  slug text not null,
  name text not null,
  short_description text,
  description text,
  price_cents integer not null default 0,
  currency text not null default 'CAD',
  image_url text,
  is_available boolean not null default true,
  is_signature boolean not null default false,
  is_recommended boolean not null default false,
  has_immersive_view boolean not null default false,
  allergens text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.menu_dishes
  add column if not exists restaurant_id uuid references public.restaurants(id) on delete cascade,
  add column if not exists menu_id uuid references public.menus(id) on delete cascade,
  add column if not exists category_id uuid references public.menu_categories(id) on delete set null,
  add column if not exists slug text,
  add column if not exists name text,
  add column if not exists short_description text,
  add column if not exists description text,
  add column if not exists price_cents integer default 0,
  add column if not exists currency text default 'CAD',
  add column if not exists image_url text,
  add column if not exists is_available boolean default true,
  add column if not exists is_signature boolean default false,
  add column if not exists is_recommended boolean default false,
  add column if not exists has_immersive_view boolean default false,
  add column if not exists allergens text[] default '{}'::text[],
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists menu_dishes_menu_slug_key
  on public.menu_dishes (menu_id, slug);

create index if not exists menu_dishes_restaurant_id_idx
  on public.menu_dishes (restaurant_id);

create index if not exists menu_dishes_category_id_idx
  on public.menu_dishes (category_id);

alter table public.menus enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_dishes enable row level security;

revoke all on table public.menus from anon, authenticated;
revoke all on table public.menu_categories from anon, authenticated;
revoke all on table public.menu_dishes from anon, authenticated;

grant select, insert, update, delete on table public.menus to service_role;
grant select, insert, update, delete on table public.menu_categories to service_role;
grant select, insert, update, delete on table public.menu_dishes to service_role;

create or replace function public.create_owner_restaurant_with_menu(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_restaurant jsonb := coalesce(p_payload -> 'restaurant', '{}'::jsonb);
  v_menu jsonb := coalesce(p_payload -> 'menu', '{}'::jsonb);
  v_ui_config jsonb := coalesce(p_payload -> 'ui_config', '{}'::jsonb);
  v_category jsonb;
  v_dish jsonb;
  v_restaurant_row public.restaurants%rowtype;
  v_menu_row public.menus%rowtype;
  v_category_row public.menu_categories%rowtype;
  v_category_ids jsonb := '{}'::jsonb;
  v_category_id uuid;
  v_category_count integer := 0;
  v_dish_count integer := 0;
  v_media_base_path text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'create_owner_restaurant_with_menu payload must be an object';
  end if;

  insert into public.restaurants (
    name,
    slug,
    location,
    city,
    cuisine_type,
    status,
    contact_name,
    contact_email,
    contact_phone,
    google_review_enabled,
    google_review_url,
    notes,
    public_menu_url
  )
  values (
    v_restaurant ->> 'name',
    v_restaurant ->> 'slug',
    nullif(v_restaurant ->> 'location', ''),
    nullif(v_restaurant ->> 'city', ''),
    nullif(v_restaurant ->> 'cuisine_type', ''),
    coalesce(nullif(v_restaurant ->> 'status', ''), 'setup_needed'),
    nullif(v_restaurant ->> 'contact_name', ''),
    nullif(v_restaurant ->> 'contact_email', ''),
    nullif(v_restaurant ->> 'contact_phone', ''),
    coalesce((v_restaurant ->> 'google_review_enabled')::boolean, false),
    nullif(v_restaurant ->> 'google_review_url', ''),
    nullif(v_restaurant ->> 'notes', ''),
    nullif(v_restaurant ->> 'public_menu_url', '')
  )
  returning * into v_restaurant_row;

  insert into public.menus (
    restaurant_id,
    name,
    slug,
    status,
    is_primary
  )
  values (
    v_restaurant_row.id,
    coalesce(nullif(v_menu ->> 'name', ''), 'Menu principal'),
    coalesce(nullif(v_menu ->> 'slug', ''), 'principal'),
    'published',
    coalesce((v_menu ->> 'is_primary')::boolean, true)
  )
  returning * into v_menu_row;

  for v_category in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'categories', '[]'::jsonb))
  loop
    insert into public.menu_categories (
      restaurant_id,
      menu_id,
      name,
      slug,
      description,
      display_order
    )
    values (
      v_restaurant_row.id,
      v_menu_row.id,
      v_category ->> 'name',
      v_category ->> 'slug',
      nullif(v_category ->> 'description', ''),
      coalesce((v_category ->> 'display_order')::integer, v_category_count + 1)
    )
    returning * into v_category_row;

    v_category_ids := jsonb_set(
      v_category_ids,
      array[v_category_row.slug],
      to_jsonb(v_category_row.id::text),
      true
    );
    v_category_count := v_category_count + 1;
  end loop;

  for v_dish in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'dishes', '[]'::jsonb))
  loop
    v_category_id := null;
    if v_dish ? 'category_slug' then
      v_category_id := nullif(v_category_ids ->> (v_dish ->> 'category_slug'), '')::uuid;
    end if;

    insert into public.menu_dishes (
      restaurant_id,
      menu_id,
      category_id,
      slug,
      name,
      short_description,
      description,
      price_cents,
      currency,
      image_url,
      is_available,
      is_signature,
      is_recommended,
      has_immersive_view,
      allergens,
      metadata
    )
    values (
      v_restaurant_row.id,
      v_menu_row.id,
      v_category_id,
      v_dish ->> 'slug',
      v_dish ->> 'name',
      nullif(v_dish ->> 'short_description', ''),
      nullif(v_dish ->> 'description', ''),
      coalesce((v_dish ->> 'price_cents')::integer, 0),
      coalesce(nullif(v_dish ->> 'currency', ''), 'CAD'),
      nullif(v_dish ->> 'image_url', ''),
      coalesce((v_dish ->> 'is_available')::boolean, true),
      coalesce((v_dish ->> 'is_signature')::boolean, false),
      coalesce((v_dish ->> 'is_recommended')::boolean, false),
      false,
      coalesce(
        array(select jsonb_array_elements_text(coalesce(v_dish -> 'allergens', '[]'::jsonb))),
        '{}'::text[]
      ),
      coalesce(v_dish -> 'metadata', '{}'::jsonb)
    );

    v_dish_count := v_dish_count + 1;
  end loop;

  insert into public.menu_ui_configs (
    restaurant_id,
    theme,
    config_json,
    status
  )
  values (
    v_restaurant_row.id,
    coalesce(nullif(v_ui_config ->> 'theme', ''), 'fresh-homemade'),
    coalesce(v_ui_config -> 'config_json', '{}'::jsonb),
    coalesce(nullif(v_ui_config ->> 'status', ''), 'draft')
  )
  on conflict do nothing;

  v_media_base_path := 'restaurants/' || v_restaurant_row.id::text || '/photos/';

  return jsonb_build_object(
    'ok', true,
    'restaurantPersisted', true,
    'menuPersisted', true,
    'categoriesPersisted', true,
    'dishesPersisted', true,
    'uiConfigPersisted', true,
    'persistedCategoryCount', v_category_count,
    'persistedDishCount', v_dish_count,
    'restaurant', to_jsonb(v_restaurant_row),
    'menu', to_jsonb(v_menu_row),
    'mediaBasePath', v_media_base_path,
    'mediaBasePathPersisted', false,
    'qrCodesHref', '/owner/qr-codes?restaurantId=' || v_restaurant_row.id::text || '&target=menu',
    'warnings', '[]'::jsonb
  );
end;
$$;

revoke execute on function public.create_owner_restaurant_with_menu(jsonb)
  from public, anon, authenticated;
grant execute on function public.create_owner_restaurant_with_menu(jsonb)
  to service_role;
