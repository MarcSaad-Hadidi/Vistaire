-- Vistaire public menu product settings
-- Adds durable menu-level settings for locale, currency, timezone, and
-- client experience options without changing the existing RLS posture.

alter table public.menus
  add column if not exists settings_json jsonb not null default '{}'::jsonb;

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

do $$
begin
  alter table public.menu_dishes
    drop constraint if exists menu_dishes_currency_check;

  alter table public.menu_dishes
    add constraint menu_dishes_currency_check
    check (currency ~ '^[A-Z]{3}$');
end $$;

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
    is_primary,
    settings_json
  )
  values (
    v_restaurant_row.id,
    coalesce(nullif(v_menu ->> 'name', ''), 'Menu principal'),
    coalesce(nullif(v_menu ->> 'slug', ''), 'principal'),
    'published',
    coalesce((v_menu ->> 'is_primary')::boolean, true),
    case
      when jsonb_typeof(coalesce(v_menu -> 'settings_json', '{}'::jsonb)) = 'object'
        then coalesce(v_menu -> 'settings_json', '{}'::jsonb)
      else '{}'::jsonb
    end
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

notify pgrst, 'reload schema';
