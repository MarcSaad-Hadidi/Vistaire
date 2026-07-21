\set ON_ERROR_STOP on

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

create extension if not exists dblink;

-- Plain PostgreSQL does not include Supabase Storage. This minimal fixture-only
-- contract lets the real runtime-hardening migration seed its bucket metadata.
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null unique,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create schema if not exists qr_test;

create or replace function qr_test.assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_condition is distinct from true then
    raise exception 'assertion failed: %', p_message;
  end if;
end;
$$;

create or replace function qr_test.assert_raises(
  p_sql text,
  p_expected_state text,
  p_message text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_expected_state then
      return;
    end if;
    raise exception 'assertion failed: %, expected SQLSTATE %, got % (%)',
      p_message, p_expected_state, sqlstate, sqlerrm;
  end;
  raise exception 'assertion failed: %, expected SQLSTATE % but statement succeeded',
    p_message, p_expected_state;
end;
$$;

select qr_test.assert_true(
  pg_catalog.current_setting('server_version_num')::integer between 170000 and 179999,
  'suite requires PostgreSQL 17'
);
