set role service_role;

select * from public.owner_get_or_create_canonical_qr(
  '60000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Public menu permanence',
  'menu',
  'public-permanence',
  '/menu/fixture-a',
  'public-menu-a-hash',
  'menu-a',
  'cipher-public-a',
  'nonce-public-a',
  'v1',
  '{}'::jsonb
);

reset role;

select qr_test.assert_true(
  (select status = 'active' and is_canonical and config_version = 1
   from public.qr_codes
   where id = '60000000-0000-4000-8000-000000000001'),
  'public menu QR starts active and canonical'
);

select qr_test.assert_raises(
  $$select * from public.owner_rotate_canonical_qr(
    '60000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'menu', 'public-permanence', 'Public menu permanence', '/menu/fixture-a',
    'public-menu-a-pause-hash', 'menu-a-pause', 'cipher-public-a-pause',
    'nonce-public-a-pause', 'v1', '{}'::jsonb, true, 'pause',
    '61000000-0000-4000-8000-000000000001', 1)$$,
  'P0001',
  'public menu rotation pause must be rejected'
);

do $$
begin
  begin
    perform public.owner_rotate_canonical_qr(
      '60000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000001',
      'menu', 'public-permanence', 'Public menu permanence', '/menu/fixture-a',
      'public-menu-a-revoke-hash', 'menu-a-revoke', 'cipher-public-a-revoke',
      'nonce-public-a-revoke', 'v1', '{}'::jsonb, true, 'revoke',
      '61000000-0000-4000-8000-000000000002', 1
    );
  exception when others then
    if sqlstate = 'P0001' and sqlerrm = 'public_qr_permanent' then
      return;
    end if;
    raise;
  end;
  raise exception 'public menu rotation revoke unexpectedly succeeded';
end;
$$;

select qr_test.assert_true(
  (select count(*) = 1
   from public.qr_codes
   where restaurant_id = '10000000-0000-4000-8000-000000000001'
     and target_kind = 'menu'
     and purpose_key = 'public-permanence')
  and (select status = 'active' and is_canonical and config_version = 1
       from public.qr_codes
       where id = '60000000-0000-4000-8000-000000000001')
  and (select count(*) = 0
       from public.qr_code_lifecycle_events
       where operation_id in (
         '61000000-0000-4000-8000-000000000001',
         '61000000-0000-4000-8000-000000000002'
       )),
  'rejected public rotations must not create rows, change status/version, or write events'
);

set role service_role;
select * from public.owner_rotate_canonical_qr(
  '60000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000001',
  'menu', 'public-permanence', 'Public menu permanence', '/menu/fixture-a',
  'public-menu-b-hash', 'menu-b', 'cipher-public-b', 'nonce-public-b', 'v1',
  '{}'::jsonb, true, 'keep-active',
  '61000000-0000-4000-8000-000000000004', 1
);
reset role;

select qr_test.assert_true(
  (select status = 'active' and not is_canonical and config_version = 2
   from public.qr_codes
   where id = '60000000-0000-4000-8000-000000000001')
  and (select status = 'active' and is_canonical
       and supersedes_qr_code_id = '60000000-0000-4000-8000-000000000001'
       and config_version = 2
       from public.qr_codes
       where id = '60000000-0000-4000-8000-000000000004')
  and public.resolve_qr_code_scan('public-menu-a-hash') = '/menu/fixture-a'
  and public.resolve_qr_code_scan('public-menu-b-hash') = '/menu/fixture-a',
  'public keep-active rotation preserves both resolvable QR rows'
);

set role service_role;
select * from public.owner_get_or_create_canonical_qr(
  '60000000-0000-4000-8000-000000000010',
  '10000000-0000-4000-8000-000000000001',
  'Public menu lifecycle',
  'menu',
  'public-lifecycle',
  '/menu/fixture-a',
  'public-menu-lifecycle-hash',
  'menu-lifecycle',
  'cipher-public-lifecycle',
  'nonce-public-lifecycle',
  'v1',
  '{}'::jsonb
);
reset role;

select qr_test.assert_raises(
  $$select * from public.owner_set_canonical_qr_lifecycle(
    '60000000-0000-4000-8000-000000000010',
    '10000000-0000-4000-8000-000000000001',
    'pause', 1, '61000000-0000-4000-8000-000000000010')$$,
  'P0001',
  'public menu lifecycle pause must be rejected'
);

select qr_test.assert_raises(
  $$select * from public.owner_clear_canonical_qr(
    '60000000-0000-4000-8000-000000000010',
    '10000000-0000-4000-8000-000000000001',
    'archive', 1, '61000000-0000-4000-8000-000000000011')$$,
  'P0001',
  'public menu lifecycle archive must be rejected'
);

select qr_test.assert_raises(
  $$select * from public.owner_clear_canonical_qr(
    '60000000-0000-4000-8000-000000000010',
    '10000000-0000-4000-8000-000000000001',
    'revoke', 1, '61000000-0000-4000-8000-000000000012')$$,
  'P0001',
  'public menu lifecycle revoke must be rejected'
);

select qr_test.assert_true(
  (select status = 'active' and is_canonical and config_version = 1
   from public.qr_codes
   where id = '60000000-0000-4000-8000-000000000010')
  and (select count(*) = 0
       from public.qr_code_lifecycle_events
       where operation_id in (
         '61000000-0000-4000-8000-000000000010',
         '61000000-0000-4000-8000-000000000011',
         '61000000-0000-4000-8000-000000000012'
       )),
  'rejected public lifecycle actions must leave the row and audit log unchanged'
);

insert into public.qr_codes (
  id, restaurant_id, label, target_kind, purpose_key, target_path,
  token_hash, token_preview, token_ciphertext, token_nonce, token_key_version,
  style_json, status, is_canonical, config_version
) values (
  '60000000-0000-4000-8000-000000000020',
  '10000000-0000-4000-8000-000000000001',
  'Historical paused public menu',
  'menu',
  'public-resume',
  '/menu/fixture-a',
  'public-menu-resume-hash',
  'menu-resume',
  'cipher-public-resume',
  'nonce-public-resume',
  'v1',
  '{}'::jsonb,
  'paused',
  true,
  1
);

select * from public.owner_set_canonical_qr_lifecycle(
  '60000000-0000-4000-8000-000000000020',
  '10000000-0000-4000-8000-000000000001',
  'resume', 1, '61000000-0000-4000-8000-000000000020'
);

reset role;

select qr_test.assert_true(
  (select status = 'active' and is_canonical and config_version = 2
   from public.qr_codes
   where id = '60000000-0000-4000-8000-000000000020')
  and (select count(*) = 1
       from public.qr_code_lifecycle_events
       where operation_id = '61000000-0000-4000-8000-000000000020'),
  'resume remains available for a historically paused public QR'
);
