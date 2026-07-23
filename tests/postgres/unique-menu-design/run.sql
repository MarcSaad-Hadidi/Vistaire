\set ON_ERROR_STOP on

select qr_test.assert_true(
  to_regprocedure('public.create_owner_restaurant_with_menu(jsonb)') is not null,
  'create_owner_restaurant_with_menu must exist'
);

select qr_test.assert_true(
  has_function_privilege('service_role', 'public.create_owner_restaurant_with_menu(jsonb)', 'EXECUTE'),
  'service_role can execute create_owner_restaurant_with_menu'
);

select qr_test.assert_true(
  not has_function_privilege('anon', 'public.create_owner_restaurant_with_menu(jsonb)', 'EXECUTE'),
  'anon cannot execute create_owner_restaurant_with_menu'
);

select qr_test.assert_true(
  not has_function_privilege('authenticated', 'public.mutate_owner_unique_menu_design(uuid, uuid, integer, text, text)', 'EXECUTE'),
  'authenticated cannot execute mutate_owner_unique_menu_design'
);

do $$
declare
  v_design_a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_design_b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_payload_a jsonb;
  v_payload_b jsonb;
  v_result_a jsonb;
  v_result_b jsonb;
  v_restaurant_a uuid;
  v_restaurant_b uuid;
  v_draft_a jsonb;
  v_published_a jsonb;
  v_draft_b jsonb;
  v_published_b jsonb;
  v_before_b jsonb;
  v_after_b jsonb;
  v_lifecycle jsonb;
