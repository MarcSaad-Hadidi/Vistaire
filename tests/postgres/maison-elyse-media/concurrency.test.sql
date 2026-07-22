\set ON_ERROR_STOP on

set role service_role;
update public.menu_dishes
   set image_url = null,
       has_immersive_view = false,
       metadata = '{}'::jsonb
 where id = '84226092-1b25-4174-a635-50e2b8319580'::uuid;

begin;
select qr_test.assert_true(
  (select result_status from public.owner_apply_maison_elyse_media(
    '11111111-1111-1111-1111-111111111111'::uuid,
    '84226092-1b25-4174-a635-50e2b8319580'::uuid,
    null, false, '{}'::jsonb, 'https://media.example/first.jpg', true, '{"winner":1}'::jsonb
  )) = 'updated',
  'first transaction must update the media row'
);

-- The harness client is postgres, so dblink can open the second local session
-- without a password; the query itself still executes under service_role.
set role postgres;
select dblink_connect('maison_elyse_concurrent', 'dbname=' || current_database());
select dblink_exec('maison_elyse_concurrent', 'set role service_role');
select dblink_send_query(
  'maison_elyse_concurrent',
  $$select result_status
      from public.owner_apply_maison_elyse_media(
        '11111111-1111-1111-1111-111111111111'::uuid,
        '84226092-1b25-4174-a635-50e2b8319580'::uuid,
        null, false, '{}'::jsonb,
        'https://media.example/second.jpg', true, '{"winner":2}'::jsonb
      )$$
);
select pg_sleep(0.25);
select qr_test.assert_true(
  dblink_is_busy('maison_elyse_concurrent') = 1,
  'second connection must wait while FOR UPDATE is held'
);
commit;

select qr_test.assert_true(
  result_status = 'conflict',
  'second connection must observe the committed first media patch'
)
from dblink_get_result('maison_elyse_concurrent') as result(result_status text);
select dblink_disconnect('maison_elyse_concurrent');

reset role;
