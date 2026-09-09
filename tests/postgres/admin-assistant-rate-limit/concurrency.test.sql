delete from public.admin_assistant_rate_limits
 where restaurant_id = '20000000-0000-0000-0000-000000000201';

begin;
set local role service_role;
select result.*
  from generate_series(1, 9) as attempt
  cross join lateral public.consume_admin_assistant_quota(
    '20000000-0000-0000-0000-000000000201', 10 + (attempt * 0), 60
  ) as result;
reset role;

select dblink_connect('assistant_quota_concurrent', 'dbname=' || current_database());
select dblink_exec('assistant_quota_concurrent', 'set role service_role');
select dblink_send_query(
  'assistant_quota_concurrent',
  $$select allowed, remaining
      from public.consume_admin_assistant_quota(
        '20000000-0000-0000-0000-000000000201', 10, 60
      )$$
);
select pg_sleep(0.2);

do $$
begin
  if dblink_is_busy('assistant_quota_concurrent') <> 1 then
    raise exception 'concurrent quota call did not wait on the atomic bucket row';
  end if;
end;
$$;
commit;

do $$
declare
  v_allowed boolean;
  v_remaining integer;
begin
  select allowed, remaining into v_allowed, v_remaining
    from dblink_get_result('assistant_quota_concurrent') as result(allowed boolean, remaining integer);
  if not v_allowed or v_remaining <> 0 then
    raise exception 'tenth concurrent request was not admitted exactly once';
  end if;
end;
$$;

select dblink_send_query(
  'assistant_quota_concurrent',
  $$select allowed, remaining
      from public.consume_admin_assistant_quota(
        '20000000-0000-0000-0000-000000000201', 10, 60
      )$$
);

do $$
declare
  v_allowed boolean;
  v_remaining integer;
begin
  select allowed, remaining into v_allowed, v_remaining
    from dblink_get_result('assistant_quota_concurrent') as result(allowed boolean, remaining integer);
  if v_allowed or v_remaining <> 0 then
    raise exception 'request beyond the limit was admitted';
  end if;
end;
$$;

do $$
begin
  if (select request_count from public.admin_assistant_rate_limits
       where restaurant_id = '20000000-0000-0000-0000-000000000201') <> 10 then
    raise exception 'atomic quota counter exceeded its limit';
  end if;
end;
$$;

select dblink_disconnect('assistant_quota_concurrent');
