set role service_role;

select * from public.owner_get_or_create_canonical_qr(
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001', 'Lifecycle', 'admin', 'lifecycle',
  '/admin', 'lifecycle-hash', 'life', 'cipher-life', 'nonce-life', 'v1', '{}'::jsonb
);

select * from public.owner_set_canonical_qr_lifecycle(
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001', 'pause', 1,
  '40000000-0000-4000-8000-000000000001'
);

-- Same operation id and payload is a replay, never a second event/version bump.
select * from public.owner_set_canonical_qr_lifecycle(
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001', 'pause', 1,
  '40000000-0000-4000-8000-000000000001'
);

reset role;

select qr_test.assert_true(
  (select status = 'paused' and is_canonical and config_version = 2
   from public.qr_codes where id = '30000000-0000-4000-8000-000000000001'),
  'pause preserves the canonical slot and bumps config_version once'
);
select qr_test.assert_true(
  (select count(*) = 1 from public.qr_code_lifecycle_events
   where operation_id = '40000000-0000-4000-8000-000000000001'),
  'pause replay writes one audit event'
);
select qr_test.assert_true(
  (select count(*) = 0 from public.resolve_qr_code_scan_metadata('lifecycle-hash')),
  'paused QR must not resolve'
);

set role service_role;
select * from public.owner_set_canonical_qr_lifecycle(
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001', 'resume', 2,
  '40000000-0000-4000-8000-000000000002'
);
reset role;

select qr_test.assert_true(
  (select status = 'active' and is_canonical and config_version = 3
   from public.qr_codes where id = '30000000-0000-4000-8000-000000000001'),
  'resume reactivates the same canonical QR'
);
select qr_test.assert_true(
  (select count(*) = 1 from public.resolve_qr_code_scan_metadata('lifecycle-hash')),
  'resumed QR resolves safely'
);
select qr_test.assert_raises(
  $$select * from public.owner_set_canonical_qr_lifecycle(
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001', 'pause', 2,
    '40000000-0000-4000-8000-000000000003')$$,
  '40001', 'stale config_version must fail closed'
);

-- Active historical non-canonical rows remain resolvable forever unless paused,
-- archived or revoked.
select qr_test.assert_true(
  public.resolve_qr_code_scan('historical-menu-hash') = '/menu/fixture-a',
  'active historical menu QR remains resolvable'
);

set role service_role;
select * from public.owner_get_or_create_canonical_qr(
  '30000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001', 'Archive', 'admin', 'archive',
  '/admin', 'archive-hash', 'arch', 'cipher-arch', 'nonce-arch', 'v1', '{}'::jsonb
);
select * from public.owner_clear_canonical_qr(
  '30000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001', 'archive', 1,
  '40000000-0000-4000-8000-000000000004'
);
-- Exact archive replay returns the immutable terminal result and never marks
-- the historical row canonical again.
select * from public.owner_clear_canonical_qr(
  '30000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001', 'archive', 1,
  '40000000-0000-4000-8000-000000000004'
);
select * from public.owner_get_or_create_canonical_qr(
  '30000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001', 'Revoke', 'admin', 'revoke',
  '/admin', 'revoke-hash', 'rev', 'cipher-rev', 'nonce-rev', 'v1', '{}'::jsonb
);
select * from public.owner_clear_canonical_qr(
  '30000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001', 'revoke', 1,
  '40000000-0000-4000-8000-000000000005'
);
reset role;

select qr_test.assert_true(
  (select status = 'archived' and not is_canonical and revoked_at is null
   from public.qr_codes where id = '30000000-0000-4000-8000-000000000002')
  and (select status = 'revoked' and not is_canonical and revoked_at is not null
   from public.qr_codes where id = '30000000-0000-4000-8000-000000000003'),
  'clear atomically archives or revokes and releases the canonical slot'
);
select qr_test.assert_true(
  (select count(*) = 0 from public.resolve_qr_code_scan_metadata('archive-hash'))
  and (select count(*) = 0 from public.resolve_qr_code_scan_metadata('revoke-hash')),
  'archived and revoked QR never resolve'
);
set role service_role;
do $$
begin
  begin
    update public.qr_codes set status = 'active', revoked_at = null
    where id = '30000000-0000-4000-8000-000000000003';
  exception when sqlstate '55000' then
    return;
  end;
  raise exception 'assertion failed: revoke must resist direct service_role update';
end;
$$;
reset role;

begin;
set local role service_role;
delete from public.qr_codes
where id = '30000000-0000-4000-8000-000000000003';
reset role;
select qr_test.assert_true(
  exists (select 1 from public.qr_code_lifecycle_events
          where operation_id = '40000000-0000-4000-8000-000000000005'),
  'audit survives QR deletion independently of mutable runtime rows'
);
rollback;

