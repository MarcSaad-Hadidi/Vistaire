-- Durable, project-wide media capacity accounting. This migration only
-- creates the closed gate: operators must explicitly insert/update the one
-- authoritative state row for the expected Supabase project before writes.

create table if not exists public.media_capacity_state (
  project_ref text primary key,
  quota_bytes bigint not null check (quota_bytes > 0),
  used_bytes bigint not null check (used_bytes >= 0),
  usage_measured_at timestamptz not null,
  quota_source text not null check (length(btrim(quota_source)) > 0),
  updated_at timestamptz not null default clock_timestamp(),
  check (project_ref = lower(btrim(project_ref))),
  check (project_ref ~ '^[a-z0-9][a-z0-9._-]{0,127}$'),
  check (used_bytes <= quota_bytes)
);

create table if not exists public.media_capacity_reservations (
  id uuid primary key default gen_random_uuid(),
  project_ref text not null references public.media_capacity_state(project_ref) on delete restrict,
  reservation_key text not null,
  reserved_bytes bigint not null check (reserved_bytes >= 0),
  actual_bytes bigint check (actual_bytes is null or actual_bytes >= 0),
  status text not null default 'active'
    check (status in ('active', 'settlement_pending', 'finalized', 'released')),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '5 minutes'),
  settled_at timestamptz,
  check (length(btrim(reservation_key)) between 1 and 512),
  check (expires_at > created_at),
  check (
    (status = 'active' and settled_at is null and actual_bytes is null)
    or (status = 'settlement_pending' and settled_at is null and actual_bytes is not null and actual_bytes <= reserved_bytes)
    or (status = 'finalized' and settled_at is not null and actual_bytes is not null and actual_bytes <= reserved_bytes)
    or (status = 'released' and settled_at is not null)
  )
);

create index if not exists media_capacity_reservations_active_idx
  on public.media_capacity_reservations(project_ref, expires_at)
  where status in ('active', 'settlement_pending');

-- A logical key may be retried after it is settled, but two live owners must
-- never share one reservation. The project state row lock serializes normal
-- inserts; this partial unique index is the final race guard.
create unique index if not exists media_capacity_reservations_live_key_idx
  on public.media_capacity_reservations(project_ref, reservation_key)
  where status in ('active', 'settlement_pending');

alter table public.media_capacity_state enable row level security;
alter table public.media_capacity_state force row level security;
alter table public.media_capacity_reservations enable row level security;
alter table public.media_capacity_reservations force row level security;

revoke all on table public.media_capacity_state from public, anon, authenticated, service_role;
revoke all on table public.media_capacity_reservations from public, anon, authenticated, service_role;

