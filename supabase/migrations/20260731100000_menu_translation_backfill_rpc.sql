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

  -- Lock all menus in a deterministic order before changing any row.
  for v_plan in
    select value
      from jsonb_array_elements(p_plans) as item(value)
     order by value->>'menu_id'
  loop
    if jsonb_typeof(v_plan) <> 'object'
       or v_plan->>'restaurant_id' is null
       or v_plan->>'menu_id' is null
       or v_plan->>'locale' is null then
      raise exception using
        errcode = '22023',
        message = 'Translation backfill plan identity is incomplete.';
    end if;

    v_restaurant_id := (v_plan->>'restaurant_id')::uuid;
    v_menu_id := (v_plan->>'menu_id')::uuid;
    v_locale := v_plan->>'locale';

    if v_plan->>'expected_menu_updated_at' is null then
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
       or v_menu.settings_json is distinct from coalesce(v_plan->'expected_menu_settings', '{}'::jsonb) then
      raise exception using
        errcode = '40001',
        message = 'Translation backfill menu snapshot conflict.';
    end if;

    if v_menu.settings_json is distinct from coalesce(v_plan->'desired_menu_settings', '{}'::jsonb) then
      update public.menus
         set settings_json = coalesce(v_plan->'desired_menu_settings', '{}'::jsonb),
             updated_at = now()
       where id = v_menu_id
         and restaurant_id = v_restaurant_id;
    end if;

    for v_operation in
      select value
        from jsonb_array_elements(coalesce(v_plan->'operations', '[]'::jsonb)) as item(value)
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

      if v_entity_type = 'menu' then
        if v_entity_id <> v_menu_id then
          raise exception using errcode = '22023', message = 'Menu translation operation targets another menu.';
        end if;
        select translation.id, translation.updated_at, translation.source_hash,
               translation.field_hashes, translation.content, translation.manual_overrides
          into v_current_id, v_current_updated_at, v_current_source_hash,
               v_current_field_hashes, v_current_content, v_current_manual_overrides
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
        select translation.id, translation.updated_at, translation.source_hash,
               translation.field_hashes, translation.content, translation.manual_overrides
          into v_current_id, v_current_updated_at, v_current_source_hash,
               v_current_field_hashes, v_current_content, v_current_manual_overrides
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
        select translation.id, translation.updated_at, translation.source_hash,
               translation.field_hashes, translation.content, translation.manual_overrides
          into v_current_id, v_current_updated_at, v_current_source_hash,
               v_current_field_hashes, v_current_content, v_current_manual_overrides
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
        or v_current_updated_at is distinct from nullif(v_expected->>'updated_at', '')::timestamptz
        or v_current_source_hash is distinct from v_expected->>'source_hash'
        or v_current_field_hashes is distinct from coalesce(v_expected->'field_hashes', '{}'::jsonb)
        or v_current_content is distinct from coalesce(v_expected->'content', '{}'::jsonb)
        or v_current_manual_overrides is distinct from coalesce(v_expected->'manual_overrides', '{}'::jsonb)
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
            v_patch->>'provider', coalesce(v_patch->>'source_hash', ''),
            coalesce(v_patch->'field_hashes', '{}'::jsonb), coalesce(v_patch->'content', '{}'::jsonb),
            coalesce(v_patch->'manual_overrides', '{}'::jsonb), v_patch->>'error_message',
            nullif(v_patch->>'translated_at', '')::timestamptz
          );
        else
          update public.menu_translations
             set translation_status = v_patch->>'translation_status',
                 provider = v_patch->>'provider',
                 source_hash = coalesce(v_patch->>'source_hash', ''),
                 field_hashes = coalesce(v_patch->'field_hashes', '{}'::jsonb),
                 content = coalesce(v_patch->'content', '{}'::jsonb),
                 manual_overrides = coalesce(v_patch->'manual_overrides', '{}'::jsonb),
                 error_message = v_patch->>'error_message',
                 translated_at = nullif(v_patch->>'translated_at', '')::timestamptz,
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
            v_patch->>'provider', coalesce(v_patch->>'source_hash', ''),
            coalesce(v_patch->'field_hashes', '{}'::jsonb), coalesce(v_patch->'content', '{}'::jsonb),
            coalesce(v_patch->'manual_overrides', '{}'::jsonb), v_patch->>'error_message',
            nullif(v_patch->>'translated_at', '')::timestamptz
          );
        else
          update public.menu_category_translations
             set translation_status = v_patch->>'translation_status',
                 provider = v_patch->>'provider',
                 source_hash = coalesce(v_patch->>'source_hash', ''),
                 field_hashes = coalesce(v_patch->'field_hashes', '{}'::jsonb),
                 content = coalesce(v_patch->'content', '{}'::jsonb),
                 manual_overrides = coalesce(v_patch->'manual_overrides', '{}'::jsonb),
                 error_message = v_patch->>'error_message',
                 translated_at = nullif(v_patch->>'translated_at', '')::timestamptz,
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
            v_patch->>'provider', coalesce(v_patch->>'source_hash', ''),
            coalesce(v_patch->'field_hashes', '{}'::jsonb), coalesce(v_patch->'content', '{}'::jsonb),
            coalesce(v_patch->'manual_overrides', '{}'::jsonb), v_patch->>'error_message',
            nullif(v_patch->>'translated_at', '')::timestamptz
          );
        else
          update public.menu_dish_translations
             set translation_status = v_patch->>'translation_status',
                 provider = v_patch->>'provider',
                 source_hash = coalesce(v_patch->>'source_hash', ''),
                 field_hashes = coalesce(v_patch->'field_hashes', '{}'::jsonb),
                 content = coalesce(v_patch->'content', '{}'::jsonb),
                 manual_overrides = coalesce(v_patch->'manual_overrides', '{}'::jsonb),
                 error_message = v_patch->>'error_message',
                 translated_at = nullif(v_patch->>'translated_at', '')::timestamptz,
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
