-- Persist enough immutable context to reconcile every reservation without
-- parsing an application-formatted reservation key. Existing legacy rows may
-- remain contextless, but every reservation created through the exposed RPC
-- must provide the complete context.

alter table public.media_capacity_reservations
  add column if not exists operation_id uuid,
  add column if not exists restaurant_id uuid,
  add column if not exists dish_id uuid,
  add column if not exists recipe_id text;

do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_constraint
     where conname = 'media_capacity_reservations_context_shape_check'
       and conrelid = 'public.media_capacity_reservations'::regclass
  ) then
    alter table public.media_capacity_reservations
      add constraint media_capacity_reservations_context_shape_check
      check (
        (
          operation_id is null
          and restaurant_id is null
          and dish_id is null
          and recipe_id is null
        )
        or (
          operation_id is not null
          and restaurant_id is not null
          and dish_id is not null
          and recipe_id is not null
          and recipe_id = lower(btrim(recipe_id))
          and recipe_id ~ '^[a-z0-9][a-z0-9._-]{0,127}$'
        )
      );
  end if;
end;
$$;

create index if not exists media_capacity_reservations_operation_idx
  on public.media_capacity_reservations(project_ref, operation_id)
  where operation_id is not null;

create or replace function public.reserve_media_capacity(
  p_project_ref text,
  p_reservation_key text,
  p_operation_id uuid,
  p_restaurant_id uuid,
  p_dish_id uuid,
  p_recipe_id text,
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
    or p_operation_id is null
    or p_restaurant_id is null
    or p_dish_id is null
    or p_recipe_id is null
    or p_recipe_id <> lower(btrim(p_recipe_id))
    or p_recipe_id !~ '^[a-z0-9][a-z0-9._-]{0,127}$'
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
    or v_state.usage_measured_at < clock_timestamp() - interval '15 minutes'
    or v_state.usage_measured_at > clock_timestamp()
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
    project_ref,
    reservation_key,
    operation_id,
    restaurant_id,
    dish_id,
    recipe_id,
    reserved_bytes
  ) values (
    p_project_ref,
    btrim(p_reservation_key),
    p_operation_id,
    p_restaurant_id,
    p_dish_id,
    p_recipe_id,
    p_requested_bytes
  ) returning id, expires_at into v_reservation_id, v_expires_at;

  return jsonb_build_object(
    'status', 'reserved',
    'reservationId', v_reservation_id,
    'projectRef', p_project_ref,
    'operationId', p_operation_id,
    'restaurantId', p_restaurant_id,
    'dishId', p_dish_id,
    'recipeId', p_recipe_id,
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

-- Remove the contextless overload created by the preceding migration. Keeping
-- it merely revoked would still leave an avoidable RPC surface and could be
-- re-granted accidentally later.
drop function if exists public.reserve_media_capacity(text, text, bigint, numeric);

revoke all on function public.reserve_media_capacity(
  text, text, uuid, uuid, uuid, text, bigint, numeric
) from public, anon, authenticated;
grant execute on function public.reserve_media_capacity(
  text, text, uuid, uuid, uuid, text, bigint, numeric
) to service_role;
