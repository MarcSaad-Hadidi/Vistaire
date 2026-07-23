-- Structured allergen declarations for the food-safety P0.
-- The legacy allergens text[] column is intentionally preserved. Unknown and
-- free-from legacy phrases are never backfilled as confirmed_free.

alter table public.menu_dishes
  add column if not exists allergen_declarations jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'menu_dishes_allergen_declarations_array_check'
      and conrelid = 'public.menu_dishes'::regclass
  ) then
    alter table public.menu_dishes
      add constraint menu_dishes_allergen_declarations_array_check
      check (
        allergen_declarations is null
        or jsonb_typeof(allergen_declarations) = 'array'
      );
  end if;
end;
$$;

-- Conservative migration: only explicit legacy presence is converted. A
-- legacy "sans ..." or "free from ..." phrase remains unknown and is kept in
-- allergens for owner review.
with legacy_values as (
  select
    dish.id,
    value as legacy_value
  from public.menu_dishes as dish
  cross join lateral unnest(coalesce(dish.allergens, '{}'::text[])) as legacy_item(value)
  where dish.allergen_declarations is null
), mapped as (
  select
    legacy.id,
    registry.allergen_id,
    case
      when legacy.legacy_value ~* '(may[[:space:]]+contain|peut[[:space:]]+contenir|traces?[[:space:]]+de|might[[:space:]]+contain|cross[[:space:]]+contamination|contamination[[:space:]]+croisee)'
        then 'may_contain'
      else 'contains'
    end as status
  from legacy_values as legacy
  cross join lateral (
    values
      ('gluten', legacy.legacy_value ~* '(gluten|bl[ée]|wheat|seigle|rye|weizen|roggen)'),
      ('dairy', legacy.legacy_value ~* '(dairy|lait|milk|lactose|produits?[[:space:]]+laitiers?)'),
      ('eggs', legacy.legacy_value ~* '(egg|oeuf|œuf|huevo|eier)'),
      ('tree_nuts', legacy.legacy_value ~* '(tree[[:space:]]+nuts?|noix|amande|noisette|pistache|pecan|fruits?[[:space:]]+[àa][[:space:]]+coque)'),
      ('crustaceans', legacy.legacy_value ~* '(crustac|homard|lobster|crevette|shrimp|crabe|crab)'),
      ('shellfish', legacy.legacy_value ~* '(shellfish|fruits?[[:space:]]+de[[:space:]]+mer|seafood)'),
      ('molluscs', legacy.legacy_value ~* '(mollusc|mollusk|mollusque|moule|hu[iî]tre|oyster)'),
      ('peanuts', legacy.legacy_value ~* '(peanut|arachide|cacahu)'),
      ('sesame', legacy.legacy_value ~* '(sesame|sésame|sesamo|sesam)'),
      ('soy', legacy.legacy_value ~* '(soy|soja|soya|soia)'),
      ('mustard', legacy.legacy_value ~* '(mustard|moutarde|mostaza|senape|senf)'),
      ('fish', legacy.legacy_value ~* '(fish|poisson|pescado|pesce|fisch|thon|tuna|saumon|salmon|bar|cabillaud)'),
      ('sulfites', legacy.legacy_value ~* '(sulfite|sulphite|sulfito)')
  ) as registry(allergen_id, matches)
  where registry.matches
    and legacy.legacy_value !~* '(^|[[:space:]-])(sans|free[[:space:]]*[-]?[[:space:]]*(from|of)|gluten[[:space:]]*[-]?[[:space:]]*free|dairy[[:space:]]*[-]?[[:space:]]*free|lactose[[:space:]]*[-]?[[:space:]]*free)([[:space:]-]|$)'
), resolved as (
  select
    id,
    allergen_id,
    case when bool_or(status = 'contains') then 'contains' else 'may_contain' end as status
  from mapped
  group by id, allergen_id
), payloads as (
  select
    id,
    jsonb_agg(
      jsonb_build_object('allergenId', allergen_id, 'status', status)
      order by allergen_id
    ) as declarations
  from resolved
  group by id
)
update public.menu_dishes as dish
set allergen_declarations = payloads.declarations
from payloads
where dish.id = payloads.id
  and dish.allergen_declarations is null;

create or replace function public.validate_allergen_declarations(p_declarations jsonb)
returns void
language plpgsql
immutable
set search_path = public
as $$
declare
  v_item jsonb;
  v_allergen_id text;
  v_status text;
begin
  if p_declarations is null or jsonb_typeof(p_declarations) = 'null' then
    return;
  end if;
  if jsonb_typeof(p_declarations) <> 'array' then
    raise exception 'allergen_declarations must be an array';
  end if;
  if jsonb_array_length(p_declarations) > 13 then
    raise exception 'too many allergen declarations';
  end if;

  for v_item in select value from jsonb_array_elements(p_declarations)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'allergen declaration must be an object';
    end if;
    v_allergen_id := v_item ->> 'allergenId';
    v_status := v_item ->> 'status';
    if v_allergen_id is null or v_allergen_id = '' then
      raise exception 'allergen declaration allergenId is required';
    end if;
    if v_status is null or v_status = '' then
      raise exception 'allergen declaration status is required';
    end if;
    if v_allergen_id not in (
      'gluten', 'dairy', 'eggs', 'tree_nuts', 'crustaceans', 'shellfish',
      'molluscs', 'peanuts', 'sesame', 'soy', 'mustard', 'fish', 'sulfites'
    ) then
      raise exception 'unknown allergen id';
    end if;
    if v_status not in ('contains', 'may_contain', 'confirmed_free', 'unknown') then
      raise exception 'unknown allergen status';
    end if;
  end loop;

  if exists (
    select declaration ->> 'allergenId'
    from jsonb_array_elements(p_declarations) as item(declaration)
    group by declaration ->> 'allergenId'
    having count(*) > 1
  ) then
    raise exception 'duplicate allergen declaration';
  end if;
end;
$$;

revoke all on function public.validate_allergen_declarations(jsonb) from public, anon, authenticated;
grant execute on function public.validate_allergen_declarations(jsonb) to service_role;

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
    name, slug, location, city, cuisine_type, status, contact_name,
    contact_email, contact_phone, google_review_enabled, google_review_url,
    notes, public_menu_url
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
    select value from jsonb_array_elements(coalesce(p_payload -> 'categories', '[]'::jsonb))
  loop
    insert into public.menu_categories (
      restaurant_id, menu_id, name, slug, description, display_order
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
    select value from jsonb_array_elements(coalesce(p_payload -> 'dishes', '[]'::jsonb))
  loop
    perform public.validate_allergen_declarations(
      case
        when v_dish ? 'allergen_declarations' then v_dish -> 'allergen_declarations'
        else null
      end
    );

    v_category_id := null;
    if v_dish ? 'category_slug' then
      v_category_id := nullif(v_category_ids ->> (v_dish ->> 'category_slug'), '')::uuid;
    end if;

    insert into public.menu_dishes (
      restaurant_id, menu_id, category_id, slug, name, short_description,
      description, price_cents, currency, image_url, is_available,
      is_signature, is_recommended, has_immersive_view, allergens,
      allergen_declarations, metadata
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
      coalesce(array(select jsonb_array_elements_text(coalesce(v_dish -> 'allergens', '[]'::jsonb))), '{}'::text[]),
      case when v_dish ? 'allergen_declarations' then v_dish -> 'allergen_declarations' else null end,
      coalesce(v_dish -> 'metadata', '{}'::jsonb)
    );

    v_dish_count := v_dish_count + 1;
  end loop;

  insert into public.menu_ui_configs (restaurant_id, theme, config_json, status)
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
