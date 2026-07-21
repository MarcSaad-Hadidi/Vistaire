select qr_test.assert_true(
  not exists (
    (select id, restaurant_id, label, token_hash, token_preview, target_path,
      style_json, status, scan_count, last_scanned_at, created_at, updated_at, target_kind
     from public.qr_codes)
    except
    (select * from qr_test.historical_qr_snapshot)
  )
  and not exists (
    (select * from qr_test.historical_qr_snapshot)
    except
    (select id, restaurant_id, label, token_hash, token_preview, target_path,
      style_json, status, scan_count, last_scanned_at, created_at, updated_at, target_kind
     from public.qr_codes)
  ),
  'lifecycle migration must preserve every historical QR value'
);

select qr_test.assert_true(
  (select pg_catalog.count(*) from public.qr_codes) = 8
  and (select pg_catalog.count(*) from public.qr_codes where status = 'active') = 8
  and (select pg_catalog.count(*) from public.qr_codes where is_canonical) = 0
  and (select pg_catalog.count(*) from public.qr_codes where purpose_key = 'default') = 8
  and (select pg_catalog.count(*) from public.qr_codes where config_version = 1) = 8,
  'historical rows receive additive defaults only'
);

select qr_test.assert_true(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.qr_codes'::regclass)
  and (select relrowsecurity from pg_catalog.pg_class where oid = 'public.qr_code_lifecycle_events'::regclass),
  'QR tables must have RLS enabled'
);

select qr_test.assert_true(
  not pg_catalog.has_table_privilege('anon', 'public.qr_codes', 'SELECT')
  and not pg_catalog.has_table_privilege('authenticated', 'public.qr_codes', 'SELECT')
  and pg_catalog.has_table_privilege('service_role', 'public.qr_codes', 'SELECT,INSERT,UPDATE,DELETE')
  and pg_catalog.has_table_privilege('service_role', 'public.qr_code_lifecycle_events', 'SELECT')
  and not pg_catalog.has_table_privilege('service_role', 'public.qr_code_lifecycle_events', 'INSERT,UPDATE,DELETE'),
  'table ACLs must expose runtime data only to service_role and keep audit append-only'
);

select qr_test.assert_true(
  not pg_catalog.has_function_privilege('anon', 'public.qr_sha256(text)', 'EXECUTE')
  and not pg_catalog.has_function_privilege('authenticated', 'public.qr_sha256(text)', 'EXECUTE')
  and not pg_catalog.has_function_privilege('service_role', 'public.qr_sha256(text)', 'EXECUTE'),
  'rotation fingerprint helper must remain private to owner RPC execution'
);

select qr_test.assert_true(
  not exists (
    select 1
    from pg_catalog.pg_policy
    where polrelid in ('public.qr_codes'::regclass, 'public.qr_code_lifecycle_events'::regclass)
      and polpermissive
  ),
  'QR tables must have no permissive RLS policy'
);

do $$
declare
  v_signature text;
  v_function oid;
begin
  foreach v_signature in array array[
    'public.owner_get_or_create_canonical_qr(uuid,uuid,text,text,text,text,text,text,text,text,text,jsonb)',
    'public.owner_rotate_canonical_qr(uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,jsonb,boolean,text,uuid,integer)',
    'public.owner_set_canonical_qr_lifecycle(uuid,uuid,text,integer,uuid)',
    'public.owner_clear_canonical_qr(uuid,uuid,text,integer,uuid)',
    'public.resolve_qr_code_scan(text)',
    'public.resolve_qr_code_scan_metadata(text)'
  ] loop
    v_function := pg_catalog.to_regprocedure(v_signature);
    perform qr_test.assert_true(v_function is not null, v_signature || ' must exist');
    perform qr_test.assert_true(
      (select prosecdef and coalesce(pg_catalog.array_to_string(proconfig, ','), '') in ('search_path=""', 'search_path=')
       from pg_catalog.pg_proc where oid = v_function),
      v_signature || ' must be SECURITY DEFINER with empty search_path'
    );
    perform qr_test.assert_true(
      not pg_catalog.has_function_privilege('anon', v_function, 'EXECUTE')
      and not pg_catalog.has_function_privilege('authenticated', v_function, 'EXECUTE')
      and pg_catalog.has_function_privilege('service_role', v_function, 'EXECUTE'),
      v_signature || ' must be executable only by service_role'
    );
    perform qr_test.assert_true(
      not exists (
        select 1
        from pg_catalog.pg_proc as fn,
          lateral pg_catalog.aclexplode(coalesce(fn.proacl, pg_catalog.acldefault('f', fn.proowner))) as acl
        where fn.oid = v_function and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
      ),
      v_signature || ' must revoke PUBLIC execute'
    );
  end loop;
end;
$$;

select qr_test.assert_true(
  pg_catalog.to_regprocedure(
    'public.owner_rotate_canonical_qr(uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,jsonb,boolean)'
  ) is null
  and (
    select pg_catalog.count(*) = 1
    from pg_catalog.pg_proc as fn
    join pg_catalog.pg_namespace as namespace on namespace.oid = fn.pronamespace
    where namespace.nspname = 'public'
      and fn.proname = 'owner_rotate_canonical_qr'
  ),
  'only the explicit disposition/idempotency/version rotation signature may exist'
);

set role service_role;
do $$
declare
  v_before bigint;
  v_after bigint;
begin
  select pg_catalog.count(*) into v_before from public.qr_codes;
  begin
    execute $legacy$
      select * from public.owner_rotate_canonical_qr(
        '60000000-0000-4000-8000-000000000001'::uuid,
        '60000000-0000-4000-8000-000000000002'::uuid,
        '10000000-0000-4000-8000-000000000001'::uuid,
        'admin', 'legacy-forbidden', 'Legacy forbidden', '/admin',
        'legacy-forbidden-hash', 'legacy', 'cipher', 'nonce', 'v1', '{}'::jsonb,
        true
      )
    $legacy$;
  exception when undefined_function then
    select pg_catalog.count(*) into v_after from public.qr_codes;
    if v_after <> v_before then
      raise exception 'legacy rotation failure mutated QR rows';
    end if;
    return;
  end;
  raise exception 'legacy rotation unexpectedly remained callable';
end;
$$;
reset role;

select qr_test.assert_raises(
  $$insert into public.qr_codes (
      id, restaurant_id, label, token_hash, token_preview, target_path,
      style_json, status, target_kind, purpose_key
    ) values (
      '30000000-0000-4000-8000-000000000099',
      '10000000-0000-4000-8000-000000000001', 'bad purpose', 'bad-purpose-hash',
      '', '/admin', '{}'::jsonb, 'active', 'admin', 'Not Normalized'
    )$$,
  '23514',
  'purpose_key format must be constrained'
);

select qr_test.assert_raises(
  $$insert into public.qr_codes (
      id, restaurant_id, label, token_hash, token_preview, target_path,
      style_json, status, target_kind, purpose_key, config_version
    ) values (
      '30000000-0000-4000-8000-000000000098',
      '10000000-0000-4000-8000-000000000001', 'bad version', 'bad-version-hash',
      '', '/admin', '{}'::jsonb, 'active', 'admin', 'default', 0
    )$$,
  '23514',
  'config_version must be positive'
);
