\set ON_ERROR_STOP on

create extension if not exists pgcrypto;
create extension if not exists dblink;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

\ir ../../../supabase/migrations/20260815120000_media_capacity_reservations.sql

do $$
begin
  if not (
    (select relrowsecurity from pg_catalog.pg_class where oid = 'public.media_capacity_state'::regclass)
    and (select relrowsecurity from pg_catalog.pg_class where oid = 'public.media_capacity_reservations'::regclass)
  ) then
    raise exception 'capacity tables must enforce RLS';
  end if;
  if pg_catalog.has_table_privilege('service_role', 'public.media_capacity_state', 'SELECT,INSERT,UPDATE,DELETE')
    or pg_catalog.has_table_privilege('service_role', 'public.media_capacity_reservations', 'SELECT,INSERT,UPDATE,DELETE')
    or pg_catalog.has_table_privilege('anon', 'public.media_capacity_state', 'SELECT')
    or pg_catalog.has_table_privilege('authenticated', 'public.media_capacity_state', 'SELECT') then
    raise exception 'capacity tables must not be directly accessible';
  end if;
  if not pg_catalog.has_function_privilege(
    'service_role',
    'public.reserve_media_capacity(text,text,bigint,numeric)',
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'anon',
    'public.reserve_media_capacity(text,text,bigint,numeric)',
    'EXECUTE'
  ) then
    raise exception 'reserve RPC must be service-role only';
  end if;
end;
$$;

insert into public.media_capacity_state (
  project_ref, quota_bytes, used_bytes, usage_measured_at, quota_source
) values (
  'capacity-test-project', 1000, 0, clock_timestamp(), 'test-authoritative-fixture'
);

select dblink_connect('capacity_a', 'dbname=' || current_database());
select dblink_connect('capacity_b', 'dbname=' || current_database());
select dblink_exec('capacity_a', 'set role service_role');
select dblink_exec('capacity_b', 'set role service_role');

select dblink_send_query(
  'capacity_a',
  $$select public.reserve_media_capacity(
      'capacity-test-project', 'concurrent:a', 450, 20
    )::text$$
);
select dblink_send_query(
  'capacity_b',
  $$select public.reserve_media_capacity(
      'capacity-test-project', 'concurrent:b', 450, 20
    )::text$$
);

create temporary table capacity_results(payload jsonb not null);
insert into capacity_results(payload)
select payload::jsonb
from dblink_get_result('capacity_a') as result(payload text);
insert into capacity_results(payload)
select payload::jsonb
from dblink_get_result('capacity_b') as result(payload text);

do $$
declare
  active_bytes bigint;
begin
  if (select count(*) from capacity_results where payload->>'status' = 'reserved') <> 1
    or (select count(*) from capacity_results where payload->>'status' = 'insufficient') <> 1 then
    raise exception 'concurrent reservations must atomically admit exactly one writer: %',
      (select jsonb_agg(payload) from capacity_results);
  end if;
  select coalesce(sum(reserved_bytes), 0)
    into active_bytes
    from public.media_capacity_reservations
   where project_ref = 'capacity-test-project' and status = 'active';
  if active_bytes <> 450 then
    raise exception 'active reservations exceeded the atomic headroom gate: %', active_bytes;
  end if;
end;
$$;

select dblink_disconnect('capacity_a');
select dblink_disconnect('capacity_b');

set role service_role;
do $$
declare
  missing jsonb;
begin
  missing := public.reserve_media_capacity('missing-project', 'missing:test', 1, 20);
  if missing->>'status' <> 'unavailable' then
    raise exception 'missing capacity state must fail closed: %', missing;
  end if;
end;
$$;
reset role;

set role service_role;
do $$
declare
  first_reservation jsonb;
  retried jsonb;
begin
  first_reservation := public.reserve_media_capacity('capacity-test-project', 'retry:released', 10, 20);
  if first_reservation->>'status' <> 'reserved' then
    raise exception 'retry fixture reservation failed: %', first_reservation;
  end if;
  perform public.release_media_capacity_reservation(
    'capacity-test-project',
    (first_reservation->>'reservationId')::uuid
  );
  retried := public.reserve_media_capacity('capacity-test-project', 'retry:released', 10, 20);
  if retried->>'status' <> 'reserved' then
    raise exception 'released reservation key must be safely reusable: %', retried;
  end if;
end;
$$;
reset role;

select 'media capacity PostgreSQL checks passed';
