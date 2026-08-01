-- Atomic, service-role-only translation backfill.
--
-- The caller sends the complete dry-run snapshot for every target menu. Every
-- menu is locked in deterministic order, every existing translation row is
-- compared to its snapshot while locked, and one conflict rolls back the
-- whole batch. This prevents an editor change from being overwritten and
-- prevents a partial Maison/Trouvable/Sauge application.

create or replace function public.owner_apply_menu_translation_backfill(
  p_plans jsonb
)
returns table(
  result_status text,
  applied_rows integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan jsonb;
  v_operation jsonb;
  v_expected jsonb;
  v_patch jsonb;
  v_action text;
  v_entity_type text;
  v_locale text;
  v_restaurant_id uuid;
  v_menu_id uuid;
  v_entity_id uuid;
  v_current_id uuid;
  v_current_updated_at timestamptz;
  v_current_source_hash text;
  v_current_field_hashes jsonb;
  v_current_content jsonb;
  v_current_manual_overrides jsonb;
  v_current_translation_status text;
  v_current_provider text;
  v_current_error_message text;
  v_current_translated_at timestamptz;
  v_menu public.menus%rowtype;
  v_applied_rows integer := 0;
begin
  if p_plans is null
     or jsonb_typeof(p_plans) <> 'array'
     or jsonb_array_length(p_plans) = 0 then
    raise exception using
      errcode = '22023',
      message = 'Translation backfill RPC requires a non-empty plan array.';
  end if;

  -- Validate every plan and operation before reading or locking any menu. The
  -- payload is intentionally explicit: partial JSON objects are valid only
  -- where the translation model permits a partial field map.
  for v_plan in
    select value
      from jsonb_array_elements(p_plans) as item(value)
  loop
    if jsonb_typeof(v_plan) <> 'object'
       or v_plan->>'restaurant_id' is null
       or v_plan->>'menu_id' is null then
      raise exception using
        errcode = '22023',
        message = 'Translation backfill plan identity is incomplete.';
    end if;

    v_locale := v_plan->>'locale';
    if v_locale is distinct from 'en-CA' then
      raise exception using
        errcode = '22023',
        message = 'Translation backfill currently supports only en-CA because the current datasets are exclusively Canadian English.';
    end if;
    if v_plan->>'expected_menu_updated_at' is null
       or jsonb_typeof(v_plan->'expected_menu_settings') <> 'object'
       or jsonb_typeof(v_plan->'desired_menu_settings') <> 'object'
       or jsonb_typeof(v_plan->'operations') <> 'array' then
      raise exception using
        errcode = '22023',
        message = 'Translation backfill plan snapshot is incomplete.';
    end if;

    for v_operation in
      select value
        from jsonb_array_elements(v_plan->'operations') as item(value)
    loop
      if jsonb_typeof(v_operation) <> 'object' then
        raise exception using
          errcode = '22023',
          message = 'Translation backfill operation must be an object.';
      end if;
      v_action := v_operation->>'action';
      if v_action = 'noop' then
        continue;
      end if;
      v_patch := v_operation->'patch';
      if v_action is null
         or v_action not in ('insert', 'update')
         or v_patch is null
         or jsonb_typeof(v_patch) <> 'object'
         or v_operation->>'entity_type' is null
         or v_operation->>'entity_type' not in ('menu', 'category', 'dish')
         or v_operation->>'entity_id' is null
         or v_patch->>'restaurant_id' is distinct from v_plan->>'restaurant_id'
         or v_patch->>'menu_id' is distinct from v_plan->>'menu_id'
         or v_patch->>'locale' is distinct from v_locale
         or (v_operation->>'entity_type' = 'menu' and v_patch->>'menu_id' is distinct from v_operation->>'entity_id')
         or (v_operation->>'entity_type' = 'category' and v_patch->>'category_id' is distinct from v_operation->>'entity_id')
         or (v_operation->>'entity_type' = 'dish' and v_patch->>'dish_id' is distinct from v_operation->>'entity_id')
         or jsonb_typeof(v_patch->'translation_status') <> 'string'
         or v_patch->>'translation_status' not in ('source', 'missing', 'pending', 'in_progress', 'up_to_date', 'stale', 'error')
         or jsonb_typeof(v_patch->'source_hash') <> 'string'
         or jsonb_typeof(v_patch->'field_hashes') <> 'object'
         or jsonb_typeof(v_patch->'content') <> 'object'
         or jsonb_typeof(v_patch->'manual_overrides') <> 'object'
          or not (v_patch ? 'provider')
          or (v_patch->'provider' <> 'null'::jsonb and jsonb_typeof(v_patch->'provider') <> 'string')
         or not (v_patch ? 'error_message')
         or not (v_patch ? 'translated_at')
         or (v_patch->'error_message' <> 'null'::jsonb and jsonb_typeof(v_patch->'error_message') <> 'string')
         or (v_patch->'translated_at' <> 'null'::jsonb and jsonb_typeof(v_patch->'translated_at') <> 'string') then
        raise exception using
          errcode = '22023',
          message = 'Translation backfill operation patch is incomplete or violates translation column constraints.';
      end if;
      if exists (
        select 1
          from jsonb_each(v_patch->'field_hashes') as field_map(field_name, field_value)
         where jsonb_typeof(field_value) <> 'string'
            or field_value #>> '{}' = ''
      ) then
        raise exception using
          errcode = '22023',
          message = 'Translation backfill field_hashes values must be non-empty strings.';
      end if;
      if exists (
        select 1
          from jsonb_each(v_patch->'manual_overrides') as override_map(field_name, field_value)
         where jsonb_typeof(field_value) <> 'boolean'
      ) then
        raise exception using
          errcode = '22023',
          message = 'Translation backfill manual_overrides values must be boolean.';
      end if;

      if v_action = 'insert' then
        if not (v_operation ? 'expected') or jsonb_typeof(v_operation->'expected') <> 'null' then
          raise exception using
            errcode = '22023',
            message = 'Translation backfill insert operations require an explicit null expected snapshot.';
        end if;
      else
        if jsonb_typeof(v_operation->'expected') <> 'object'
           or v_operation->'expected'->>'id' is null
           or jsonb_typeof(v_operation->'expected'->'updated_at') <> 'string'
           or jsonb_typeof(v_operation->'expected'->'source_hash') <> 'string'
           or jsonb_typeof(v_operation->'expected'->'field_hashes') <> 'object'
           or jsonb_typeof(v_operation->'expected'->'content') <> 'object'
           or jsonb_typeof(v_operation->'expected'->'manual_overrides') <> 'object'
           or jsonb_typeof(v_operation->'expected'->'translation_status') <> 'string'
           or not (v_operation->'expected' ? 'provider')
           or (v_operation->'expected'->'provider' <> 'null'::jsonb and jsonb_typeof(v_operation->'expected'->'provider') <> 'string')
           or not (v_operation->'expected' ? 'error_message')
           or (v_operation->'expected'->'error_message' <> 'null'::jsonb and jsonb_typeof(v_operation->'expected'->'error_message') <> 'string')
           or not (v_operation->'expected' ? 'translated_at')
           or (v_operation->'expected'->'translated_at' <> 'null'::jsonb and jsonb_typeof(v_operation->'expected'->'translated_at') <> 'string') then
           raise exception using
             errcode = '22023',
             message = 'Translation backfill update operations require a complete expected snapshot.';
         end if;
         if exists (
           select 1
             from jsonb_each(v_operation->'expected'->'field_hashes') as expected_field_map(field_name, field_value)
            where jsonb_typeof(field_value) <> 'string'
               or field_value #>> '{}' = ''
         ) then
           raise exception using
             errcode = '22023',
             message = 'Translation backfill expected field_hashes values must be non-empty strings.';
         end if;
         if exists (
           select 1
             from jsonb_each(v_operation->'expected'->'manual_overrides') as expected_override_map(field_name, field_value)
            where jsonb_typeof(field_value) <> 'boolean'
         ) then
           raise exception using
             errcode = '22023',
             message = 'Translation backfill expected manual_overrides values must be boolean.';
         end if;
       end if;
    end loop;
  end loop;

  -- Lock all menus in a deterministic order before changing any row.
  for v_plan in
    select value
      from jsonb_array_elements(p_plans) as item(value)
     order by value->>'menu_id'
  loop
    if jsonb_typeof(v_plan) <> 'object'
       or v_plan->>'restaurant_id' is null
       or v_plan->>'menu_id' is null then
      raise exception using
        errcode = '22023',
        message = 'Translation backfill plan identity is incomplete.';
    end if;

    v_locale := v_plan->>'locale';
    if v_locale is distinct from 'en-CA' then
      raise exception using
        errcode = '22023',
        message = 'Translation backfill currently supports only en-CA because the current datasets are exclusively Canadian English.';
    end if;
    v_restaurant_id := (v_plan->>'restaurant_id')::uuid;
    v_menu_id := (v_plan->>'menu_id')::uuid;

    if v_plan->>'expected_menu_updated_at' is null
       or jsonb_typeof(v_plan->'expected_menu_settings') <> 'object'
       or jsonb_typeof(v_plan->'desired_menu_settings') <> 'object'
       or jsonb_typeof(v_plan->'operations') <> 'array' then
      raise exception using
        errcode = '22023',
        message = 'Translation backfill requires an updated_at menu snapshot.';
    end if;

    select menu.*
      into v_menu
      from public.menus as menu
     where menu.id = v_menu_id
       and menu.restaurant_id = v_restaurant_id
     for update;

    if not found then
      raise exception using
        errcode = 'P0002',
        message = 'Translation backfill menu was not found for the requested restaurant.';
    end if;

    if v_menu.updated_at is distinct from (v_plan->>'expected_menu_updated_at')::timestamptz
       or v_menu.settings_json is distinct from v_plan->'expected_menu_settings' then
      raise exception using
        errcode = '40001',
        message = 'Translation backfill menu snapshot conflict.';
    end if;

    if v_menu.settings_json is distinct from v_plan->'desired_menu_settings' then
      update public.menus
         set settings_json = v_plan->'desired_menu_settings',
             updated_at = now()
       where id = v_menu_id
         and restaurant_id = v_restaurant_id;
    end if;

    for v_operation in
      select value
        from jsonb_array_elements(v_plan->'operations') as item(value)
    loop
      v_action := v_operation->>'action';
      if v_action = 'noop' then
        continue;
      end if;
      if v_action not in ('insert', 'update') then
        raise exception using
          errcode = '22023',
          message = 'Translation backfill operation has an unsupported action.';
      end if;

      v_entity_type := v_operation->>'entity_type';
      v_entity_id := (v_operation->>'entity_id')::uuid;
      v_expected := case when v_operation->>'expected' is null then null else v_operation->'expected' end;
      v_patch := v_operation->'patch';
      if v_entity_type not in ('menu', 'category', 'dish')
         or v_entity_id is null
         or jsonb_typeof(v_patch) <> 'object' then
        raise exception using
          errcode = '22023',
          message = 'Translation backfill operation is incomplete.';
      end if;

      v_current_id := null;
      v_current_updated_at := null;
      v_current_source_hash := null;
      v_current_field_hashes := null;
      v_current_content := null;
      v_current_manual_overrides := null;
      v_current_translation_status := null;
      v_current_provider := null;
      v_current_error_message := null;
      v_current_translated_at := null;

      if v_entity_type = 'menu' then
        if v_entity_id <> v_menu_id then
          raise exception using errcode = '22023', message = 'Menu translation operation targets another menu.';
        end if;
        select translation.id, translation.updated_at, translation.translation_status,
               translation.provider, translation.source_hash, translation.field_hashes,
               translation.content, translation.manual_overrides, translation.error_message,
               translation.translated_at
          into v_current_id, v_current_updated_at,
               v_current_translation_status, v_current_provider, v_current_source_hash,
               v_current_field_hashes, v_current_content, v_current_manual_overrides,
               v_current_error_message, v_current_translated_at
          from public.menu_translations as translation
         where translation.menu_id = v_menu_id
           and translation.locale = v_locale
         for update;
      elsif v_entity_type = 'category' then
        if not exists (
          select 1 from public.menu_categories as category
           where category.id = v_entity_id
             and category.restaurant_id = v_restaurant_id
             and category.menu_id = v_menu_id
        ) then
          raise exception using errcode = '22023', message = 'Category translation operation has an invalid relation.';
        end if;
        select translation.id, translation.updated_at, translation.translation_status,
               translation.provider, translation.source_hash, translation.field_hashes,
               translation.content, translation.manual_overrides, translation.error_message,
               translation.translated_at
          into v_current_id, v_current_updated_at,
               v_current_translation_status, v_current_provider, v_current_source_hash,
               v_current_field_hashes, v_current_content, v_current_manual_overrides,
               v_current_error_message, v_current_translated_at
          from public.menu_category_translations as translation
         where translation.category_id = v_entity_id
           and translation.locale = v_locale
         for update;
      else
        if not exists (
          select 1 from public.menu_dishes as dish
           where dish.id = v_entity_id
             and dish.restaurant_id = v_restaurant_id
             and dish.menu_id = v_menu_id
        ) then
          raise exception using errcode = '22023', message = 'Dish translation operation has an invalid relation.';
        end if;
        select translation.id, translation.updated_at, translation.translation_status,
               translation.provider, translation.source_hash, translation.field_hashes,
               translation.content, translation.manual_overrides, translation.error_message,
               translation.translated_at
          into v_current_id, v_current_updated_at,
               v_current_translation_status, v_current_provider, v_current_source_hash,
               v_current_field_hashes, v_current_content, v_current_manual_overrides,
               v_current_error_message, v_current_translated_at
          from public.menu_dish_translations as translation
         where translation.dish_id = v_entity_id
           and translation.locale = v_locale
         for update;
      end if;

      if v_action = 'insert' and v_current_id is not null then
        raise exception using errcode = '40001', message = 'Translation backfill insert conflict.';
      end if;
      if v_action = 'update' and v_current_id is null then
        raise exception using errcode = '40001', message = 'Translation backfill update target disappeared.';
      end if;
      if v_action = 'update' and (
        v_expected is null
        or v_current_id::text is distinct from v_expected->>'id'
        or v_current_updated_at is distinct from (v_expected->>'updated_at')::timestamptz
        or v_current_translation_status is distinct from v_expected->>'translation_status'
        or v_current_provider is distinct from v_expected->>'provider'
        or v_current_source_hash is distinct from v_expected->>'source_hash'
        or v_current_field_hashes is distinct from v_expected->'field_hashes'
        or v_current_content is distinct from v_expected->'content'
        or v_current_manual_overrides is distinct from v_expected->'manual_overrides'
        or v_current_error_message is distinct from v_expected->>'error_message'
        or v_current_translated_at is distinct from (v_expected->>'translated_at')::timestamptz
      ) then
        raise exception using errcode = '40001', message = 'Translation backfill translation row conflict.';
      end if;

      if v_entity_type = 'menu' then
        if v_action = 'insert' then
          insert into public.menu_translations (
            restaurant_id, menu_id, locale, translation_status, provider,
            source_hash, field_hashes, content, manual_overrides,
            error_message, translated_at
          ) values (
            v_restaurant_id, v_menu_id, v_locale, v_patch->>'translation_status',
            v_patch->>'provider', v_patch->>'source_hash',
            v_patch->'field_hashes', v_patch->'content',
            v_patch->'manual_overrides', v_patch->>'error_message',
            (v_patch->>'translated_at')::timestamptz
          );
        else
          update public.menu_translations
             set translation_status = v_patch->>'translation_status',
                 provider = v_patch->>'provider',
                 source_hash = v_patch->>'source_hash',
                 field_hashes = v_patch->'field_hashes',
                 content = v_patch->'content',
                 manual_overrides = v_patch->'manual_overrides',
                 error_message = v_patch->>'error_message',
                 translated_at = (v_patch->>'translated_at')::timestamptz,
                 updated_at = now()
           where id = v_current_id;
        end if;
      elsif v_entity_type = 'category' then
        if v_action = 'insert' then
          insert into public.menu_category_translations (
            restaurant_id, menu_id, category_id, locale, translation_status, provider,
            source_hash, field_hashes, content, manual_overrides,
            error_message, translated_at
          ) values (
            v_restaurant_id, v_menu_id, v_entity_id, v_locale, v_patch->>'translation_status',
            v_patch->>'provider', v_patch->>'source_hash',
            v_patch->'field_hashes', v_patch->'content',
            v_patch->'manual_overrides', v_patch->>'error_message',
            (v_patch->>'translated_at')::timestamptz
          );
        else
          update public.menu_category_translations
             set translation_status = v_patch->>'translation_status',
                 provider = v_patch->>'provider',
                 source_hash = v_patch->>'source_hash',
                 field_hashes = v_patch->'field_hashes',
                 content = v_patch->'content',
                 manual_overrides = v_patch->'manual_overrides',
                 error_message = v_patch->>'error_message',
                 translated_at = (v_patch->>'translated_at')::timestamptz,
                 updated_at = now()
           where id = v_current_id;
        end if;
      else
        if v_action = 'insert' then
          insert into public.menu_dish_translations (
            restaurant_id, menu_id, dish_id, locale, translation_status, provider,
            source_hash, field_hashes, content, manual_overrides,
            error_message, translated_at
          ) values (
            v_restaurant_id, v_menu_id, v_entity_id, v_locale, v_patch->>'translation_status',
            v_patch->>'provider', v_patch->>'source_hash',
            v_patch->'field_hashes', v_patch->'content',
            v_patch->'manual_overrides', v_patch->>'error_message',
            (v_patch->>'translated_at')::timestamptz
          );
        else
          update public.menu_dish_translations
             set translation_status = v_patch->>'translation_status',
                 provider = v_patch->>'provider',
                 source_hash = v_patch->>'source_hash',
                 field_hashes = v_patch->'field_hashes',
                 content = v_patch->'content',
                 manual_overrides = v_patch->'manual_overrides',
                 error_message = v_patch->>'error_message',
                 translated_at = (v_patch->>'translated_at')::timestamptz,
                 updated_at = now()
           where id = v_current_id;
        end if;
      end if;
      v_applied_rows := v_applied_rows + 1;
    end loop;
  end loop;

  return query select 'applied'::text, v_applied_rows;
end;
$$;

revoke all on function public.owner_apply_menu_translation_backfill(jsonb) from public, anon, authenticated;
grant execute on function public.owner_apply_menu_translation_backfill(jsonb) to service_role;
