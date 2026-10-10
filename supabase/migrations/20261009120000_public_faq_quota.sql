-- Shared quota for the public FAQ assistant (POST /api/public/faq).
-- Additive only. Counters hold an HMAC of the client address, never the IP or
-- the question. Rows older than two days are pruned opportunistically.

create table if not exists public.public_faq_quota_counters (
  bucket text not null check (bucket ~ '^(burst|day|global):[a-z0-9]{1,64}$'),
  window_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  primary key (bucket, window_start)
);

create index if not exists public_faq_quota_counters_window_idx
  on public.public_faq_quota_counters (window_start);

alter table public.public_faq_quota_counters enable row level security;
alter table public.public_faq_quota_counters force row level security;
revoke all on table public.public_faq_quota_counters from public, anon, authenticated, service_role;

create or replace function public.consume_public_faq_quota(
  p_client_key text,
  p_burst_limit integer,
  p_burst_window_seconds integer,
  p_daily_limit integer,
  p_global_daily_limit integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_day timestamptz := date_trunc('day', clock_timestamp() at time zone 'utc') at time zone 'utc';
  v_burst_start timestamptz;
  v_hits integer;
begin
  if p_client_key is null
    or p_client_key !~ '^[a-f0-9]{32}$'
    or p_burst_limit is null or p_burst_limit not between 1 and 1000
    or p_burst_window_seconds is null or p_burst_window_seconds not between 10 and 3600
    or p_daily_limit is null or p_daily_limit not between 1 and 100000
    or p_global_daily_limit is null or p_global_daily_limit not between 1 and 1000000 then
    raise exception 'invalid public FAQ quota request' using errcode = '22023';
  end if;

  -- Prune on every path so rotated client keys cannot grow the table unbounded.
  if random() < 0.02 then
    delete from public.public_faq_quota_counters where window_start < v_now - interval '2 days';
  end if;

  -- Exhausted global budget: refuse before writing any per-client row.
  select c.hits into v_hits
    from public.public_faq_quota_counters c
   where c.bucket = 'global:all' and c.window_start = v_day;
  if coalesce(v_hits, 0) >= p_global_daily_limit then
    return 'budget_exhausted';
  end if;

  v_burst_start := to_timestamp(
    floor(extract(epoch from v_now) / p_burst_window_seconds) * p_burst_window_seconds
  );

  insert into public.public_faq_quota_counters as c (bucket, window_start, hits)
  values ('burst:' || p_client_key, v_burst_start, 1)
  on conflict (bucket, window_start) do update set hits = c.hits + 1
  returning c.hits into v_hits;
  if v_hits > p_burst_limit then
    return 'rate_limited';
  end if;

  insert into public.public_faq_quota_counters as c (bucket, window_start, hits)
  values ('day:' || p_client_key, v_day, 1)
  on conflict (bucket, window_start) do update set hits = c.hits + 1
  returning c.hits into v_hits;
  if v_hits > p_daily_limit then
    return 'rate_limited';
  end if;

  insert into public.public_faq_quota_counters as c (bucket, window_start, hits)
  values ('global:all', v_day, 1)
  on conflict (bucket, window_start) do update set hits = c.hits + 1
  returning c.hits into v_hits;
  if v_hits > p_global_daily_limit then
    return 'budget_exhausted';
  end if;

  return 'allowed';
end;
$$;

revoke all on function public.consume_public_faq_quota(text, integer, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_public_faq_quota(text, integer, integer, integer, integer)
  to service_role;
