create table qr_test.historical_qr_snapshot as
select id, restaurant_id, label, token_hash, token_preview, target_path,
  style_json, status, scan_count, last_scanned_at, created_at, updated_at,
  target_kind
from public.qr_codes;

revoke all on table qr_test.historical_qr_snapshot from public, anon, authenticated;
