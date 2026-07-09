-- Persistent restaurant-admin QR metadata. Apply after 0002_qr_resolve_scan_rpc.sql.

alter table public.qr_codes
  add column if not exists target_kind text;

update public.qr_codes
set target_kind = case
  when target_path = '/admin'
    or target_path = '/owner'
    or target_path like '/owner/%'
    or target_path like '/owner?%'
    then 'admin'
  else 'menu'
end
where target_kind is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'qr_codes_target_kind_check'
      and conrelid = 'public.qr_codes'::regclass
  ) then
    alter table public.qr_codes
      add constraint qr_codes_target_kind_check
      check (target_kind is null or target_kind in ('menu', 'admin'));
  end if;
end
$$;

create or replace function public.resolve_qr_code_scan_metadata(p_token_hash text)
returns table (
  qr_id uuid,
  restaurant_id uuid,
  target_kind text,
  target_path text,
  status text
)
language sql
security definer
set search_path = public
as $$
  update public.qr_codes as qr
  set
    scan_count = qr.scan_count + 1,
    last_scanned_at = now()
  where qr.token_hash = p_token_hash
    and qr.status = 'active'
  returning
    qr.id,
    qr.restaurant_id,
    coalesce(
      qr.target_kind,
      case
        when qr.target_path = '/admin'
          or qr.target_path = '/owner'
          or qr.target_path like '/owner/%'
          or qr.target_path like '/owner?%'
          then 'admin'
        else 'menu'
      end
    ),
    qr.target_path,
    qr.status;
$$;

comment on function public.resolve_qr_code_scan_metadata(text) is
  'Atomically records an active QR scan and returns live QR identity and target metadata.';

revoke execute on function public.resolve_qr_code_scan_metadata(text)
  from public, anon, authenticated;
grant execute on function public.resolve_qr_code_scan_metadata(text)
  to service_role;
