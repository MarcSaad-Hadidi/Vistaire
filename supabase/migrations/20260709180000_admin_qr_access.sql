-- Persistent restaurant-admin QR metadata. Apply after 0002_qr_resolve_scan_rpc.sql.

begin;

alter table public.qr_codes
  add column if not exists target_kind text;

-- Fail before any data update when a stored restaurant id has no parent row.
do $$
begin
  if exists (
    select 1
    from public.qr_codes as qr
    left join public.restaurants as restaurant
      on restaurant.id = qr.restaurant_id
    where qr.restaurant_id is not null
      and restaurant.id is null
  ) then
    raise exception 'Cannot harden QR schema: restaurant_id references a missing public.restaurants row';
  end if;
end;
$$;

-- Legacy admin destinations also need a restaurant before canonicalization.
do $$
begin
  if exists (
    select 1
    from public.qr_codes
    where restaurant_id is null
      and (
        target_kind = 'admin'
        or target_path = '/admin'
        or target_path like '/admin/%'
        or target_path like '/admin?%'
        or target_path = '/owner'
        or target_path like '/owner/%'
        or target_path like '/owner?%'
      )
  ) then
    raise exception 'Cannot harden admin QR schema: historical admin QR rows require restaurant_id before migration';
  end if;
end;
$$;

-- Reject unknown kinds and mismatched kind/path pairs before any data update.
do $$
begin
  if exists (
    select 1
    from public.qr_codes
    where (target_kind is not null and target_kind not in ('menu', 'admin'))
      or (
        target_kind = 'menu'
        and not (
          target_path = '/demo'
          or target_path like '/menu/%'
        )
      )
      or (
        target_kind = 'admin'
        and not (
          target_path = '/admin'
          or target_path like '/admin/%'
          or target_path like '/admin?%'
          or target_path = '/owner'
          or target_path like '/owner/%'
          or target_path like '/owner?%'
        )
      )
      or (
        target_kind is null
        and not (
          target_path = '/demo'
          or target_path like '/menu/%'
          or target_path = '/admin'
          or target_path like '/admin/%'
          or target_path like '/admin?%'
          or target_path = '/owner'
          or target_path like '/owner/%'
          or target_path like '/owner?%'
        )
      )
  ) then
    raise exception 'Cannot harden QR schema: unknown or incoherent target_kind/target_path values';
  end if;
end;
$$;

-- Backfills must not make historical QR rows look freshly updated. The trigger
-- is restored before commit; a failed transaction restores it automatically.
do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.qr_codes'::regclass
      and tgname = 'qr_codes_set_updated_at'
  ) then
    alter table public.qr_codes
      disable trigger qr_codes_set_updated_at;
  end if;
end;
$$;

update public.qr_codes
set
  target_kind = 'admin',
  target_path = '/admin'
where target_kind = 'admin'
  or (
    target_kind is null
    and (
      target_path = '/admin'
      or target_path like '/admin/%'
      or target_path like '/admin?%'
      or target_path = '/owner'
      or target_path like '/owner/%'
      or target_path like '/owner?%'
    )
  );

update public.qr_codes
set target_kind = 'menu'
where target_kind is null
  and (
    target_path = '/demo'
    or target_path like '/menu/%'
  );

do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.qr_codes'::regclass
      and tgname = 'qr_codes_set_updated_at'
  ) then
    alter table public.qr_codes
      enable trigger qr_codes_set_updated_at;
  end if;
end;
$$;

alter table public.qr_codes
  drop constraint if exists qr_codes_target_kind_check;

alter table public.qr_codes
  drop constraint if exists qr_codes_target_kind_values_check;

alter table public.qr_codes
  add constraint qr_codes_target_kind_values_check
  check (target_kind in ('menu', 'admin'));

alter table public.qr_codes
  validate constraint qr_codes_target_kind_values_check;

alter table public.qr_codes
  alter column target_kind set not null;

alter table public.qr_codes
  drop constraint if exists qr_codes_admin_restaurant_required_check;

alter table public.qr_codes
  add constraint qr_codes_admin_restaurant_required_check
  check (target_kind <> 'admin' or restaurant_id is not null);

alter table public.qr_codes
  validate constraint qr_codes_admin_restaurant_required_check;

alter table public.qr_codes
  drop constraint if exists qr_codes_admin_target_path_check;

alter table public.qr_codes
  add constraint qr_codes_admin_target_path_check
  check (target_kind <> 'admin' or target_path = '/admin');

alter table public.qr_codes
  validate constraint qr_codes_admin_target_path_check;

alter table public.qr_codes
  drop constraint if exists qr_codes_menu_target_path_check;

alter table public.qr_codes
  add constraint qr_codes_menu_target_path_check
  check (
    target_kind <> 'menu'
    or target_path = '/demo'
    or target_path like '/menu/%'
  );

alter table public.qr_codes
  validate constraint qr_codes_menu_target_path_check;

alter table public.qr_codes
  drop constraint if exists qr_codes_restaurant_id_fkey;

alter table public.qr_codes
  add constraint qr_codes_restaurant_id_fkey
  foreign key (restaurant_id)
  references public.restaurants (id)
  on delete cascade;

alter table public.qr_codes
  validate constraint qr_codes_restaurant_id_fkey;

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
set search_path = ''
as $$
  update public.qr_codes as qr
  set
    scan_count = qr.scan_count + 1,
    last_scanned_at = pg_catalog.now()
  where qr.token_hash = p_token_hash
    and qr.status = 'active'
  returning
    qr.id as qr_id,
    qr.restaurant_id,
    qr.target_kind,
    qr.target_path,
    qr.status;
$$;

comment on function public.resolve_qr_code_scan_metadata(text) is
  'Atomically records an active QR scan and returns live QR identity and target metadata.';

revoke execute on function public.resolve_qr_code_scan_metadata(text)
  from public, anon, authenticated;
grant execute on function public.resolve_qr_code_scan_metadata(text)
  to service_role;

commit;
