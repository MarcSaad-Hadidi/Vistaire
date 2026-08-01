\set ON_ERROR_STOP on
\ir qr-lifecycle/bootstrap.sql
\ir ../../supabase/migrations/0007_restaurants.sql
\ir ../../supabase/migrations/0009_restaurant_google_reviews.sql
\ir ../../supabase/migrations/0013_create_owner_restaurant_with_menu.sql
\ir ../../supabase/migrations/20260701031742_menu_settings_and_rpc.sql
\ir ../../supabase/migrations/20260702090000_menu_translations.sql
\ir ../../supabase/migrations/20260731100000_menu_translation_backfill_rpc.sql
\ir ../../supabase/migrations/20260801090000_harden_menu_translation_backfill_rpc.sql

insert into public.restaurants (id, name, slug, status)
values ('11111111-1111-4111-8111-111111111111', 'Backfill Test', 'backfill-test', 'active')
on conflict (id) do nothing;
insert into public.menus (id, restaurant_id, name, slug, status, settings_json, updated_at)
values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Menu principal', 'principal', 'published', '{}'::jsonb, '2026-08-01 00:00:00+00')
on conflict (id) do nothing;
insert into public.menu_categories (id, restaurant_id, menu_id, name, slug)
values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Entrées', 'entrees')
on conflict (id) do nothing;
insert into public.menu_dishes (id, restaurant_id, menu_id, category_id, name, slug, short_description, metadata)
values ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', 'Plat français', 'plat-francais', 'Description française', '{"ingredients":["Ingrédient"]}'::jsonb)
on conflict (id) do nothing;

do $$
declare
  plan jsonb;
  row_id uuid;
  row_updated_at timestamptz;
  before_content jsonb;
  expected jsonb;
  update_plan jsonb;
  mutated jsonb;
  cas_field text;
