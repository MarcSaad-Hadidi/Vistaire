begin;

-- Deployment precondition: retention must actually be scheduled. This migration
-- is intentionally fail-closed on projects without pg_cron; enable it through
-- the approved database deployment process before applying. No app fallback.
do $$ begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'menu telemetry v2 requires pg_cron for bounded 90-day retention';
  end if;
end $$;

alter table public.analytics_events
  add column schema_version smallint not null default 1 check (schema_version in (1,2)),
  add column event_id uuid,
  add column sequence integer check (sequence between 1 and 3600),
  add column environment text not null default 'legacy' check (environment in ('legacy','production','preview','development')),
  add column expires_at timestamptz not null default (now() + interval '90 days');
-- Existing events keep their original retention clock; the migration must not
-- grant historical data another 90 days. The scheduled job performs deletion.
update public.analytics_events
set expires_at = created_at + interval '90 days';
alter table public.analytics_events add constraint analytics_events_v2_identity_check check (schema_version <> 2 or (event_id is not null and sequence is not null));
create unique index analytics_events_event_id_unique on public.analytics_events(event_id) where event_id is not null;
create index analytics_events_expiry_idx on public.analytics_events(expires_at);
create index analytics_events_session_created_idx on public.analytics_events(session_id, created_at);
alter table public.analytics_events drop constraint analytics_events_event_name_check;
alter table public.analytics_events add constraint analytics_events_event_name_check check (event_name in (
 'session_started','session_duration','menu_opened','category_viewed','dish_opened','dish_3d_clicked','dish_ar_clicked','search_used','filter_used','cta_clicked','dashboard_demo_opened',
 'menu_list_viewed','dish_selected','dish_visible','dish_dwell','search_results','search_result_selected','model_load_started','model_load_succeeded','model_load_failed','model_interacted','model_active_duration','ar_outcome','locale_changed'
));

-- Serialize same-session writes so concurrent requests cannot evade the cap.
create function public.guard_menu_telemetry_v2() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.session_id, 0));
  if (select count(*) from public.analytics_events where session_id = new.session_id and created_at > now() - interval '1 minute') >= 120 then
    raise exception 'analytics session rate limit exceeded' using errcode = '54000';
  end if;
  new.expires_at := now() + interval '90 days';
  new.search_query := null;
  new.user_agent := null;
  new.viewport := null;
  return new;
end $$;
create trigger analytics_events_v2_guard before insert on public.analytics_events
for each row execute function public.guard_menu_telemetry_v2();

create function public.purge_expired_menu_telemetry() returns void
language sql security definer set search_path = '' as $$
  delete from public.analytics_events where expires_at < now();
$$;
revoke all on function public.purge_expired_menu_telemetry() from public, anon, authenticated;
grant execute on function public.purge_expired_menu_telemetry() to service_role;
select cron.schedule('vistaire-menu-telemetry-retention', '17 * * * *', 'select public.purge_expired_menu_telemetry()');

comment on column public.analytics_events.environment is 'Server assigned deployment environment. Legacy rows have unknown environment and must not be relabeled as production.';
comment on column public.analytics_events.expires_at is 'Raw telemetry expires after 90 days; hourly cron purge gives a maximum 90 days plus one hour retention.';
commit;