-- Explicit rotation dispositions and lineage.
set role service_role;
select * from public.owner_get_or_create_canonical_qr(
  '31000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001', 'Rotate keep', 'admin', 'rotate-keep',
  '/admin', 'rotate-keep-old', 'old', 'cipher-old', 'nonce-old', 'v1', '{"v":1}'::jsonb
);
select * from public.owner_rotate_canonical_qr(
  '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001', 'admin', 'rotate-keep', 'Rotate keep',
  '/admin', 'rotate-keep-new', 'new', 'cipher-new', 'nonce-new', 'v1', '{"v":1}'::jsonb,
  true, 'keep-active', '41000000-0000-4000-8000-000000000001', 1
);
-- Exact replay succeeds and returns the same lineage without another insert.
select * from public.owner_rotate_canonical_qr(
  '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001', 'admin', 'rotate-keep', 'Rotate keep',
  '/admin', 'rotate-keep-new', 'new', 'cipher-new', 'nonce-new', 'v1', '{"v":1}'::jsonb,
  true, 'keep-active', '41000000-0000-4000-8000-000000000001', 1
);
reset role;

select qr_test.assert_true(
  (select status = 'active' and not is_canonical from public.qr_codes
   where id = '31000000-0000-4000-8000-000000000001')
  and (select status = 'active' and is_canonical
       and supersedes_qr_code_id = '31000000-0000-4000-8000-000000000001'
       and config_version = 2 from public.qr_codes
   where id = '31000000-0000-4000-8000-000000000002')
  and (select count(*) = 1 from public.qr_code_lifecycle_events
   where operation_id = '41000000-0000-4000-8000-000000000001'),
  'keep-active rotation is transactional, versioned, audited and idempotent'
);
select qr_test.assert_true(
  public.resolve_qr_code_scan('rotate-keep-old') = '/admin',
  'keep-active predecessor remains resolvable while non-canonical'
);

-- Once B has itself rotated to C, replaying the earlier A -> B operation must
-- conflict instead of representing B as active/canonical again.
set role service_role;
select * from public.owner_rotate_canonical_qr(
  '31000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001', 'admin', 'rotate-keep', 'Rotate keep',
  '/admin', 'rotate-keep-newest', 'newest', 'cipher-newest', 'nonce-newest', 'v1', '{"v":1}'::jsonb,
  true, 'revoke', '41000000-0000-4000-8000-000000000002', 2
);
reset role;
select qr_test.assert_raises(
  $$select * from public.owner_rotate_canonical_qr(
    '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001', 'admin', 'rotate-keep', 'Rotate keep',
    '/admin', 'rotate-keep-new', 'new', 'cipher-new', 'nonce-new', 'v1', '{"v":1}'::jsonb,
    true, 'keep-active', '41000000-0000-4000-8000-000000000001', 1)$$,
  '40001', 'stale A to B replay must not re-expose B as the canonical result'
);
select qr_test.assert_true(
  (select status = 'revoked' and not is_canonical from public.qr_codes
   where id = '31000000-0000-4000-8000-000000000002')
  and (select status = 'active' and is_canonical from public.qr_codes
       where id = '31000000-0000-4000-8000-000000000003'),
  'stale replay leaves terminal B and current C unchanged'
);
select qr_test.assert_raises(
  $$select * from public.owner_rotate_canonical_qr(
    '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000099',
    '10000000-0000-4000-8000-000000000001', 'admin', 'rotate-keep', 'Rotate keep',
    '/admin', 'different-hash', 'new', 'cipher-new', 'nonce-new', 'v1', '{"v":1}'::jsonb,
    true, 'pause', '41000000-0000-4000-8000-000000000001', 1)$$,
  '22023', 'rotation request id reuse with different payload must conflict'
);

-- Audit identity remains authoritative after mutable rows are deleted, but a
-- stale result is never reconstructed as current.
begin;
set local role service_role;
delete from public.qr_codes where id in (
  '31000000-0000-4000-8000-000000000002',
  '31000000-0000-4000-8000-000000000003'
);
reset role;
select qr_test.assert_raises(
  $$select * from public.owner_rotate_canonical_qr(
    '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001', 'admin', 'rotate-keep', 'Rotate keep',
    '/admin', 'rotate-keep-new', 'new', 'cipher-new', 'nonce-new', 'v1', '{"v":1}'::jsonb,
    true, 'keep-active', '41000000-0000-4000-8000-000000000001', 1)$$,
  '40001', 'deleted successor replay must fail closed'
);
select qr_test.assert_raises(
  $$select * from public.owner_rotate_canonical_qr(
    '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001', 'admin', 'rotate-keep', 'Changed payload',
    '/admin', 'rotate-keep-new', 'new', 'cipher-new', 'nonce-new', 'v1', '{"v":1}'::jsonb,
    true, 'keep-active', '41000000-0000-4000-8000-000000000001', 1)$$,
  '22023', 'deleted successor cannot bypass rotation payload conflict'
);
rollback;

