-- Dedicated EMPTY test database only; runner injects the exact migration body.
-- Cron is deliberately not stubbed. Its missing prerequisite is tested using
-- the full migration in a separate connection; actual scheduling is untested.
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
-- Populate the pre-migration schema: rollout must not restart retention clocks.
insert into public.analytics_events(session_id,event_name,created_at) values
  ('legacy-expired','menu_opened',now()-interval '100 days'),
  ('legacy-recent','menu_opened',now()-interval '10 days');
-- TELEMETRY_MIGRATION_BODY
do $$ begin
  assert not exists (
    select 1 from public.analytics_events
    where session_id in ('legacy-expired','legacy-recent')
      and expires_at <> created_at + interval '90 days'
  ), 'migration restarted legacy retention clocks';
  assert exists (select 1 from public.analytics_events where session_id='legacy-expired' and expires_at < now()), 'old legacy row received new retention life';
  assert exists (select 1 from public.analytics_events where session_id='legacy-recent' and expires_at > now()), 'recent legacy row expired prematurely';
end $$;
insert into public.analytics_events(session_id,event_name,schema_version,event_id,sequence,environment,search_query,user_agent,viewport)
values ('session-test','menu_opened',2,'44444444-4444-4444-8444-444444444444',1,'preview','private','raw','{}');
do $$ declare row public.analytics_events; begin
  select * into row from public.analytics_events where session_id='session-test';
  assert row.search_query is null and row.user_agent is null and row.viewport is null, 'raw private data retained';
  assert row.environment='preview', 'environment changed';
  assert row.expires_at > now()+interval '89 days' and row.expires_at <= now()+interval '90 days', 'retention bound missing';
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
  assert not has_function_privilege('authenticated','public.purge_expired_menu_telemetry()','EXECUTE'), 'authenticated may purge';
  assert not has_function_privilege('anon','public.purge_expired_menu_telemetry()','EXECUTE'), 'anon may purge';
end $$;
insert into public.analytics_events(session_id,event_name) select 'session-rate','menu_opened' from generate_series(1,120);
do $$ begin
  begin
    insert into public.analytics_events(session_id,event_name) values ('session-rate','menu_opened');
    raise exception 'session rate cap was bypassed';
  exception when program_limit_exceeded then null; end;
end $$;
update public.analytics_events set expires_at=now()-interval '1 second' where session_id='session-test';
select public.purge_expired_menu_telemetry();
do $$ begin
  assert not exists(select 1 from public.analytics_events where session_id='session-test'), 'expired event retained';
  assert not exists(select 1 from public.analytics_events where session_id='legacy-expired'), 'expired legacy row retained after purge';
  assert exists(select 1 from public.analytics_events where session_id='legacy-recent'), 'unexpired legacy row deleted';
  assert (select count(*) from public.analytics_events where session_id='session-rate')=120, 'unexpired events deleted';
end $$;
rollback;
