\set ON_ERROR_STOP on

create or replace function qr_test.assert(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if p_condition is distinct from true then
    raise exception 'QR PostgreSQL assertion failed: %', p_message;
  end if;
end;
$$;

select qr_test.assert(
  current_setting('server_version_num')::integer between 170000 and 179999,
  'the database server must be PostgreSQL 17'
);

select qr_test.assert(
  (select count(*) from public.qr_codes where id::text like '10000000-%') = 4,
  'all four historical rows must remain present'
);

select qr_test.assert(
  not exists (
    select 1
    from public.qr_codes as qr
    join qr_test.historical_before as before using (id)
    where (
      to_jsonb(qr) - array[
        'purpose_key', 'is_canonical', 'token_ciphertext', 'token_nonce',
        'token_key_version', 'supersedes_qr_code_id', 'rotated_at',
        'revoked_at', 'config_version'
      ]
    ) is distinct from before.payload
  ),
  'the canonical migration must not rewrite historical QR fields'
);

select qr_test.assert(
  not exists (
    select 1 from public.qr_codes
    where id::text like '10000000-%'
      and (
        purpose_key <> 'default'
        or is_canonical
        or token_ciphertext is not null
        or token_nonce is not null
        or token_key_version is not null
        or supersedes_qr_code_id is not null
        or rotated_at is not null
        or revoked_at is not null
        or config_version <> 1
      )
  ),
  'new canonical columns must use non-destructive historical defaults'
);

select qr_test.assert(
  (select target_path from public.qr_codes where id = '10000000-0000-4000-8000-000000000003') = '/admin'
  and
  (select target_path from public.qr_codes where id = '10000000-0000-4000-8000-000000000004') = '/admin',
  'the real admin migration must canonicalize legacy admin destinations'
);

select qr_test.assert(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.qr_codes'::regclass),
  'RLS must be enabled on qr_codes'
);

select qr_test.assert(
  not has_table_privilege('anon', 'public.qr_codes', 'SELECT')
  and not has_table_privilege('authenticated', 'public.qr_codes', 'SELECT')
  and has_table_privilege('service_role', 'public.qr_codes', 'SELECT')
  and has_table_privilege('service_role', 'public.qr_codes', 'INSERT')
  and has_table_privilege('service_role', 'public.qr_codes', 'UPDATE')
  and has_table_privilege('service_role', 'public.qr_codes', 'DELETE'),
  'qr_codes table grants must be service-role-only'
);

select qr_test.assert(
  not has_function_privilege(
    'anon',
    'public.owner_get_or_create_canonical_qr(uuid,uuid,text,text,text,text,text,text,text,text,text,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.owner_rotate_canonical_qr(uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,jsonb,boolean,text,uuid,integer)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.resolve_qr_code_scan_metadata(text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.owner_get_or_create_canonical_qr(uuid,uuid,text,text,text,text,text,text,text,text,text,jsonb)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.owner_rotate_canonical_qr(uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,text,jsonb,boolean,text,uuid,integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.resolve_qr_code_scan_metadata(text)',
    'EXECUTE'
  ),
  'canonical and resolver RPC grants must be service-role-only'
);

do $$
begin
  begin
    insert into public.qr_codes (
      id, restaurant_id, label, target_kind, purpose_key, target_path,
      token_hash, token_preview, token_ciphertext, token_nonce,
      token_key_version, style_json, status, is_canonical
    ) values (
      '30000000-0000-4000-8000-000000000001',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Invalid purpose', 'admin', ' NOT-NORMALIZED ', '/admin',
      'invalid-purpose-hash', 'invalid', 'cipher', 'nonce', 'v1', '{}'::jsonb,
      'active', true
    );
    raise exception 'normalized-purpose constraint accepted invalid data';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.qr_codes (
      id, restaurant_id, label, target_kind, purpose_key, target_path,
      token_hash, token_preview, token_ciphertext, style_json, status, is_canonical
    ) values (
      '30000000-0000-4000-8000-000000000002',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Partial envelope', 'admin', 'partial-envelope', '/admin',
      'partial-envelope-hash', 'partial', 'cipher', '{}'::jsonb, 'active', true
    );
    raise exception 'all-or-none envelope constraint accepted invalid data';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.qr_codes (
      id, restaurant_id, label, target_kind, purpose_key, target_path,
      token_hash, token_preview, style_json, status, is_canonical
    ) values (
      '30000000-0000-4000-8000-000000000003',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Archived canonical', 'admin', 'archived-canonical', '/admin',
      'archived-canonical-hash', 'archived', '{}'::jsonb, 'archived', true
    );
    raise exception 'canonical completeness constraint accepted archived data';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.qr_codes (
      id, restaurant_id, label, target_kind, purpose_key, target_path,
      token_hash, token_preview, style_json, status, is_canonical,
      supersedes_qr_code_id
    ) values (
      '30000000-0000-4000-8000-000000000004',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Self lineage', 'admin', 'self-lineage', '/admin',
      'self-lineage-hash', 'self', '{}'::jsonb, 'active', false,
      '30000000-0000-4000-8000-000000000004'
    );
    raise exception 'self-supersedes constraint accepted invalid data';
  exception when check_violation then
    null;
  end;
end;
$$;

do $$
declare
  v_first record;
  v_second record;
  v_previous_before jsonb;
  v_previous_after jsonb;
  v_rotated record;
  v_scan_before integer;
begin
  select * into v_first
  from public.owner_get_or_create_canonical_qr(
    '40000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'QR rotation', 'admin', 'rotation', '/admin',
    'rotation-old-hash', 'old...hash', 'cipher-old', 'nonce-old', 'v1',
    '{"foregroundColor":"#515151"}'::jsonb
  );
  select * into v_second
  from public.owner_get_or_create_canonical_qr(
    '40000000-0000-4000-8000-000000000002',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'QR ignored', 'admin', 'rotation', '/admin',
    'rotation-loser-hash', 'lose...hash', 'cipher-loser', 'nonce-loser', 'v1',
    '{"foregroundColor":"#999999"}'::jsonb
  );

  perform qr_test.assert(v_first.created, 'the first canonical call must create');
  perform qr_test.assert(not v_second.created, 'the repeated canonical call must reuse');
  perform qr_test.assert(v_second.id = v_first.id, 'repeated canonical calls must return one id');
  perform qr_test.assert(
    not exists (select 1 from public.qr_codes where token_hash = 'rotation-loser-hash'),
    'a sequential losing candidate must not persist'
  );

  select to_jsonb(qr), qr.scan_count
  into v_previous_before, v_scan_before
  from public.qr_codes as qr
  where qr.id = v_first.id;

  begin
    perform public.owner_rotate_canonical_qr(
      v_first.id,
      '40000000-0000-4000-8000-000000000003',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'admin', 'rotation', 'Ignored', '/admin',
      'rotation-new-hash', 'new...hash', 'cipher-new', 'nonce-new', 'v1',
      '{"foregroundColor":"#000000"}'::jsonb,
      false, 'keep-active', '42000000-0000-4000-8000-000000000001', 1
    );
    raise exception 'rotation without confirmation unexpectedly succeeded';
  exception when invalid_parameter_value then
    null;
  end;

  perform qr_test.assert(
    (select count(*) from public.qr_codes where purpose_key = 'rotation') = 1,
    'rejected rotation must not mutate the slot'
  );

  select * into v_rotated
  from public.owner_rotate_canonical_qr(
    v_first.id,
    '40000000-0000-4000-8000-000000000003',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'admin', 'rotation', 'Ignored', '/admin',
    'rotation-new-hash', 'new...hash', 'cipher-new', 'nonce-new', 'v1',
    '{"foregroundColor":"#000000"}'::jsonb,
    true, 'keep-active', '42000000-0000-4000-8000-000000000002', 1
  )
  where result_status = 'canonical';

  select to_jsonb(qr)
  into v_previous_after
  from public.qr_codes as qr
  where qr.id = v_first.id;

  perform qr_test.assert(v_rotated.id = '40000000-0000-4000-8000-000000000003', 'rotation must install the requested id');
  perform qr_test.assert(
    (v_previous_after - array['is_canonical', 'rotated_at', 'config_version'])
      = (v_previous_before - array['is_canonical', 'rotated_at', 'config_version']),
    'rotation must preserve every historical field except lifecycle markers'
  );
  perform qr_test.assert(
    (v_previous_after ->> 'status') = 'active'
      and (v_previous_after ->> 'is_canonical')::boolean = false
      and v_previous_after ->> 'rotated_at' is not null,
    'the previous QR must remain active, historical, and timestamped'
  );
  perform qr_test.assert(
    (select supersedes_qr_code_id from public.qr_codes where id = v_rotated.id) = v_first.id,
    'the new canonical must record lineage'
  );

  perform public.resolve_qr_code_scan_metadata('rotation-old-hash');
  perform qr_test.assert(
    (select scan_count from public.qr_codes where id = v_first.id) = v_scan_before + 1,
    'the rotated historical QR must remain resolvable'
  );
  perform public.resolve_qr_code_scan_metadata('legacy-admin-archived-hash');
  perform qr_test.assert(
    (select scan_count from public.qr_codes where token_hash = 'legacy-admin-archived-hash') = 23,
    'archived QR scans must not increment'
  );
end;
$$;