set role service_role;
select * from public.owner_get_or_create_canonical_qr(
  '31000000-0000-4000-8000-000000000010',
  '10000000-0000-4000-8000-000000000001', 'Rotate revoke', 'admin', 'rotate-revoke',
  '/admin', 'rotate-revoke-old', 'old', 'cipher-old-r', 'nonce-old-r', 'v1', '{}'::jsonb
);
select * from public.owner_rotate_canonical_qr(
  '31000000-0000-4000-8000-000000000010', '31000000-0000-4000-8000-000000000011',
  '10000000-0000-4000-8000-000000000001', 'admin', 'rotate-revoke', 'Rotate revoke',
  '/admin', 'rotate-revoke-new', 'new', 'cipher-new-r', 'nonce-new-r', 'v1', '{}'::jsonb,
  true, 'revoke', '41000000-0000-4000-8000-000000000010', 1
);
reset role;

select qr_test.assert_true(
  (select status = 'revoked' and not is_canonical and revoked_at is not null
   from public.qr_codes where id = '31000000-0000-4000-8000-000000000010')
  and (select status = 'active' and is_canonical
   from public.qr_codes where id = '31000000-0000-4000-8000-000000000011')
  and (select previous_status = 'active' and new_status = 'revoked'
         and previous_config_version = 1 and new_config_version = 2
       from public.qr_code_lifecycle_events
       where operation_id = '41000000-0000-4000-8000-000000000010')
  and (select count(*) = 0 from public.resolve_qr_code_scan_metadata('rotate-revoke-old')),
  'revoke rotation is terminal for the predecessor and activates its successor'
);

-- keep-active means active even when the canonical predecessor was paused.
set role service_role;
select * from public.owner_get_or_create_canonical_qr(
  '31000000-0000-4000-8000-000000000030',
  '10000000-0000-4000-8000-000000000001', 'Rotate paused', 'admin', 'rotate-paused',
  '/admin', 'rotate-paused-old', 'old', 'cipher-old-p', 'nonce-old-p', 'v1', '{}'::jsonb
);
select * from public.owner_set_canonical_qr_lifecycle(
  '31000000-0000-4000-8000-000000000030',
  '10000000-0000-4000-8000-000000000001', 'pause', 1,
  '41000000-0000-4000-8000-000000000030'
);
select * from public.owner_rotate_canonical_qr(
  '31000000-0000-4000-8000-000000000030', '31000000-0000-4000-8000-000000000031',
  '10000000-0000-4000-8000-000000000001', 'admin', 'rotate-paused', 'Rotate paused',
  '/admin', 'rotate-paused-new', 'new', 'cipher-new-p', 'nonce-new-p', 'v1', '{}'::jsonb,
  true, 'keep-active', '41000000-0000-4000-8000-000000000031', 2
);
reset role;
select qr_test.assert_true(
  (select status = 'active' and not is_canonical and config_version = 3
   from public.qr_codes where id = '31000000-0000-4000-8000-000000000030')
  and (select previous_status = 'paused' and new_status = 'active'
       from public.qr_code_lifecycle_events
       where operation_id = '41000000-0000-4000-8000-000000000031'),
  'keep-active rotation resumes a paused predecessor and audits its real state'
);

set role service_role;
select * from public.owner_get_or_create_canonical_qr(
  '31000000-0000-4000-8000-000000000020',
  '10000000-0000-4000-8000-000000000001', 'Rotate rollback', 'admin', 'rotate-rollback',
  '/admin', 'rotate-rollback-old', 'old', 'cipher-old-x', 'nonce-old-x', 'v1', '{}'::jsonb
);
reset role;
select qr_test.assert_raises(
  $$select * from public.owner_rotate_canonical_qr(
    '31000000-0000-4000-8000-000000000020', '31000000-0000-4000-8000-000000000021',
    '10000000-0000-4000-8000-000000000001', 'admin', 'rotate-rollback', 'Rotate rollback',
    '/admin', 'historical-menu-hash', 'new', 'cipher-new-x', 'nonce-new-x', 'v1', '{}'::jsonb,
    true, 'pause', '41000000-0000-4000-8000-000000000020', 1)$$,
  '23505', 'rotation candidate collision must roll back atomically'
);
select qr_test.assert_true(
  (select status = 'active' and is_canonical and config_version = 1
   from public.qr_codes where id = '31000000-0000-4000-8000-000000000020')
  and not exists (select 1 from public.qr_codes where id = '31000000-0000-4000-8000-000000000021')
  and not exists (select 1 from public.qr_code_lifecycle_events
                  where operation_id = '41000000-0000-4000-8000-000000000020'),
  'failed rotation leaves predecessor, successor and audit unchanged'
);
