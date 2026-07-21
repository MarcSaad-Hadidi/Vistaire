create table qr_test.concurrent_results (
  phase text not null,
  worker integer not null,
  payload jsonb not null
);

do $$
declare
  v_worker integer;
  v_name text;
  v_id uuid;
  v_query text;
  v_payload text;
  v_previous_id uuid;
begin
  begin
    for v_worker in 1..20 loop
      v_name := pg_catalog.format('create_%s', pg_catalog.lpad(v_worker::text, 2, '0'));
      perform public.dblink_connect(
        v_name,
        'dbname=postgres user=postgres password=postgres host=127.0.0.1'
      );
      v_id := ('50000000-0000-4000-8000-' || pg_catalog.lpad(v_worker::text, 12, '0'))::uuid;
      v_query := pg_catalog.format(
        $query$select pg_catalog.row_to_json(result)::text
          from public.owner_get_or_create_canonical_qr(
            %L::uuid, %L::uuid, %L, 'admin', 'concurrent', '/admin',
            %L, %L, %L, %L, 'v1', '{}'::jsonb
          ) as result$query$,
        v_id,
        '10000000-0000-4000-8000-000000000002',
        'Concurrent ' || v_worker,
        'concurrent-hash-' || v_worker,
        'conc-' || v_worker,
        'cipher-' || v_worker,
        'nonce-' || v_worker
      );
      perform public.dblink_send_query(v_name, v_query);
    end loop;

    for v_worker in 1..20 loop
      v_name := pg_catalog.format('create_%s', pg_catalog.lpad(v_worker::text, 2, '0'));
      select result.payload into v_payload
      from public.dblink_get_result(v_name) as result(payload text);
      insert into qr_test.concurrent_results values ('create', v_worker, v_payload::jsonb);
      perform public.dblink_disconnect(v_name);
    end loop;

    select qr.id into v_previous_id
    from public.qr_codes as qr
    where qr.restaurant_id = '10000000-0000-4000-8000-000000000002'
      and qr.target_kind = 'admin' and qr.purpose_key = 'concurrent'
      and qr.is_canonical;

    for v_worker in 1..2 loop
      v_name := pg_catalog.format('rotate_%s', pg_catalog.lpad(v_worker::text, 2, '0'));
      perform public.dblink_connect(
        v_name,
        'dbname=postgres user=postgres password=postgres host=127.0.0.1'
      );
      v_query := pg_catalog.format(
        $query$select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(result) order by result.result_status)::text
          from public.owner_rotate_canonical_qr(
            %L::uuid, '51000000-0000-4000-8000-000000000001'::uuid,
            '10000000-0000-4000-8000-000000000002'::uuid,
            'admin', 'concurrent', 'Concurrent rotated', '/admin',
            'concurrent-rotated-hash', 'rotated', 'cipher-rotated',
            'nonce-rotated', 'v1', '{}'::jsonb, true, 'pause',
            '52000000-0000-4000-8000-000000000001'::uuid, 1
          ) as result$query$,
        v_previous_id
      );
      perform public.dblink_send_query(v_name, v_query);
    end loop;

    for v_worker in 1..2 loop
      v_name := pg_catalog.format('rotate_%s', pg_catalog.lpad(v_worker::text, 2, '0'));
      select result.payload into v_payload
      from public.dblink_get_result(v_name) as result(payload text);
      insert into qr_test.concurrent_results values ('rotate', v_worker, v_payload::jsonb);
      perform public.dblink_disconnect(v_name);
    end loop;
  exception when others then
    for v_worker in 1..20 loop
      v_name := pg_catalog.format('create_%s', pg_catalog.lpad(v_worker::text, 2, '0'));
      if v_name = any(public.dblink_get_connections()) then
        perform public.dblink_disconnect(v_name);
      end if;
    end loop;
    for v_worker in 1..2 loop
      v_name := pg_catalog.format('rotate_%s', pg_catalog.lpad(v_worker::text, 2, '0'));
      if v_name = any(public.dblink_get_connections()) then
        perform public.dblink_disconnect(v_name);
      end if;
    end loop;
    raise;
  end;
end;
$$;

select qr_test.assert_true(
  (select count(*) = 20 from qr_test.concurrent_results where phase = 'create')
  and (select count(*) = 1 from qr_test.concurrent_results
       where phase = 'create' and (payload ->> 'created')::boolean)
  and (select count(distinct payload ->> 'id') = 1
       from qr_test.concurrent_results where phase = 'create')
  and (select count(*) = 1 from public.qr_codes
       where restaurant_id = '10000000-0000-4000-8000-000000000002'
         and target_kind = 'admin' and purpose_key = 'concurrent'),
  '20 simultaneous creations must elect exactly one canonical row'
);

select qr_test.assert_true(
  (select count(*) = 2 from qr_test.concurrent_results where phase = 'rotate')
  and (select count(*) = 1 from public.qr_codes
       where id = '51000000-0000-4000-8000-000000000001')
  and (select count(*) = 1 from public.qr_code_lifecycle_events
       where operation_id = '52000000-0000-4000-8000-000000000001')
  and (select previous_status = 'active' and new_status = 'paused'
         and previous_config_version = 1 and new_config_version = 2
       from public.qr_code_lifecycle_events
       where operation_id = '52000000-0000-4000-8000-000000000001')
  and (select status = 'paused' and not is_canonical from public.qr_codes
       where purpose_key = 'concurrent'
         and id <> '51000000-0000-4000-8000-000000000001')
  and (select status = 'active' and is_canonical
         and supersedes_qr_code_id is not null
       from public.qr_codes where id = '51000000-0000-4000-8000-000000000001'),
  'two simultaneous identical rotations must commit one paused predecessor and one successor'
);
