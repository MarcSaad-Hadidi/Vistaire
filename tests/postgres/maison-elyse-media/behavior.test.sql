\set ON_ERROR_STOP on

set role service_role;

update public.menu_dishes
   set image_url = null,
       has_immersive_view = false,
       metadata = '{}'::jsonb,
       price_cents = 1300,
       name = 'Tartare'
 where id = '84226092-1b25-4174-a635-50e2b8319580'::uuid;

-- A business-column mutation made before apply must survive the media-only RPC.
update public.menu_dishes
   set price_cents = 4321,
       name = 'Tartare modifié avant média'
 where id = '84226092-1b25-4174-a635-50e2b8319580'::uuid;

select qr_test.assert_true(
  (select result_status from public.owner_apply_maison_elyse_media(
    '11111111-1111-1111-1111-111111111111'::uuid,
    '84226092-1b25-4174-a635-50e2b8319580'::uuid,
    null, false, '{}'::jsonb,
    'https://media.example/tartare.jpg', true, '{"media":"applied"}'::jsonb
  )) = 'updated',
  'allowlisted media apply must update'
);
select qr_test.assert_true(
  (select price_cents = 4321 and name = 'Tartare modifié avant média'
     from public.menu_dishes
    where id = '84226092-1b25-4174-a635-50e2b8319580'::uuid),
  'business columns must be unchanged after apply'
);

-- The expected patch is a compare-and-swap guard for rollback and replacement.
update public.menu_dishes
   set metadata = '{"owner":"changed-after-apply"}'::jsonb
 where id = '84226092-1b25-4174-a635-50e2b8319580'::uuid;
select qr_test.assert_true(
  (select result_status from public.owner_apply_maison_elyse_media(
    '11111111-1111-1111-1111-111111111111'::uuid,
    '84226092-1b25-4174-a635-50e2b8319580'::uuid,
    'https://media.example/tartare.jpg', true, '{"media":"applied"}'::jsonb,
    null, false, '{}'::jsonb
  )) = 'conflict',
  'rollback must report a media conflict after an owner mutation'
);
select qr_test.assert_true(
  (select price_cents = 4321 and name = 'Tartare modifié avant média'
     from public.menu_dishes
    where id = '84226092-1b25-4174-a635-50e2b8319580'::uuid),
  'business columns must be unchanged after rollback conflict'
);

-- Reset media only, then prove a conditional rollback succeeds.
update public.menu_dishes
   set metadata = '{"media":"applied"}'::jsonb,
       image_url = 'https://media.example/tartare.jpg',
       has_immersive_view = true
 where id = '84226092-1b25-4174-a635-50e2b8319580'::uuid;
select qr_test.assert_true(
  (select result_status from public.owner_apply_maison_elyse_media(
    '11111111-1111-1111-1111-111111111111'::uuid,
    '84226092-1b25-4174-a635-50e2b8319580'::uuid,
    'https://media.example/tartare.jpg', true, '{"media":"applied"}'::jsonb,
    null, false, '{}'::jsonb
  )) = 'updated',
  'conditional rollback must succeed when the exact patch is still present'
);

select qr_test.assert_true(
  (select image_url is null and has_immersive_view = false and metadata = '{}'::jsonb
     from public.menu_dishes
    where id = '84226092-1b25-4174-a635-50e2b8319580'::uuid),
  'rollback must restore the exact media snapshot'
);

-- An allowlisted but absent dish is a structured not_found result.
delete from public.menu_dishes
 where id = '0d2f6006-1ada-4813-9ff9-ea0912833f1b'::uuid;
select qr_test.assert_true(
  (select result_status from public.owner_apply_maison_elyse_media(
    '11111111-1111-1111-1111-111111111111'::uuid,
    '0d2f6006-1ada-4813-9ff9-ea0912833f1b'::uuid,
    null, false, '{}'::jsonb, 'x', true, '{}'::jsonb
  )) = 'not_found',
  'allowlisted absent dish must return not_found'
);

reset role;
