create table if not exists public.admin_assistant_rate_limits (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  bucket_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (restaurant_id, bucket_start)
);

alter table public.admin_assistant_rate_limits enable row level security;

drop policy if exists vistaire_admin_assistant_no_direct_access
  on public.admin_assistant_rate_limits;
create policy vistaire_admin_assistant_no_direct_access
  on public.admin_assistant_rate_limits
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on table public.admin_assistant_rate_limits from public, anon, authenticated, service_role;

create or replace function public.consume_admin_assistant_quota(
  p_restaurant_id uuid,
  p_limit integer default 10,
  p_window_seconds integer default 60
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket_start timestamptz;
  v_count integer;
begin
  if p_restaurant_id is null or p_limit < 1 or p_limit > 100 or
     p_window_seconds < 10 or p_window_seconds > 3600 then
    raise exception 'invalid quota input' using errcode = '22023';
  end if;

  v_bucket_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.admin_assistant_rate_limits as quota (
    restaurant_id,
    bucket_start,
    request_count
  ) values (
    p_restaurant_id,
    v_bucket_start,
    1
  )
  on conflict (restaurant_id, bucket_start) do update
    set request_count = quota.request_count + 1
    where quota.request_count < p_limit
  returning request_count into v_count;

  if v_count is null then
    select quota.request_count
      into v_count
      from public.admin_assistant_rate_limits as quota
     where quota.restaurant_id = p_restaurant_id
       and quota.bucket_start = v_bucket_start;
    return query select false, 0, v_bucket_start + make_interval(secs => p_window_seconds);
    return;
  end if;

  return query select true, greatest(0, p_limit - v_count),
    v_bucket_start + make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function public.consume_admin_assistant_quota(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_admin_assistant_quota(uuid, integer, integer)
  to service_role;
