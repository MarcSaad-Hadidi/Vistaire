-- Atomic QR resolve: validate active token, increment scan_count, return target_path.
-- Avoids lost updates under concurrent scans (read-modify-write races).
--
-- Apply after 0001_qr_codes.sql. See docs/owner-qr-schema.md.

create or replace function public.resolve_qr_code_scan(p_token_hash text)
returns text
language sql
security definer
set search_path = public
as $$
  update public.qr_codes
  set
    scan_count = scan_count + 1,
    last_scanned_at = now()
  where token_hash = p_token_hash
    and status = 'active'
  returning target_path;
$$;

comment on function public.resolve_qr_code_scan(text) is
  'Atomically increments scan_count for an active QR and returns its target_path, or NULL if invalid/paused.';

revoke execute on function public.resolve_qr_code_scan(text) from public, anon, authenticated;
grant execute on function public.resolve_qr_code_scan(text) to service_role;
