insert into public.restaurants (id, name, slug, status)
values
  ('10000000-0000-4000-8000-000000000001', 'Fixture A', 'fixture-a', 'active'),
  ('10000000-0000-4000-8000-000000000002', 'Fixture B', 'fixture-b', 'active');

-- Mirrors the verified remote shape before canonical lifecycle: seven active
-- admin rows and one active menu row, with stable historical values.
insert into public.qr_codes (
  id, restaurant_id, label, token_hash, token_preview, target_path,
  style_json, status, scan_count, last_scanned_at, created_at, updated_at
)
select
  ('20000000-0000-4000-8000-' || pg_catalog.lpad(n::text, 12, '0'))::uuid,
  case when n <= 4 then '10000000-0000-4000-8000-000000000001'::uuid
       else '10000000-0000-4000-8000-000000000002'::uuid end,
  'Historical admin ' || n,
  'historical-admin-hash-' || n,
  'hist-' || n,
  case when n % 2 = 0 then '/admin?legacy=' || n else '/owner/legacy/' || n end,
  pg_catalog.jsonb_build_object('fixture', n),
  'active',
  n * 10,
  '2026-07-01 12:00:00+00'::timestamptz + pg_catalog.make_interval(mins => n),
  '2026-06-01 12:00:00+00'::timestamptz + pg_catalog.make_interval(days => n),
  '2026-06-02 12:00:00+00'::timestamptz + pg_catalog.make_interval(days => n)
from pg_catalog.generate_series(1, 7) as n;

insert into public.qr_codes (
  id, restaurant_id, label, token_hash, token_preview, target_path,
  style_json, status, scan_count, last_scanned_at, created_at, updated_at
) values (
  '20000000-0000-4000-8000-000000000008',
  '10000000-0000-4000-8000-000000000001',
  'Historical menu', 'historical-menu-hash', 'menu-hist', '/menu/fixture-a',
  '{"fixture":"menu"}'::jsonb, 'active', 81, '2026-07-02 12:00:00+00',
  '2026-06-10 12:00:00+00', '2026-06-11 12:00:00+00'
);