begin
  v_payload_a := jsonb_build_object(
    'restaurant', jsonb_build_object(
      'name', 'Unique A',
      'slug', 'unique-a-pg',
      'location', 'Montreal',
      'city', 'Montreal',
      'cuisine_type', 'Cuisine de saison',
      'status', 'setup_needed',
      'contact_name', 'A',
      'contact_email', 'a@example.com'
    ),
    'menu', jsonb_build_object(
      'name', 'Menu principal',
      'slug', 'principal',
      'is_primary', true,
      'settings_json', jsonb_build_object('publicMenuStyle', 'unique')
    ),
    'categories', jsonb_build_array(
      jsonb_build_object('name', 'Entrees', 'slug', 'entrees', 'display_order', 1)
    ),
    'dishes', jsonb_build_array(
      jsonb_build_object(
        'name', 'Soupe',
        'slug', 'soupe',
        'category_slug', 'entrees',
        'price_cents', 1200,
        'currency', 'CAD',
        'is_available', true
      )
    ),
    'ui_config', jsonb_build_object(
      'theme', 'fresh-homemade',
      'status', 'draft',
      'config_json', jsonb_build_object(
        'publicMenuStyle', 'unique',
        'uniqueDesign', jsonb_build_object(
          'mode', 'unique',
          'designId', v_design_a::text,
          'status', 'pending',
          'rendererKey', null,
          'rendererVersion', null,
          'version', 1,
          'createdAt', '2026-07-23T12:00:00.000Z',
          'updatedAt', '2026-07-23T12:00:00.000Z'
        ),
        'palette', jsonb_build_object('accent', '#e8cf9b')
      )
    )
  );

  v_payload_b := jsonb_set(
    jsonb_set(
      jsonb_set(v_payload_a, '{restaurant,name}', '"Unique B"'::jsonb, true),
      '{restaurant,slug}',
      '"unique-b-pg"'::jsonb,
      true
    ),
    '{ui_config,config_json,uniqueDesign,designId}',
    to_jsonb(v_design_b::text),
    true
  );

  v_result_a := public.create_owner_restaurant_with_menu(v_payload_a);
  v_result_b := public.create_owner_restaurant_with_menu(v_payload_b);

  perform qr_test.assert_true(v_result_a ->> 'ok' = 'true', 'create A ok');
  perform qr_test.assert_true(v_result_b ->> 'ok' = 'true', 'create B ok');
  perform qr_test.assert_true(v_result_a ->> 'uniqueDesignId' = v_design_a::text, 'A designId returned');
  perform qr_test.assert_true(v_result_b ->> 'uniqueDesignId' = v_design_b::text, 'B designId returned');
  perform qr_test.assert_true(v_result_a ->> 'uniqueDesignStatus' = 'pending', 'A pending');
  perform qr_test.assert_true((v_result_a ->> 'draftConfigPersisted')::boolean, 'A draft persisted');
  perform qr_test.assert_true((v_result_a ->> 'publishedFallbackPersisted')::boolean, 'A published persisted');
  perform qr_test.assert_true(v_result_a ->> 'uniqueDesignId' <> v_result_b ->> 'uniqueDesignId', 'A != B');

  v_restaurant_a := (v_result_a -> 'restaurant' ->> 'id')::uuid;
  v_restaurant_b := (v_result_b -> 'restaurant' ->> 'id')::uuid;

  select config_json into v_draft_a from public.menu_ui_configs
  where restaurant_id = v_restaurant_a and status = 'draft';
  select config_json into v_published_a from public.menu_ui_configs
  where restaurant_id = v_restaurant_a and status = 'published';
  select config_json into v_draft_b from public.menu_ui_configs
  where restaurant_id = v_restaurant_b and status = 'draft';
  select config_json into v_published_b from public.menu_ui_configs
  where restaurant_id = v_restaurant_b and status = 'published';

  perform qr_test.assert_true(v_draft_a is not null and v_published_a is not null, 'A has draft+published');
  perform qr_test.assert_true(
    v_draft_a #>> '{uniqueDesign,designId}' = v_published_a #>> '{uniqueDesign,designId}',
    'A draft/published share designId'
  );
  perform qr_test.assert_true(
    v_draft_a #>> '{uniqueDesign,designId}' = v_design_a::text,
    'A designId matches'
  );
  perform qr_test.assert_true(
    v_draft_b #>> '{uniqueDesign,designId}' = v_design_b::text,
    'B designId matches'
  );

  v_before_b := jsonb_build_object(
    'draft', v_draft_b,
    'published', v_published_b,
    'updated_at_draft', (select updated_at from public.menu_ui_configs where restaurant_id = v_restaurant_b and status = 'draft'),
    'updated_at_published', (select updated_at from public.menu_ui_configs where restaurant_id = v_restaurant_b and status = 'published')
  );

  update public.menu_ui_configs
  set config_json = jsonb_set(config_json, '{palette,accent}', '"#111111"'::jsonb, true)
  where restaurant_id = v_restaurant_a and status in ('draft', 'published');

  select jsonb_build_object(
    'draft', config_json,
    'updated_at_draft', updated_at
  ) into v_after_b
  from public.menu_ui_configs
  where restaurant_id = v_restaurant_b and status = 'draft';

  perform qr_test.assert_true(
    (select config_json from public.menu_ui_configs where restaurant_id = v_restaurant_b and status = 'draft')
      = (v_before_b -> 'draft'),
    'B draft unchanged after A palette edit'
  );
  perform qr_test.assert_true(
    (select config_json from public.menu_ui_configs where restaurant_id = v_restaurant_b and status = 'published')
      = (v_before_b -> 'published'),
    'B published unchanged after A palette edit'
  );

  -- Lifecycle pending → draft
  v_lifecycle := public.mutate_owner_unique_menu_design(
    v_restaurant_a, v_design_a, 1, 'start', null
  );
  perform qr_test.assert_true(v_lifecycle ->> 'ok' = 'true', 'start ok');
  perform qr_test.assert_true(v_lifecycle #>> '{uniqueDesign,status}' = 'draft', 'status draft');
  perform qr_test.assert_true((v_lifecycle #>> '{uniqueDesign,version}')::int = 2, 'version 2');

  -- Stale version must 409
  v_lifecycle := public.mutate_owner_unique_menu_design(
    v_restaurant_a, v_design_a, 1, 'mark-ready', 'test-renderer'
  );
  perform qr_test.assert_true(v_lifecycle ->> 'ok' = 'false', 'stale version rejected');
  perform qr_test.assert_true((v_lifecycle ->> 'status')::int = 409, '409 concurrency');

  v_lifecycle := public.mutate_owner_unique_menu_design(
    v_restaurant_a, v_design_a, 2, 'mark-ready', 'test-renderer-a'
  );
  perform qr_test.assert_true(v_lifecycle ->> 'ok' = 'true', 'mark-ready ok');
  perform qr_test.assert_true(v_lifecycle #>> '{uniqueDesign,status}' = 'ready', 'status ready');

  v_lifecycle := public.mutate_owner_unique_menu_design(
    v_restaurant_a, v_design_a, 3, 'publish', null
  );
  perform qr_test.assert_true(v_lifecycle ->> 'ok' = 'true', 'publish ok');
  perform qr_test.assert_true(v_lifecycle #>> '{uniqueDesign,status}' = 'published', 'status published');

  v_lifecycle := public.mutate_owner_unique_menu_design(
    v_restaurant_a, v_design_a, 4, 'archive', null
  );
  perform qr_test.assert_true(v_lifecycle ->> 'ok' = 'true', 'archive ok');
  perform qr_test.assert_true(v_lifecycle #>> '{uniqueDesign,status}' = 'archived', 'status archived');

  -- Forced rollback via PL/pgSQL subtransaction: no net change to restaurant B.
  select config_json into v_before_b from public.menu_ui_configs
  where restaurant_id = v_restaurant_b and status = 'draft';
  begin
    perform public.mutate_owner_public_menu_settings_atomic(
      v_restaurant_b,
      jsonb_build_object('publicMenuStyle', 'trouvable', 'probe', true),
      null
    );
    raise exception 'forced rollback after unique settings mutation';
  exception
    when others then
      null; -- nested block already rolled back
  end;
  select config_json into v_after_b from public.menu_ui_configs
  where restaurant_id = v_restaurant_b and status = 'draft';
  perform qr_test.assert_true(v_before_b = v_after_b, 'forced rollback leaves B draft unchanged');
end;
$$;

select 'Unique menu design PostgreSQL 17 suite passed' as result;
