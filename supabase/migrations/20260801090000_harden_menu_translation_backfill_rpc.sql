-- Harden the historical translation backfill RPC without rewriting its
-- already-applied migration. The legacy implementation remains available as
-- a private implementation detail; this public wrapper validates the complete
-- CAS payload before delegating, so any error rolls back the whole batch.

begin;

alter function public.owner_apply_menu_translation_backfill(jsonb)
  rename to owner_apply_menu_translation_backfill_legacy;

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
  v_patch jsonb;
  v_expected jsonb;
  v_current jsonb;
  v_restaurant_id uuid;
  v_menu_id uuid;
  v_menus_locked boolean := false;
  v_action text;
  v_entity_type text;
  v_field text;
  v_required_expected text[] := array[
    'id', 'updated_at', 'translation_status', 'provider', 'source_hash',
    'field_hashes', 'content', 'manual_overrides', 'error_message',
    'translated_at'
  ];
begin
  if p_plans is null or jsonb_typeof(p_plans) <> 'array'
     or jsonb_array_length(p_plans) = 0 then
    raise exception using errcode = '22023',
      message = 'Translation backfill RPC requires a non-empty plan array.';
  end if;

  for v_plan in select value from jsonb_array_elements(p_plans) as item(value) loop
    if jsonb_typeof(v_plan) <> 'object'
       or v_plan->>'restaurant_id' is null
       or v_plan->>'menu_id' is null
       or v_plan->>'locale' is distinct from 'en-CA'
       or v_plan->>'expected_menu_updated_at' is null
       or jsonb_typeof(v_plan->'expected_menu_settings') is distinct from 'object'
       or jsonb_typeof(v_plan->'desired_menu_settings') is distinct from 'object'
       or jsonb_typeof(v_plan->'operations') is distinct from 'array' then
      raise exception using errcode = '22023',
        message = 'Translation backfill plan snapshot is incomplete or has an unsupported locale.';
    end if;

    for v_operation in select value from jsonb_array_elements(v_plan->'operations') as item(value) loop
      if jsonb_typeof(v_operation) is distinct from 'object' then
        raise exception using errcode = '22023', message = 'Translation backfill operation must be an object.';
      end if;
      v_action := v_operation->>'action';
      if v_action = 'noop' then
        continue;
      end if;
      v_patch := v_operation->'patch';
      v_entity_type := v_operation->>'entity_type';
      if not v_menus_locked then
        for v_restaurant_id, v_menu_id in
          select (value->>'restaurant_id')::uuid, (value->>'menu_id')::uuid
            from jsonb_array_elements(p_plans) as plans(value)
           order by 2, 1
        loop
          perform 1
            from public.menus m
           where m.id = v_menu_id
             and m.restaurant_id = v_restaurant_id
           for update;
          if not found then
            raise exception using errcode = 'P0002', message = 'Translation backfill menu was not found.';
          end if;
        end loop;
        v_menus_locked := true;
      end if;
      if v_action not in ('insert', 'update')
         or v_entity_type not in ('menu', 'category', 'dish')
         or v_operation->>'entity_id' is null
         or jsonb_typeof(v_patch) is distinct from 'object'
         or v_patch->>'restaurant_id' is distinct from v_plan->>'restaurant_id'
         or v_patch->>'menu_id' is distinct from v_plan->>'menu_id'
         or v_patch->>'locale' is distinct from 'en-CA'
         or (v_entity_type = 'menu' and v_patch->>'menu_id' is distinct from v_operation->>'entity_id')
         or (v_entity_type = 'category' and v_patch->>'category_id' is distinct from v_operation->>'entity_id')
         or (v_entity_type = 'dish' and v_patch->>'dish_id' is distinct from v_operation->>'entity_id')
         or jsonb_typeof(v_patch->'translation_status') is distinct from 'string'
         or v_patch->>'translation_status' not in ('source','missing','pending','in_progress','up_to_date','stale','error')
         or jsonb_typeof(v_patch->'source_hash') is distinct from 'string'
         or v_patch->>'source_hash' = ''
         or jsonb_typeof(v_patch->'field_hashes') is distinct from 'object'
         or jsonb_typeof(v_patch->'content') is distinct from 'object'
         or jsonb_typeof(v_patch->'manual_overrides') is distinct from 'object'
         or exists (select 1 from jsonb_each(v_patch->'field_hashes') as h(key, value)
                    where jsonb_typeof(h.value) is distinct from 'string' or h.value #>> '{}' = '')
         or exists (select 1 from jsonb_each(v_patch->'manual_overrides') as o(key, value)
                    where jsonb_typeof(o.value) is distinct from 'boolean')
         or not (v_patch ? 'provider')
         or not (v_patch ? 'error_message')
         or not (v_patch ? 'translated_at')
         or not (v_patch ? 'updated_at')
         or jsonb_typeof(v_patch->'provider') not in ('string','null')
         or jsonb_typeof(v_patch->'error_message') not in ('string','null')
         or jsonb_typeof(v_patch->'translated_at') not in ('string','null') then
        raise exception using errcode = '22023', message = 'Translation backfill operation payload is invalid.';
      end if;

      if v_action = 'insert' then
        if not (v_operation ? 'expected') or jsonb_typeof(v_operation->'expected') is distinct from 'null' then
          raise exception using errcode = '22023', message = 'Insert operations require expected: null.';
        end if;
      else
        if jsonb_typeof(v_operation->'expected') is distinct from 'object' then
          raise exception using errcode = '22023', message = 'Update operations require a complete expected snapshot.';
        end if;
        foreach v_field in array v_required_expected loop
          if not (v_operation->'expected' ? v_field) then
            raise exception using errcode = '22023', message = 'Update expected snapshot is incomplete.';
          end if;
        end loop;
        v_expected := v_operation->'expected';
        if nullif(v_expected->>'updated_at', '') is null then
          raise exception using errcode = '22023', message = 'Update expected snapshot requires a typed updated_at.';
        end if;
        perform (v_expected->>'updated_at')::timestamptz;
        if jsonb_typeof(v_expected->'translated_at') = 'string' then
          perform (v_expected->>'translated_at')::timestamptz;
        elsif jsonb_typeof(v_expected->'translated_at') is distinct from 'null' then
          raise exception using errcode = '22023', message = 'Update expected translated_at must be a timestamp or null.';
        end if;
        if v_expected->>'source_hash' = '' then
          raise exception using errcode = '22023', message = 'Update expected source_hash must be non-empty.';
        end if;
        if jsonb_typeof(v_expected->'field_hashes') is distinct from 'object'
           or jsonb_typeof(v_expected->'content') is distinct from 'object'
           or jsonb_typeof(v_expected->'manual_overrides') is distinct from 'object' then
          raise exception using errcode = '22023', message = 'Update expected snapshot contains invalid JSON fields.';
        end if;
        if exists (select 1 from jsonb_each(v_expected->'field_hashes') as h(key, value)
                   where jsonb_typeof(h.value) is distinct from 'string' or h.value #>> '{}' = '')
           or exists (select 1 from jsonb_each(v_expected->'manual_overrides') as o(key, value)
                      where jsonb_typeof(o.value) is distinct from 'boolean') then
          raise exception using errcode = '22023', message = 'Update expected snapshot contains invalid hashes or overrides.';
        end if;

        -- Lock and compare every nullable/CAS column here. The historical
        -- implementation predates provider/status/timestamp checks; keeping
        -- this comparison in the wrapper prevents those fields from being
        -- silently overwritten while preserving the old migration verbatim.
        if v_entity_type = 'menu' then
          select to_jsonb(t) into v_current from public.menu_translations t
           where t.menu_id = (v_operation->>'entity_id')::uuid
             and t.restaurant_id = (v_plan->>'restaurant_id')::uuid
             and t.locale = 'en-CA' for update;
        elsif v_entity_type = 'category' then
          select to_jsonb(t) into v_current from public.menu_category_translations t
           where t.category_id = (v_operation->>'entity_id')::uuid
             and t.restaurant_id = (v_plan->>'restaurant_id')::uuid
             and t.menu_id = (v_plan->>'menu_id')::uuid
             and t.locale = 'en-CA' for update;
        else
          select to_jsonb(t) into v_current from public.menu_dish_translations t
           where t.dish_id = (v_operation->>'entity_id')::uuid
             and t.restaurant_id = (v_plan->>'restaurant_id')::uuid
             and t.menu_id = (v_plan->>'menu_id')::uuid
             and t.locale = 'en-CA' for update;
        end if;
        if v_current is null then
          raise exception using errcode = '40001', message = 'Translation backfill update target disappeared.';
        end if;
        foreach v_field in array v_required_expected loop
          if v_field in ('updated_at', 'translated_at') then
            -- JSON serialization of timestamptz is canonicalized by PostgreSQL
            -- (for example, `2026-08-01T00:01:00+00:00`), while callers may
            -- send any equivalent timestamp spelling. Compare typed values so
            -- formatting differences do not create false CAS conflicts.
            if nullif(v_current->>v_field, '')::timestamptz is distinct from
               nullif(v_expected->>v_field, '')::timestamptz then
              raise exception using errcode = '40001', message = 'Translation backfill translation row conflict.';
            end if;
          elsif v_current->v_field is distinct from v_expected->v_field then
            raise exception using errcode = '40001', message = 'Translation backfill translation row conflict.';
          end if;
        end loop;
      end if;
    end loop;
  end loop;

  return query
    select legacy.result_status, legacy.applied_rows
      from public.owner_apply_menu_translation_backfill_legacy(p_plans) as legacy;
end;
$$;

revoke all on function public.owner_apply_menu_translation_backfill(jsonb) from public, anon, authenticated;
grant execute on function public.owner_apply_menu_translation_backfill(jsonb) to service_role;
revoke all on function public.owner_apply_menu_translation_backfill_legacy(jsonb) from public, anon, authenticated, service_role;

commit;