begin
  plan := jsonb_build_array(jsonb_build_object(
    'restaurant_id', '11111111-1111-4111-8111-111111111111', 'menu_id', '22222222-2222-4222-8222-222222222222',
    'locale', 'en-CA', 'expected_menu_updated_at', '2026-08-01 00:00:00+00',
    'expected_menu_settings', '{}'::jsonb, 'desired_menu_settings', '{}'::jsonb,
    'operations', jsonb_build_array(jsonb_build_object(
      'action', 'insert', 'entity_type', 'dish', 'entity_id', '44444444-4444-4444-8444-444444444444', 'expected', 'null'::jsonb,
      'patch', jsonb_build_object(
        'restaurant_id', '11111111-1111-4111-8111-111111111111', 'menu_id', '22222222-2222-4222-8222-222222222222',
        'dish_id', '44444444-4444-4444-8444-444444444444', 'locale', 'en-CA', 'translation_status', 'up_to_date',
        'provider', 'human', 'source_hash', 'source-hash', 'field_hashes', '{"description":"description-hash"}'::jsonb,
        'content', '{"description":"English description"}'::jsonb, 'manual_overrides', '{}'::jsonb,
        'updated_at', '2026-08-01 00:01:00+00',
        'error_message', null, 'translated_at', '2026-08-01 00:01:00+00'
      )
    ))
  ));
  perform * from public.owner_apply_menu_translation_backfill(plan);
  select id, updated_at, content into row_id, row_updated_at, before_content
    from public.menu_dish_translations where dish_id = '44444444-4444-4444-8444-444444444444' and locale = 'en-CA';
  if before_content->>'description' <> 'English description' then raise exception 'valid insert did not persist'; end if;

  expected := jsonb_build_object(
    'id', row_id, 'updated_at', row_updated_at, 'translation_status', 'up_to_date',
    'provider', 'human', 'source_hash', 'source-hash', 'field_hashes', '{"description":"description-hash"}'::jsonb,
    'content', before_content, 'manual_overrides', '{}'::jsonb, 'error_message', null,
    'translated_at', '2026-08-01 00:01:00+00'
  );
  update_plan := jsonb_set(plan, '{0,operations,0,action}', '"update"'::jsonb);
  update_plan := jsonb_set(update_plan, '{0,operations,0,expected}', expected);
  update_plan := jsonb_set(update_plan, '{0,operations,0,patch,content}', '{"description":"Updated English description"}'::jsonb);
  perform * from public.owner_apply_menu_translation_backfill(update_plan);
  select updated_at, content into row_updated_at, before_content
    from public.menu_dish_translations where id = row_id;
  if before_content->>'description' <> 'Updated English description' then raise exception 'valid update did not persist'; end if;

  -- Every optimistic-concurrency field is compared, including nullable ones.
  expected := jsonb_build_object(
    'id', row_id, 'updated_at', row_updated_at, 'translation_status', 'up_to_date', 'provider', 'human',
    'source_hash', 'source-hash', 'field_hashes', '{"description":"description-hash"}'::jsonb,
    'content', before_content, 'manual_overrides', '{}'::jsonb, 'error_message', null,
    'translated_at', '2026-08-01 00:01:00+00'
  );
  foreach cas_field in array array['updated_at','translation_status','provider','source_hash','field_hashes','content','manual_overrides','error_message','translated_at'] loop
    mutated := jsonb_set(
      update_plan,
      '{0,operations,0,expected}',
      jsonb_set(
        expected,
        array[cas_field],
        case
          when cas_field in ('updated_at', 'translated_at')
            then to_jsonb('2026-08-01 00:02:00+00'::timestamptz)
          when cas_field = 'field_hashes'
            then '{"description":"conflict-hash"}'::jsonb
          when cas_field = 'content'
            then '{"description":"Conflict content"}'::jsonb
          when cas_field = 'manual_overrides'
            then '{"description":true}'::jsonb
          else '"conflict"'::jsonb
        end
      )
    );
    begin
      perform * from public.owner_apply_menu_translation_backfill(mutated);
      raise exception 'expected CAS conflict for %', cas_field;
    exception when sqlstate '40001' then null;
    end;
  end loop;

  -- expected is mandatory and must be JSON null for inserts, and an object for updates.
  begin
    perform * from public.owner_apply_menu_translation_backfill(jsonb_set(plan, '{0,operations,0,expected}', '"missing"'::jsonb));
    raise exception 'expected insert snapshot rejection';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform * from public.owner_apply_menu_translation_backfill(jsonb_set(update_plan, '{0,operations,0,expected}', 'null'::jsonb));
    raise exception 'expected update snapshot rejection';
  exception when sqlstate '22023' then null;
  end;

  -- Idempotent noop is accepted, while locale and snapshot violations fail
  -- before the historical implementation is reached.
  perform * from public.owner_apply_menu_translation_backfill(
    jsonb_set(plan, '{0,operations}', '[{"action":"noop"}]'::jsonb)
  );
  begin
    perform * from public.owner_apply_menu_translation_backfill(jsonb_set(plan, '{0,locale}', '"fr-CA"'::jsonb));
    raise exception 'expected locale rejection';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform * from public.owner_apply_menu_translation_backfill(jsonb_set(plan, '{0,expected_menu_settings}', 'null'::jsonb));
    raise exception 'expected incomplete snapshot rejection';
  exception when sqlstate '22023' then null;
  end;

  begin
    perform * from public.owner_apply_menu_translation_backfill(
      jsonb_build_array(jsonb_build_object(
        'restaurant_id','11111111-1111-4111-8111-111111111111','menu_id','22222222-2222-4222-8222-222222222222','locale','en-CA',
        'expected_menu_updated_at','2026-08-01 00:00:00+00','expected_menu_settings','{}'::jsonb,'desired_menu_settings','{}'::jsonb,
        'operations',jsonb_build_array(jsonb_build_object(
          'action','update','entity_type','dish','entity_id','44444444-4444-4444-8444-444444444444',
          'expected',jsonb_build_object('id',row_id,'updated_at',row_updated_at,'translation_status','up_to_date','provider','human','source_hash','wrong','field_hashes','{}'::jsonb,'content',before_content,'manual_overrides','{}'::jsonb,'error_message',null,'translated_at','2026-08-01 00:01:00+00'),
          'patch',jsonb_build_object('restaurant_id','11111111-1111-4111-8111-111111111111','menu_id','22222222-2222-4222-8222-222222222222','dish_id','44444444-4444-4444-8444-444444444444','locale','en-CA','translation_status','stale','provider','human','source_hash','wrong','field_hashes','{}'::jsonb,'content',before_content,'manual_overrides','{}'::jsonb,'error_message',null,'translated_at','2026-08-01 00:01:00+00','updated_at','2026-08-01 00:01:00+00')
        ))
      ))
    );
    raise exception 'expected CAS conflict';
  exception when sqlstate '40001' then null;
  end;
  if (select content from public.menu_dish_translations where id = row_id) <> before_content then raise exception 'CAS failure was not atomic'; end if;
end;
$$;

select qr_test.assert_true((select count(*) = 1 from public.menu_dish_translations where dish_id = '44444444-4444-4444-8444-444444444444' and locale = 'en-CA'), 'expected one inserted translation row');
select qr_test.assert_true((select count(*) = 0 from public.menu_dish_translations where dish_id = '44444444-4444-4444-8444-444444444444' and content ? 'name'), 'dish name must not be generated into translation content');
select 'translation backfill PostgreSQL 17 checks passed.';
