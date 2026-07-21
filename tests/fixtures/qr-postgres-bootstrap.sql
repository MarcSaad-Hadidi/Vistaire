\set ON_ERROR_STOP on

insert into public.restaurants (
  id, name, slug, status, created_at, updated_at
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'QR PostgreSQL Restaurant A',
    'qr-postgres-a',
    'active',
    '2026-07-01 10:00:00+00',
    '2026-07-01 10:00:00+00'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'QR PostgreSQL Restaurant B',
    'qr-postgres-b',
    'active',
    '2026-07-01 10:00:00+00',
    '2026-07-01 10:00:00+00'
  );

-- These are deliberately pre-canonical rows. Their ids, hashes, destinations,
-- styles, counters, statuses, and timestamps must survive the real migrations.
insert into public.qr_codes (
  id,
  restaurant_id,
  label,
  token_hash,
  token_preview,
  target_path,
  style_json,
  status,
  scan_count,
  last_scanned_at,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Menu demo historique',
    'legacy-menu-demo-hash',
    'legacy...demo',
    '/demo',
    '{"foregroundColor":"#111111"}'::jsonb,
    'active',
    11,
    '2026-07-02 11:00:00+00',
    '2026-07-01 11:00:00+00',
    '2026-07-03 11:00:00+00'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Menu restaurant historique',
    'legacy-menu-path-hash',
    'legacy...menu',
    '/menu/qr-postgres-a',
    '{"foregroundColor":"#222222"}'::jsonb,
    'paused',
    7,
    null,
    '2026-07-01 12:00:00+00',
    '2026-07-03 12:00:00+00'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Admin owner historique',
    'legacy-admin-owner-hash',
    'legacy...wner',
    '/owner/settings?source=qr',
    '{"foregroundColor":"#333333"}'::jsonb,
    'active',
    19,
    '2026-07-02 13:00:00+00',
    '2026-07-01 13:00:00+00',
    '2026-07-03 13:00:00+00'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Admin archive historique',
    'legacy-admin-archived-hash',
    'legacy...hive',
    '/admin?legacy=1',
    '{"foregroundColor":"#444444"}'::jsonb,
    'archived',
    23,
    '2026-07-02 14:00:00+00',
    '2026-07-01 14:00:00+00',
    '2026-07-03 14:00:00+00'
  );