create or replace function public.reserve_media_capacity(
  p_project_ref text,
  p_reservation_key text,
  p_requested_bytes bigint,
  p_min_headroom_percent numeric default 20
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.media_capacity_state%rowtype;
  v_existing public.media_capacity_reservations%rowtype;
  v_active_bytes bigint := 0;
  v_headroom_bytes bigint;
  v_headroom_percent numeric;
  v_reservation_id uuid;
  v_expires_at timestamptz;
begin
  if p_project_ref is null
    or p_project_ref <> lower(btrim(p_project_ref))
    or p_project_ref !~ '^[a-z0-9][a-z0-9._-]{0,127}$'
    or p_reservation_key is null
    or length(btrim(p_reservation_key)) not between 1 and 512
    or p_requested_bytes is null
    or p_requested_bytes < 0
    or p_min_headroom_percent is null
    or p_min_headroom_percent < 20
    or p_min_headroom_percent >= 100 then
    return jsonb_build_object('status', 'unavailable', 'reason', 'invalid-request');
  end if;

  select * into v_state
    from public.media_capacity_state
   where project_ref = p_project_ref
   for update;
  if not found then
    return jsonb_build_object('status', 'unavailable', 'reason', 'state-missing');
  end if;
  if v_state.quota_bytes <= 0
    or v_state.used_bytes < 0
    or v_state.used_bytes > v_state.quota_bytes
    or v_state.usage_measured_at is null
    or btrim(v_state.quota_source) = '' then
    return jsonb_build_object('status', 'unavailable', 'reason', 'state-invalid');
  end if;

  select * into v_existing
    from public.media_capacity_reservations
   where project_ref = p_project_ref
     and reservation_key = btrim(p_reservation_key)
     and status in ('active', 'settlement_pending')
   limit 1
   for update;
  if found then
    return jsonb_build_object('status', 'unavailable', 'reason', 'reservation-key-active');
  end if;

  select coalesce(sum(reserved_bytes), 0)::bigint into v_active_bytes
    from public.media_capacity_reservations
   where project_ref = p_project_ref
     and status in ('active', 'settlement_pending');

  v_headroom_bytes := v_state.quota_bytes - v_state.used_bytes - v_active_bytes - p_requested_bytes;
  v_headroom_percent := (v_headroom_bytes::numeric * 100) / v_state.quota_bytes;
  if v_headroom_bytes < 0 or v_headroom_percent < p_min_headroom_percent then
    return jsonb_build_object(
      'status', 'insufficient',
      'projectRef', p_project_ref,
      'quotaBytes', v_state.quota_bytes,
      'usedBytes', v_state.used_bytes,
      'activeReservedBytes', v_active_bytes,
      'requestedBytes', p_requested_bytes,
      'headroomBytes', greatest(v_headroom_bytes, 0),
      'headroomPercent', greatest(v_headroom_percent, 0)
    );
  end if;

  insert into public.media_capacity_reservations (
    project_ref, reservation_key, reserved_bytes
  ) values (
    p_project_ref, btrim(p_reservation_key), p_requested_bytes
  ) returning id, expires_at into v_reservation_id, v_expires_at;

  return jsonb_build_object(
    'status', 'reserved',
    'reservationId', v_reservation_id,
    'projectRef', p_project_ref,
    'quotaBytes', v_state.quota_bytes,
    'usedBytes', v_state.used_bytes,
    'activeReservedBytes', v_active_bytes,
    'requestedBytes', p_requested_bytes,
    'headroomBytes', v_headroom_bytes,
    'headroomPercent', v_headroom_percent,
    'expiresAt', v_expires_at
  );
end;
$$;

create or replace function public.renew_media_capacity_reservation(
  p_project_ref text,
  p_reservation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expires_at timestamptz;
begin
  -- Expiry is a heartbeat deadline, not a release. Even an overdue live row
  -- stays counted until explicit settlement, and its owner may renew it.
  update public.media_capacity_reservations
     set expires_at = clock_timestamp() + interval '5 minutes'
   where id = p_reservation_id
     and project_ref = p_project_ref
     and status in ('active', 'settlement_pending')
  returning expires_at into v_expires_at;
  if not found then
    return jsonb_build_object('status', 'unavailable', 'reason', 'reservation-not-live');
  end if;
  return jsonb_build_object('status', 'renewed', 'expiresAt', v_expires_at);
end;
$$;

create or replace function public.finalize_media_capacity_reservation(
  p_project_ref text,
  p_reservation_id uuid,
  p_actual_bytes bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.media_capacity_state%rowtype;
  v_reservation public.media_capacity_reservations%rowtype;
begin
  if p_actual_bytes is null or p_actual_bytes < 0 then
    return jsonb_build_object('status', 'unavailable', 'reason', 'invalid-actual-bytes');
  end if;
  select * into v_state
    from public.media_capacity_state
   where project_ref = p_project_ref
   for update;
  if not found then
    return jsonb_build_object('status', 'unavailable', 'reason', 'state-missing');
  end if;
  select * into v_reservation
    from public.media_capacity_reservations
   where id = p_reservation_id and project_ref = p_project_ref
   for update;
  if not found then
    return jsonb_build_object('status', 'unavailable', 'reason', 'reservation-not-active');
  end if;
  if v_reservation.status = 'finalized' and v_reservation.actual_bytes = p_actual_bytes then
    return jsonb_build_object('status', 'finalized', 'actualBytes', p_actual_bytes);
  end if;
  if v_reservation.status not in ('active', 'settlement_pending') then
    return jsonb_build_object('status', 'unavailable', 'reason', 'reservation-not-active');
  end if;
  if v_reservation.status = 'settlement_pending'
    and v_reservation.actual_bytes <> p_actual_bytes then
    return jsonb_build_object('status', 'unavailable', 'reason', 'settlement-bytes-conflict');
  end if;
  if p_actual_bytes > v_reservation.reserved_bytes
    or v_state.used_bytes + p_actual_bytes > v_state.quota_bytes then
    return jsonb_build_object('status', 'unavailable', 'reason', 'actual-bytes-exceed-reservation');
  end if;
  update public.media_capacity_reservations
     set status = 'finalized', actual_bytes = p_actual_bytes, settled_at = clock_timestamp()
   where id = v_reservation.id;
  update public.media_capacity_state
     set used_bytes = used_bytes + p_actual_bytes, updated_at = clock_timestamp()
   where project_ref = p_project_ref;
  return jsonb_build_object('status', 'finalized', 'actualBytes', p_actual_bytes);
end;
$$;

create or replace function public.release_media_capacity_reservation(
  p_project_ref text,
  p_reservation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.media_capacity_reservations%rowtype;
begin
  select * into v_reservation
    from public.media_capacity_reservations
   where id = p_reservation_id and project_ref = p_project_ref
   for update;
  if not found then
    return jsonb_build_object('status', 'unavailable', 'reason', 'reservation-missing');
  end if;
  if v_reservation.status = 'released' then
    return jsonb_build_object('status', 'released');
  end if;
  if v_reservation.status <> 'active' then
    return jsonb_build_object('status', 'unavailable', 'reason', 'reservation-not-active');
  end if;
  update public.media_capacity_reservations
     set status = 'released', settled_at = clock_timestamp()
   where id = v_reservation.id;
  return jsonb_build_object('status', 'released');
end;
$$;

create or replace function public.get_media_capacity_state(p_project_ref text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_state public.media_capacity_state%rowtype;
  v_active_bytes bigint;
begin
  select * into v_state
    from public.media_capacity_state
   where project_ref = p_project_ref;
  if not found then
    return jsonb_build_object('status', 'unavailable', 'reason', 'state-missing');
  end if;
  select coalesce(sum(reserved_bytes), 0)::bigint into v_active_bytes
    from public.media_capacity_reservations
   where project_ref = p_project_ref
     and status in ('active', 'settlement_pending');
  return jsonb_build_object(
    'status', 'available',
    'projectRef', v_state.project_ref,
    'quotaBytes', v_state.quota_bytes,
    'usedBytes', v_state.used_bytes,
    'activeReservedBytes', v_active_bytes,
    'usageMeasuredAt', v_state.usage_measured_at,
    'quotaSource', v_state.quota_source
  );
end;
$$;

revoke all on function public.reserve_media_capacity(text, text, bigint, numeric) from public, anon, authenticated;
revoke all on function public.renew_media_capacity_reservation(text, uuid) from public, anon, authenticated;
revoke all on function public.finalize_media_capacity_reservation(text, uuid, bigint) from public, anon, authenticated;
revoke all on function public.release_media_capacity_reservation(text, uuid) from public, anon, authenticated;
revoke all on function public.get_media_capacity_state(text) from public, anon, authenticated;
grant execute on function public.reserve_media_capacity(text, text, bigint, numeric) to service_role;
grant execute on function public.renew_media_capacity_reservation(text, uuid) to service_role;
grant execute on function public.finalize_media_capacity_reservation(text, uuid, bigint) to service_role;
grant execute on function public.release_media_capacity_reservation(text, uuid) to service_role;
grant execute on function public.get_media_capacity_state(text) to service_role;
