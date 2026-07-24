-- Unique menu design: atomic draft+published fallback on create,
-- lifecycle mutation with optimistic concurrency, and atomic public menu style
-- updates involving unique identity. Idempotent for harness re-runs.
-- Rollback: re-apply previous create_owner_restaurant_with_menu from
-- 20260723120000_allergen_declarations_safety.sql and drop the two new RPCs.

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
  v_config_json jsonb := coalesce(v_ui_config -> 'config_json', '{}'::jsonb);
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
  v_settings jsonb := coalesce(v_menu -> 'settings_json', '{}'::jsonb);
  v_is_unique boolean := false;
  v_unique_design jsonb := null;
  v_draft_row public.menu_ui_configs%rowtype;
  v_published_row public.menu_ui_configs%rowtype;
  v_theme text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'create_owner_restaurant_with_menu payload must be an object';
  end if;

  v_is_unique :=
    coalesce(v_settings ->> 'publicMenuStyle', '') = 'unique'
    or coalesce(v_config_json ->> 'publicMenuStyle', '') = 'unique'
    or jsonb_typeof(v_config_json -> 'uniqueDesign') = 'object';

  if v_is_unique then
    v_unique_design := v_config_json -> 'uniqueDesign';
    if jsonb_typeof(v_unique_design) <> 'object' then
      raise exception 'unique creation requires uniqueDesign in ui_config.config_json';
    end if;
    if coalesce(v_unique_design ->> 'designId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'unique creation requires a canonical designId UUID';
    end if;
    -- Force pending identity semantics at insert time.
    v_unique_design := jsonb_set(v_unique_design, '{status}', '"pending"'::jsonb, true);
    v_unique_design := jsonb_set(v_unique_design, '{rendererKey}', 'null'::jsonb, true);
    v_unique_design := jsonb_set(v_unique_design, '{rendererVersion}', 'null'::jsonb, true);
    v_unique_design := jsonb_set(v_unique_design, '{version}', '1'::jsonb, true);
    v_config_json := jsonb_set(v_config_json, '{uniqueDesign}', v_unique_design, true);
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
      when jsonb_typeof(v_settings) = 'object' then v_settings
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
    if to_regprocedure('public.validate_allergen_declarations(jsonb)') is not null then
      perform public.validate_allergen_declarations(
        case
          when v_dish ? 'allergen_declarations' then v_dish -> 'allergen_declarations'
          else null
        end
      );
    end if;

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

  v_theme := coalesce(nullif(v_ui_config ->> 'theme', ''), 'fresh-homemade');

  if v_is_unique then
    insert into public.menu_ui_configs (restaurant_id, theme, config_json, status)
    values (v_restaurant_row.id, v_theme, v_config_json, 'draft')
    returning * into v_draft_row;

    insert into public.menu_ui_configs (restaurant_id, theme, config_json, status)
    values (v_restaurant_row.id, v_theme, v_config_json, 'published')
    returning * into v_published_row;

    -- Re-read identity from the inserted draft row (source of truth).
    v_unique_design := coalesce(v_draft_row.config_json -> 'uniqueDesign', '{}'::jsonb);
  else
    insert into public.menu_ui_configs (restaurant_id, theme, config_json, status)
    values (
      v_restaurant_row.id,
      v_theme,
      v_config_json,
      coalesce(nullif(v_ui_config ->> 'status', ''), 'draft')
    )
    on conflict do nothing
    returning * into v_draft_row;
  end if;

  v_media_base_path := 'restaurants/' || v_restaurant_row.id::text || '/photos/';

  return jsonb_build_object(
    'ok', true,
    'restaurantPersisted', true,
    'menuPersisted', true,
    'categoriesPersisted', true,
    'dishesPersisted', true,
    'uiConfigPersisted', true,
    'draftConfigPersisted', v_is_unique and v_draft_row.id is not null,
    'publishedFallbackPersisted', v_is_unique and v_published_row.id is not null,
    'uniqueDesignPersisted', v_is_unique and jsonb_typeof(v_unique_design) = 'object',
    'uniqueDesignId', case when v_is_unique then v_unique_design ->> 'designId' else null end,
    'uniqueDesignStatus', case when v_is_unique then v_unique_design ->> 'status' else null end,
    'uniqueDesign', case when v_is_unique then v_unique_design else null end,
    'publishedConfigId', case when v_is_unique then v_published_row.id else null end,
    'draftConfigId', case when v_draft_row.id is not null then v_draft_row.id else null end,
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

-- Lifecycle CAS for unique design identity shared by draft + published configs.
-- Drop the previous 5-arg overload before creating the 6-arg signature.
drop function if exists public.mutate_owner_unique_menu_design(uuid, uuid, integer, text, text);

create or replace function public.mutate_owner_unique_menu_design(
  p_restaurant_id uuid,
  p_design_id uuid,
  p_expected_version integer,
  p_action text,
  p_renderer_key text default null,
  p_renderer_version integer default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_draft public.menu_ui_configs%rowtype;
  v_published public.menu_ui_configs%rowtype;
  v_draft_design jsonb;
  v_published_design jsonb;
  v_design jsonb;
  v_status text;
  v_version integer;
  v_now timestamptz := now();
  v_next jsonb;
  v_next_version integer;
  v_row_count integer;
  v_draft_persisted boolean := false;
  v_published_persisted boolean := false;
begin
  if p_action is null or p_action not in ('start', 'mark-ready', 'publish', 'archive', 'create-new') then
    return jsonb_build_object('ok', false, 'status', 400, 'error', 'Action unique non autorisee.');
  end if;

  select * into v_draft
  from public.menu_ui_configs
  where restaurant_id = p_restaurant_id and status = 'draft'
  order by updated_at desc
  limit 1
  for update;

  select * into v_published
  from public.menu_ui_configs
  where restaurant_id = p_restaurant_id and status = 'published'
  order by updated_at desc
  limit 1
  for update;

  if p_action <> 'create-new' then
    -- Unique lifecycle mutations require both rows before any write.
    if v_draft.id is null or v_published.id is null then
      return jsonb_build_object(
        'ok', false,
        'status', 400,
        'error', 'Draft et published requis pour cette action unique.'
      );
    end if;

    v_draft_design := coalesce(v_draft.config_json, '{}'::jsonb) -> 'uniqueDesign';
    v_published_design := coalesce(v_published.config_json, '{}'::jsonb) -> 'uniqueDesign';

    if jsonb_typeof(v_draft_design) <> 'object' or jsonb_typeof(v_published_design) <> 'object' then
      return jsonb_build_object('ok', false, 'status', 404, 'error', 'Identite unique introuvable.');
    end if;

    -- Identity must match across draft and published before mutation.
    if
      coalesce(v_draft_design ->> 'designId', '') is distinct from coalesce(v_published_design ->> 'designId', '')
      or coalesce(v_draft_design ->> 'version', '') is distinct from coalesce(v_published_design ->> 'version', '')
      or coalesce(v_draft_design ->> 'status', '') is distinct from coalesce(v_published_design ->> 'status', '')
      or coalesce(v_draft_design ->> 'rendererKey', '') is distinct from coalesce(v_published_design ->> 'rendererKey', '')
      or coalesce(v_draft_design ->> 'rendererVersion', '') is distinct from coalesce(v_published_design ->> 'rendererVersion', '')
    then
      return jsonb_build_object(
        'ok', false,
        'status', 409,
        'error', 'Identite unique divergente entre draft et published.'
      );
    end if;

    v_design := v_draft_design;
  else
    -- create-new requires both rows so a live published identity cannot be wiped alone.
    if v_draft.id is null or v_published.id is null then
      return jsonb_build_object(
        'ok', false,
        'status', 400,
        'error', 'Draft et published requis pour create-new.'
      );
    end if;

    v_draft_design := coalesce(v_draft.config_json, '{}'::jsonb) -> 'uniqueDesign';
    v_published_design := coalesce(v_published.config_json, '{}'::jsonb) -> 'uniqueDesign';

    if jsonb_typeof(v_draft_design) = 'object'
       and coalesce(v_draft_design ->> 'status', '') <> 'archived' then
      return jsonb_build_object(
        'ok', false,
        'status', 400,
        'error', 'create-new exige un design archive.'
      );
    end if;

    if jsonb_typeof(v_published_design) = 'object'
       and coalesce(v_published_design ->> 'status', '') <> 'archived' then
      return jsonb_build_object(
        'ok', false,
        'status', 400,
        'error', 'create-new exige un design archive sur draft et published.'
      );
    end if;

    if jsonb_typeof(v_draft_design) = 'object'
       and jsonb_typeof(v_published_design) = 'object' then
      if
        coalesce(v_draft_design ->> 'designId', '') is distinct from coalesce(v_published_design ->> 'designId', '')
        or coalesce(v_draft_design ->> 'version', '') is distinct from coalesce(v_published_design ->> 'version', '')
        or coalesce(v_draft_design ->> 'status', '') is distinct from coalesce(v_published_design ->> 'status', '')
        or coalesce(v_draft_design ->> 'rendererKey', '') is distinct from coalesce(v_published_design ->> 'rendererKey', '')
        or coalesce(v_draft_design ->> 'rendererVersion', '') is distinct from coalesce(v_published_design ->> 'rendererVersion', '')
      then
        return jsonb_build_object(
          'ok', false,
          'status', 409,
          'error', 'Identite unique divergente entre draft et published.'
        );
      end if;
    end if;

    v_design := v_draft_design;
  end if;

  if p_action = 'create-new' then
    v_next := jsonb_build_object(
      'mode', 'unique',
      'designId', gen_random_uuid()::text,
      'status', 'pending',
      'rendererKey', null,
      'rendererVersion', null,
      'version', 1,
      'createdAt', to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'updatedAt', to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );
  else
    if coalesce(v_design ->> 'designId', '') <> p_design_id::text then
      return jsonb_build_object('ok', false, 'status', 409, 'error', 'designId concurrent.');
    end if;
    v_version := coalesce((v_design ->> 'version')::integer, 0);
    if v_version <> p_expected_version then
      return jsonb_build_object('ok', false, 'status', 409, 'error', 'version concurrente.');
    end if;
    v_status := coalesce(v_design ->> 'status', 'pending');
    v_next_version := v_version + 1;
    v_next := v_design;
    v_next := jsonb_set(v_next, '{version}', to_jsonb(v_next_version), true);
    v_next := jsonb_set(
      v_next,
      '{updatedAt}',
      to_jsonb(to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      true
    );

    if p_action = 'start' then
      if v_status <> 'pending' then
        return jsonb_build_object('ok', false, 'status', 400, 'error', 'Transition interdite vers draft.');
      end if;
      v_next := jsonb_set(v_next, '{status}', '"draft"'::jsonb, true);
    elsif p_action = 'mark-ready' then
      if v_status <> 'draft' and v_status <> 'ready' then
        return jsonb_build_object('ok', false, 'status', 400, 'error', 'Transition interdite vers ready.');
      end if;
      if p_renderer_key is null or length(trim(p_renderer_key)) < 2 then
        return jsonb_build_object('ok', false, 'status', 400, 'error', 'rendererKey requis.');
      end if;
      if p_renderer_version is null or p_renderer_version < 1 then
        return jsonb_build_object('ok', false, 'status', 400, 'error', 'rendererVersion requis (>= 1).');
      end if;
      -- Registry binding is enforced in the Node layer; SQL stores key+version after app validation.
      v_next := jsonb_set(v_next, '{status}', '"ready"'::jsonb, true);
      v_next := jsonb_set(v_next, '{rendererKey}', to_jsonb(p_renderer_key), true);
      v_next := jsonb_set(v_next, '{rendererVersion}', to_jsonb(p_renderer_version), true);
    elsif p_action = 'publish' then
      if v_status <> 'ready' then
        return jsonb_build_object('ok', false, 'status', 400, 'error', 'Transition interdite vers published.');
      end if;
      if coalesce(v_design ->> 'rendererKey', '') = '' then
        return jsonb_build_object('ok', false, 'status', 400, 'error', 'Publication sans rendererKey.');
      end if;
      if coalesce((v_design ->> 'rendererVersion')::integer, 0) < 1 then
        return jsonb_build_object('ok', false, 'status', 400, 'error', 'Publication sans rendererVersion.');
      end if;
      v_next := jsonb_set(v_next, '{status}', '"published"'::jsonb, true);
    elsif p_action = 'archive' then
      if v_status = 'archived' then
        return jsonb_build_object('ok', false, 'status', 400, 'error', 'Deja archive.');
      end if;
      v_next := jsonb_set(v_next, '{status}', '"archived"'::jsonb, true);
    end if;
  end if;

  if v_draft.id is not null then
    update public.menu_ui_configs
    set
      config_json = jsonb_set(coalesce(config_json, '{}'::jsonb), '{uniqueDesign}', v_next, true),
      updated_at = v_now
    where id = v_draft.id
      and (
        p_action = 'create-new'
        or (
          coalesce(config_json #>> '{uniqueDesign,designId}', '') = p_design_id::text
          and coalesce((config_json #>> '{uniqueDesign,version}')::integer, -1) = p_expected_version
        )
      );
    get diagnostics v_row_count = row_count;
    if v_row_count <> 1 then
      raise exception 'mutate_owner_unique_menu_design: draft update expected 1 row, got %', v_row_count;
    end if;
    v_draft_persisted := true;
  end if;

  if v_published.id is not null then
    update public.menu_ui_configs
    set
      config_json = jsonb_set(coalesce(config_json, '{}'::jsonb), '{uniqueDesign}', v_next, true),
      updated_at = v_now
    where id = v_published.id
      and (
        p_action = 'create-new'
        or (
          coalesce(config_json #>> '{uniqueDesign,designId}', '') = p_design_id::text
          and coalesce((config_json #>> '{uniqueDesign,version}')::integer, -1) = p_expected_version
        )
      );
    get diagnostics v_row_count = row_count;
    if v_row_count <> 1 then
      raise exception 'mutate_owner_unique_menu_design: published update expected 1 row, got %', v_row_count;
    end if;
    v_published_persisted := true;
  end if;

  -- For non-create-new both rows were required; for create-new update only existing rows.
  if p_action <> 'create-new' and (not v_draft_persisted or not v_published_persisted) then
    raise exception 'mutate_owner_unique_menu_design: required draft/published persist failed';
  end if;

  -- Re-read both rows and verify identity consistency after writes.
  select * into v_draft
  from public.menu_ui_configs
  where restaurant_id = p_restaurant_id and status = 'draft'
  order by updated_at desc
  limit 1;

  select * into v_published
  from public.menu_ui_configs
  where restaurant_id = p_restaurant_id and status = 'published'
  order by updated_at desc
  limit 1;

  if p_action <> 'create-new' then
    if v_draft.id is null or v_published.id is null then
      raise exception 'mutate_owner_unique_menu_design: missing draft/published after update';
    end if;
  end if;

  v_draft_design := coalesce(v_draft.config_json, '{}'::jsonb) -> 'uniqueDesign';
  v_published_design := coalesce(v_published.config_json, '{}'::jsonb) -> 'uniqueDesign';

  if v_draft.id is not null and v_published.id is not null then
    if
      coalesce(v_draft_design ->> 'designId', '') is distinct from coalesce(v_published_design ->> 'designId', '')
      or coalesce(v_draft_design ->> 'version', '') is distinct from coalesce(v_published_design ->> 'version', '')
      or coalesce(v_draft_design ->> 'status', '') is distinct from coalesce(v_published_design ->> 'status', '')
      or coalesce(v_draft_design ->> 'rendererKey', '') is distinct from coalesce(v_published_design ->> 'rendererKey', '')
      or coalesce(v_draft_design ->> 'rendererVersion', '') is distinct from coalesce(v_published_design ->> 'rendererVersion', '')
    then
      raise exception 'mutate_owner_unique_menu_design: post-update identity mismatch';
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'uniqueDesign', case
      when v_draft.id is not null then v_draft_design
      else v_published_design
    end,
    'draftPersisted', v_draft_persisted,
    'publishedPersisted', v_published_persisted,
    'draftConfigId', v_draft.id,
    'publishedConfigId', v_published.id
  );
end;
$$;

revoke execute on function public.mutate_owner_unique_menu_design(uuid, uuid, integer, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.mutate_owner_unique_menu_design(uuid, uuid, integer, text, text, integer)
  to service_role;

-- Atomic public menu style mutation for unique transitions.
create or replace function public.mutate_owner_public_menu_settings_atomic(
  p_restaurant_id uuid,
  p_settings jsonb,
  p_unique_design jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_menu public.menus%rowtype;
  v_draft public.menu_ui_configs%rowtype;
  v_published public.menu_ui_configs%rowtype;
  v_style text := coalesce(p_settings ->> 'publicMenuStyle', 'trouvable');
  v_design jsonb := p_unique_design;
  v_now timestamptz := now();
begin
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
    raise exception 'settings payload must be an object';
  end if;

  select * into v_menu
  from public.menus
  where restaurant_id = p_restaurant_id and is_primary = true
  order by updated_at desc
  limit 1
  for update;

  if v_menu.id is null then
    return jsonb_build_object('ok', false, 'status', 404, 'error', 'Menu principal introuvable.');
  end if;

  update public.menus
  set
    settings_json = p_settings,
    updated_at = v_now
  where id = v_menu.id
  returning * into v_menu;

  select * into v_draft
  from public.menu_ui_configs
  where restaurant_id = p_restaurant_id and status = 'draft'
  order by updated_at desc
  limit 1
  for update;

  select * into v_published
  from public.menu_ui_configs
  where restaurant_id = p_restaurant_id and status = 'published'
  order by updated_at desc
  limit 1
  for update;

  if v_style = 'unique' then
    if jsonb_typeof(v_design) <> 'object' then
      v_design := jsonb_build_object(
        'mode', 'unique',
        'designId', gen_random_uuid()::text,
        'status', 'pending',
        'rendererKey', null,
        'rendererVersion', null,
        'version', 1,
        'createdAt', to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'updatedAt', to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      );
    end if;

    if v_draft.id is null then
      insert into public.menu_ui_configs (restaurant_id, theme, config_json, status)
      values (
        p_restaurant_id,
        'fresh-homemade',
        jsonb_build_object(
          'publicMenuSettings', p_settings,
          'publicMenuStyle', 'unique',
          'uniqueDesign', v_design
        ),
        'draft'
      )
      returning * into v_draft;
    else
      update public.menu_ui_configs
      set
        config_json = jsonb_set(
          jsonb_set(
            jsonb_set(coalesce(config_json, '{}'::jsonb), '{publicMenuSettings}', p_settings, true),
            '{publicMenuStyle}',
            '"unique"'::jsonb,
            true
          ),
          '{uniqueDesign}',
          v_design,
          true
        ),
        updated_at = v_now
      where id = v_draft.id
      returning * into v_draft;
    end if;

    if v_published.id is null then
      insert into public.menu_ui_configs (restaurant_id, theme, config_json, status)
      values (
        p_restaurant_id,
        coalesce(v_draft.theme, 'fresh-homemade'),
        coalesce(v_draft.config_json, '{}'::jsonb),
        'published'
      )
      returning * into v_published;
    else
      update public.menu_ui_configs
      set
        config_json = jsonb_set(
          jsonb_set(
            jsonb_set(coalesce(config_json, '{}'::jsonb), '{publicMenuSettings}', p_settings, true),
            '{publicMenuStyle}',
            '"unique"'::jsonb,
            true
          ),
          '{uniqueDesign}',
          v_design,
          true
        ),
        updated_at = v_now
      where id = v_published.id
      returning * into v_published;
    end if;
  else
    -- Leaving unique: archive identity in snapshots then clear active identity.
    if v_draft.id is not null then
      update public.menu_ui_configs
      set
        config_json = (
          jsonb_set(
            jsonb_set(coalesce(config_json, '{}'::jsonb), '{publicMenuSettings}', p_settings, true),
            '{publicMenuStyle}',
            to_jsonb(v_style),
            true
          ) - 'uniqueDesign'
        ),
        updated_at = v_now
      where id = v_draft.id
      returning * into v_draft;
    end if;
    if v_published.id is not null then
      update public.menu_ui_configs
      set
        config_json = (
          jsonb_set(
            jsonb_set(coalesce(config_json, '{}'::jsonb), '{publicMenuSettings}', p_settings, true),
            '{publicMenuStyle}',
            to_jsonb(v_style),
            true
          ) - 'uniqueDesign'
        ),
        updated_at = v_now
      where id = v_published.id
      returning * into v_published;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'menuId', v_menu.id,
    'settings', p_settings,
    'uniqueDesign', case when v_style = 'unique' then v_design else null end,
    'draftConfigId', v_draft.id,
    'publishedConfigId', v_published.id
  );
end;
$$;

revoke execute on function public.mutate_owner_public_menu_settings_atomic(uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.mutate_owner_public_menu_settings_atomic(uuid, jsonb, jsonb)
  to service_role;

notify pgrst, 'reload schema';
