\set ON_ERROR_STOP on

select qr_test.assert_true(
  p.prosecdef
  and p.proconfig @> array['search_path=public, pg_temp'],
  'Maison Elyse RPC must be SECURITY DEFINER with a fixed search_path'
)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'owner_apply_maison_elyse_media';

select qr_test.assert_true(
  has_function_privilege(
    'service_role',
    'public.owner_apply_maison_elyse_media(uuid,uuid,text,boolean,jsonb,text,boolean,jsonb)',
    'execute'
  ),
  'service_role must execute the Maison Elyse RPC'
);
select qr_test.assert_true(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral unnest(coalesce(p.proacl, '{}'::aclitem[])) as acl
    where n.nspname = 'public'
      and p.proname = 'owner_apply_maison_elyse_media'
      and split_part(acl::text, '=', 1) = ''
      and split_part(split_part(acl::text, '=', 2), '/', 1) ~ 'X'
  ),
  'PUBLIC must not execute the Maison Elyse RPC'
);
select qr_test.assert_true(
  not has_function_privilege(
    'anon',
    'public.owner_apply_maison_elyse_media(uuid,uuid,text,boolean,jsonb,text,boolean,jsonb)',
    'execute'
  ),
  'anon must not execute the Maison Elyse RPC'
);
select qr_test.assert_true(
  not has_function_privilege(
    'authenticated',
    'public.owner_apply_maison_elyse_media(uuid,uuid,text,boolean,jsonb,text,boolean,jsonb)',
    'execute'
  ),
  'authenticated must not execute the Maison Elyse RPC'
);

select qr_test.assert_true(
  pg_get_functiondef(
    'public.owner_apply_maison_elyse_media(uuid,uuid,text,boolean,jsonb,text,boolean,jsonb)'::regprocedure
  ) !~* '\\m(price_cents|name|description|is_available|is_signature|is_recommended|allergens)\\M',
  'Maison Elyse RPC must not mutate business columns'
);

select qr_test.assert_raises(
  $$select * from public.owner_apply_maison_elyse_media(
    '22222222-2222-2222-2222-222222222222'::uuid,
    '84226092-1b25-4174-a635-50e2b8319580'::uuid,
    null, false, '{}'::jsonb, 'x', true, '{}'::jsonb
  )$$,
  '22023',
  'wrong restaurant must be refused'
);

select qr_test.assert_raises(
  $$select * from public.owner_apply_maison_elyse_media(
    '11111111-1111-1111-1111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid,
    null, false, '{}'::jsonb, 'x', true, '{}'::jsonb
  )$$,
  '22023',
  'dish outside the allowlist must be refused'
);
