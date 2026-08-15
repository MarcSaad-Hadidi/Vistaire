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

update public.media_capacity_state
   set usage_measured_at = clock_timestamp() - interval '16 minutes'
 where project_ref = 'capacity-test-project';
set role service_role;
do $$
declare
  stale jsonb;
begin
  stale := public.reserve_media_capacity('capacity-test-project', 'measurement:stale', 1, 20);
  if stale->>'status' <> 'unavailable' then
    raise exception 'stale usage measurement must fail closed: %', stale;
  end if;
end;
$$;
reset role;

update public.media_capacity_state
   set usage_measured_at = clock_timestamp() + interval '1 minute'
 where project_ref = 'capacity-test-project';
set role service_role;
do $$
declare
  future jsonb;
begin
  future := public.reserve_media_capacity('capacity-test-project', 'measurement:future', 1, 20);
  if future->>'status' <> 'unavailable' then
    raise exception 'future usage measurement must fail closed: %', future;
  end if;
end;
$$;
reset role;

update public.media_capacity_state
   set usage_measured_at = clock_timestamp()
 where project_ref = 'capacity-test-project';

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

update public.media_capacity_reservations
   set status = 'released', settled_at = clock_timestamp()
 where project_ref = 'capacity-test-project' and status = 'active';

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
  perform public.release_media_capacity_reservation(
    'capacity-test-project',
    (retried->>'reservationId')::uuid
  );
end;
$$;
reset role;

select dblink_connect('same_key_a', 'dbname=' || current_database());
select dblink_connect('same_key_b', 'dbname=' || current_database());
select dblink_exec('same_key_a', 'set role service_role');
select dblink_exec('same_key_b', 'set role service_role');
select dblink_send_query(
  'same_key_a',
  $$select public.reserve_media_capacity(
      'capacity-test-project', 'same-key:concurrent', 25, 20
    )::text$$
);
select dblink_send_query(
  'same_key_b',
  $$select public.reserve_media_capacity(
      'capacity-test-project', 'same-key:concurrent', 25, 20
    )::text$$
);

create temporary table same_key_results(payload jsonb not null);
insert into same_key_results(payload)
select payload::jsonb from dblink_get_result('same_key_a') as result(payload text);
insert into same_key_results(payload)
select payload::jsonb from dblink_get_result('same_key_b') as result(payload text);

do $$
begin
  if (select count(*) from same_key_results where payload->>'status' = 'reserved') <> 1
    or (select count(*) from same_key_results where payload->>'reason' = 'reservation-key-active') <> 1 then
    raise exception 'same-key callers must never share a live reservation: %',
      (select jsonb_agg(payload) from same_key_results);
  end if;
end;
$$;

select dblink_disconnect('same_key_a');
select dblink_disconnect('same_key_b');

set role service_role;
do $$
declare
  first_reservation jsonb;
  retried jsonb;
  finalized jsonb;
begin
  select payload into first_reservation
    from same_key_results where payload->>'status' = 'reserved';
  finalized := public.finalize_media_capacity_reservation(
    'capacity-test-project',
    (first_reservation->>'reservationId')::uuid,
    25
  );
  if finalized->>'status' <> 'finalized' then
    raise exception 'same-key fixture must finalize: %', finalized;
  end if;
  retried := public.reserve_media_capacity(
    'capacity-test-project', 'same-key:concurrent', 25, 20
  );
  if retried->>'status' <> 'reserved'
    or retried->>'reservationId' = first_reservation->>'reservationId' then
    raise exception 'a finalized logical key must create a fresh reservation: %', retried;
  end if;
  perform public.release_media_capacity_reservation(
    'capacity-test-project', (retried->>'reservationId')::uuid
  );
end;
$$;
reset role;

do $$
declare
  overdue jsonb;
  capacity jsonb;
  renewed jsonb;
  finalized_once jsonb;
  finalized_retry jsonb;
  used_before bigint;
begin
  overdue := public.reserve_media_capacity(
    'capacity-test-project', 'expiry:retained', 40, 20
  );
  if overdue->>'status' <> 'reserved' then
    raise exception 'expiry fixture reservation failed: %', overdue;
  end if;
  update public.media_capacity_reservations
     set created_at = clock_timestamp() - interval '10 minutes',
         expires_at = clock_timestamp() - interval '1 minute'
   where id = (overdue->>'reservationId')::uuid;
  capacity := public.get_media_capacity_state('capacity-test-project');
  if (capacity->>'activeReservedBytes')::bigint < 40 then
    raise exception 'overdue reservations must remain counted: %', capacity;
  end if;
  renewed := public.renew_media_capacity_reservation(
    'capacity-test-project', (overdue->>'reservationId')::uuid
  );
  if renewed->>'status' <> 'renewed'
    or (renewed->>'expiresAt')::timestamptz <= clock_timestamp() then
    raise exception 'overdue live reservation must renew: %', renewed;
  end if;
  select used_bytes into used_before
    from public.media_capacity_state where project_ref = 'capacity-test-project';
  finalized_once := public.finalize_media_capacity_reservation(
    'capacity-test-project', (overdue->>'reservationId')::uuid, 17
  );
  finalized_retry := public.finalize_media_capacity_reservation(
    'capacity-test-project', (overdue->>'reservationId')::uuid, 17
  );
  if finalized_once->>'status' <> 'finalized'
    or finalized_retry->>'status' <> 'finalized'
    or (select used_bytes from public.media_capacity_state where project_ref = 'capacity-test-project') <> used_before + 17 then
    raise exception 'ambiguous finalize retry must settle retained bytes exactly once: %, %', finalized_once, finalized_retry;
  end if;
end;
$$;

select 'media capacity PostgreSQL checks passed';
