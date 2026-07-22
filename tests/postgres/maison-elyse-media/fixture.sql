set role service_role;

delete from public.restaurants
 where id = '11111111-1111-1111-1111-111111111111'::uuid;

insert into public.restaurants (id, name, slug, status)
values (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'Maison Élyse',
  'maison-elyse',
  'active'
);

insert into public.menus (id, restaurant_id, name, slug, status, is_primary)
values (
  '11111111-1111-1111-1111-111111111112'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  'Maison Élyse',
  'maison-elyse',
  'published',
  true
);

insert into public.menu_categories (id, restaurant_id, menu_id, name, slug)
values (
  '11111111-1111-1111-1111-111111111113'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  '11111111-1111-1111-1111-111111111112'::uuid,
  'Menu',
  'menu'
);

insert into public.menu_dishes (
  id, restaurant_id, menu_id, category_id, slug, name, description,
  price_cents, is_available, image_url, has_immersive_view, metadata
)
values
  ('fd64dc12-8bd2-4669-be63-51cf0d50b839', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111113', 'ravioles-romarin', 'Ravioles', 'Business description 1', 1200, true, null, false, '{}'::jsonb),
  ('84226092-1b25-4174-a635-50e2b8319580', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111113', 'tartare-saumon', 'Tartare', 'Business description 2', 1300, true, null, false, '{}'::jsonb),
  ('bc161964-424c-4397-aaa9-9ca79ec60bb3', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111113', 'homard-bisque', 'Homard', 'Business description 3', 1400, true, null, false, '{}'::jsonb),
  ('ae796d1c-f385-4029-a483-3a25a607a120', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111113', 'canette-aux-figues', 'Canette', 'Business description 4', 1500, true, null, false, '{}'::jsonb),
  ('30453578-103d-4dca-bb05-27baf46eda3e', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111113', 'risotto-cepe', 'Risotto', 'Business description 5', 1600, true, null, false, '{}'::jsonb),
  ('cb536464-6630-4747-b62c-7db3f31931ab', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111113', 'bar-ligne', 'Bar', 'Business description 6', 1700, true, null, false, '{}'::jsonb),
  ('f3340d44-b5ce-4aa8-b0bc-b2c27a0b3ef9', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111113', 'pave-boeuf', 'Boeuf', 'Business description 7', 1800, true, null, false, '{}'::jsonb),
  ('0a4dd209-945e-4e3a-9790-7f98442e1cda', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111113', 'souffle-chocolat', 'Soufflé', 'Business description 8', 1900, true, null, false, '{}'::jsonb),
  ('27e388dc-971d-48c4-9340-a4a70cef0998', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111113', 'tarte-citron-basilic', 'Tarte', 'Business description 9', 2000, true, null, false, '{}'::jsonb),
  ('6069ca61-abcf-4c55-b389-f175f8203cea', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111113', 'cocktail-maison-elyse', 'Cocktail', 'Business description 10', 2100, true, null, false, '{}'::jsonb),
  ('0be53f33-605f-4692-b00b-cf86239f1f2d', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111113', 'negroni-fut', 'Negroni', 'Business description 11', 2200, true, null, false, '{}'::jsonb),
  ('0d2f6006-1ada-4813-9ff9-ea0912833f1b', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111113', 'mocktail-bergamote', 'Mocktail', 'Business description 12', 2300, true, null, false, '{}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111113', 'outside-allowlist', 'Outside', 'Must never mutate', 9999, true, null, false, '{}'::jsonb);

reset role;
