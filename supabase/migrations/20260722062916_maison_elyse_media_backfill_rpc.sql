-- Atomic, service-role-only media mutation for the Maison Élyse backfill.
-- The expected snapshot and the media-only patch are checked while the row is
-- locked, so the same function is safe for both apply and conditional rollback.

create or replace function public.owner_apply_maison_elyse_media(
  p_restaurant_id uuid,
  p_dish_id uuid,
  p_expected_image_url text,
  p_expected_has_immersive_view boolean,
  p_expected_metadata jsonb,
  p_image_url text,
  p_has_immersive_view boolean,
  p_metadata jsonb
)
returns table(
  result_status text,
  restaurant_id uuid,
  dish_id uuid,
  image_url text,
  has_immersive_view boolean,
  metadata jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current public.menu_dishes%rowtype;
  v_maison_elyse_id constant uuid := '11111111-1111-1111-1111-111111111111';
begin
  if p_expected_metadata is null
     or jsonb_typeof(p_expected_metadata) <> 'object'
     or p_metadata is null
     or jsonb_typeof(p_metadata) <> 'object'
     or p_expected_has_immersive_view is null
     or p_has_immersive_view is null then
    raise exception using
      errcode = '22023',
      message = 'Maison Élyse media RPC accepts only complete media snapshots.';
  end if;

  if p_restaurant_id is distinct from v_maison_elyse_id then
    raise exception using
      errcode = '22023',
      message = 'Maison Élyse media RPC refuses a restaurant outside the allowlist.';
  end if;

  if p_dish_id is null
     or p_dish_id <> all (array[
       'fd64dc12-8bd2-4669-be63-51cf0d50b839'::uuid,
       '84226092-1b25-4174-a635-50e2b8319580'::uuid,
       'bc161964-424c-4397-aaa9-9ca79ec60bb3'::uuid,
       'ae796d1c-f385-4029-a483-3a25a607a120'::uuid,
       '30453578-103d-4dca-bb05-27baf46eda3e'::uuid,
       'cb536464-6630-4747-b62c-7db3f31931ab'::uuid,
       'f3340d44-b5ce-4aa8-b0bc-b2c27a0b3ef9'::uuid,
       '0a4dd209-945e-4e3a-9790-7f98442e1cda'::uuid,
       '27e388dc-971d-48c4-9340-a4a70cef0998'::uuid,
       '6069ca61-abcf-4c55-b389-f175f8203cea'::uuid,
       '0be53f33-605f-4692-b00b-cf86239f1f2d'::uuid,
       '0d2f6006-1ada-4813-9ff9-ea0912833f1b'::uuid
     ]) then
    raise exception using
      errcode = '22023',
      message = 'Maison Élyse media RPC refuses a dish outside the allowlist.';
  end if;

  select dish.*
    into v_current
    from public.menu_dishes as dish
   where dish.restaurant_id = p_restaurant_id
     and dish.id = p_dish_id
   for update;

  if not found then
    return query
      select
        'not_found'::text,
        p_restaurant_id,
        p_dish_id,
        null::text,
        null::boolean,
        null::jsonb;
    return;
  end if;

  if v_current.image_url is distinct from p_expected_image_url
     or v_current.has_immersive_view is distinct from p_expected_has_immersive_view
     or v_current.metadata is distinct from p_expected_metadata then
    return query
      select
        'conflict'::text,
        v_current.restaurant_id,
        v_current.id,
        v_current.image_url,
        v_current.has_immersive_view,
        v_current.metadata;
    return;
  end if;

  return query
    update public.menu_dishes as dish
       set image_url = p_image_url,
           has_immersive_view = p_has_immersive_view,
           metadata = p_metadata
     where dish.restaurant_id = p_restaurant_id
       and dish.id = p_dish_id
    returning
      'updated'::text,
      dish.restaurant_id,
      dish.id,
      dish.image_url,
      dish.has_immersive_view,
      dish.metadata;
end;
$$;

revoke all on function public.owner_apply_maison_elyse_media(
  uuid, uuid, text, boolean, jsonb, text, boolean, jsonb
) from public, anon, authenticated;
grant execute on function public.owner_apply_maison_elyse_media(
  uuid, uuid, text, boolean, jsonb, text, boolean, jsonb
) to service_role;
