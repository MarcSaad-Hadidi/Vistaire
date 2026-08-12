do $$
begin
  if has_table_privilege('anon', 'public.admin_assistant_rate_limits', 'select') or
     has_table_privilege('authenticated', 'public.admin_assistant_rate_limits', 'select') or
     has_table_privilege('service_role', 'public.admin_assistant_rate_limits', 'select') then
    raise exception 'quota table must not be directly readable';
  end if;
  if has_function_privilege('public', 'public.consume_admin_assistant_quota(uuid,integer,integer)', 'execute') or
     has_function_privilege('anon', 'public.consume_admin_assistant_quota(uuid,integer,integer)', 'execute') or
     has_function_privilege('authenticated', 'public.consume_admin_assistant_quota(uuid,integer,integer)', 'execute') then
    raise exception 'quota RPC exposed to an untrusted role';
  end if;
  if not has_function_privilege('service_role', 'public.consume_admin_assistant_quota(uuid,integer,integer)', 'execute') then
    raise exception 'service_role cannot execute quota RPC';
  end if;
  if exists (
    select 1
      from pg_class sequence
      join pg_depend dependency on dependency.objid = sequence.oid
     where sequence.relkind = 'S'
       and dependency.refobjid = 'public.admin_assistant_rate_limits'::regclass
  ) then
    raise exception 'quota table must not own a sequence';
  end if;
end;
$$;
