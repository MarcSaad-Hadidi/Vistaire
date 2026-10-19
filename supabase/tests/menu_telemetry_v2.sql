-- Dedicated EMPTY test database only; runner injects the exact migration body.
-- The complete migration runs here, with only its outer transaction removed.
begin;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create table public.analytics_events (
  id uuid primary key default gen_random_uuid(), session_id text not null,
  event_name text not null constraint analytics_events_event_name_check check(event_name in ('menu_opened')),
  created_at timestamptz not null default now(), search_query text, user_agent text, viewport jsonb
);
-- Populate old history before rollout; both rows must survive unchanged.
insert into public.analytics_events(session_id,event_name,created_at) values
  ('legacy-old','menu_opened',now()-interval '100 days'),
  ('legacy-recent','menu_opened',now()-interval '10 days');
-- TELEMETRY_MIGRATION_BODY
do $$ begin
  assert exists (select 1 from public.analytics_events where session_id='legacy-old' and created_at=now()-interval '100 days' and environment='legacy'), 'old history changed or deleted';
  assert exists (select 1 from public.analytics_events where session_id='legacy-recent' and created_at=now()-interval '10 days' and environment='legacy'), 'recent history changed or deleted';
  assert not exists (select 1 from information_schema.columns where table_schema='public' and table_name='analytics_events' and column_name='expires_at'), 'unexpected expiry column';
  assert to_regprocedure('public.purge_expired_menu_telemetry()') is null, 'unexpected telemetry purge function';
end $$;
insert into public.analytics_events(session_id,event_name,schema_version,event_id,sequence,environment,search_query,user_agent,viewport)
values ('session-test','menu_opened',2,'44444444-4444-4444-8444-444444444444',1,'preview','private','raw','{}');
do $$ declare row public.analytics_events; begin
  select * into row from public.analytics_events where session_id='session-test';
  assert row.search_query is null and row.user_agent is null and row.viewport is null, 'raw private data retained';
  assert row.environment='preview', 'environment changed';
  begin
    insert into public.analytics_events(session_id,event_name,schema_version,event_id,sequence) values ('session-test','menu_opened',2,'44444444-4444-4444-8444-444444444444',1);
    raise exception 'duplicate event was accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.analytics_events(session_id,event_name,schema_version) values ('bad','menu_opened',2);
    raise exception 'v2 missing identity was accepted';
  exception when check_violation then null; end;
  begin
    insert into public.analytics_events(session_id,event_name,schema_version,event_id,sequence) values ('bad','menu_opened',2,gen_random_uuid(),3601);
    raise exception 'unbounded sequence was accepted';
  exception when check_violation then null; end;
end $$;
insert into public.analytics_events(session_id,event_name) select 'session-rate','menu_opened' from generate_series(1,120);
do $$ begin
  begin
    insert into public.analytics_events(session_id,event_name) values ('session-rate','menu_opened');
    raise exception 'session rate cap was bypassed';
  exception when program_limit_exceeded then null; end;
end $$;
do $$ begin
  assert exists(select 1 from public.analytics_events where session_id='session-test'), 'new event deleted';
  assert exists(select 1 from public.analytics_events where session_id='legacy-old' and created_at=now()-interval '100 days'), 'old history deleted or changed';
  assert exists(select 1 from public.analytics_events where session_id='legacy-recent' and created_at=now()-interval '10 days'), 'recent history deleted or changed';
  assert (select count(*) from public.analytics_events where session_id='session-rate')=120, 'accepted events deleted';
  assert (select count(*) from public.analytics_events)=123, 'historical or accepted rows lost';
  assert to_regprocedure('public.purge_expired_menu_telemetry()') is null, 'unexpected telemetry purge function';
end $$;
rollback;
