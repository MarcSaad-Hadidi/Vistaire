create or replace function public.set_admin_dish_availability(
  p_qr_id uuid,
  p_restaurant_id uuid,
  p_dish_id uuid,
  p_available boolean
)
returns table (
  dish_id uuid,
  dish_slug text,
  is_available boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qr_id uuid;
  v_menu_id uuid;
  v_current_available boolean;
begin
  select qr.id
  into v_qr_id
    from public.qr_codes as qr
    where qr.id = p_qr_id
      and qr.restaurant_id = p_restaurant_id
      and qr.status = 'active'
      and qr.target_kind = 'admin'
      and qr.target_path = '/admin'
    for update;

  if v_qr_id is null then
    return;
  end if;

  select menu.id
  into v_menu_id
  from public.menus as menu
  where menu.restaurant_id = p_restaurant_id
    and (
      menu.status = 'published'
      or (menu.status = 'draft' and menu.is_primary is true)
    )
  order by
    case
      when menu.status = 'published' and menu.is_primary is true then 0
      when menu.status = 'published' then 1
      when menu.status = 'draft' and menu.is_primary is true then 2
      else 3
    end,
    menu.updated_at desc,
    menu.id asc
  limit 1;

  if v_menu_id is null then
    return;
  end if;

  select dish.is_available
  into v_current_available
  from public.menu_dishes as dish
  where dish.id = p_dish_id
    and dish.restaurant_id = p_restaurant_id
    and dish.menu_id = v_menu_id
  for update;

  if not found then
    return;
  end if;

  if v_current_available is distinct from p_available then
    return query
    update public.menu_dishes as dish
    set is_available = p_available,
        updated_at = now()
    where dish.id = p_dish_id
      and dish.restaurant_id = p_restaurant_id
      and dish.menu_id = v_menu_id
    returning dish.id, dish.slug, dish.is_available, dish.updated_at;
  else
    return query
    select dish.id, dish.slug, dish.is_available, dish.updated_at
    from public.menu_dishes as dish
    where dish.id = p_dish_id
      and dish.restaurant_id = p_restaurant_id
      and dish.menu_id = v_menu_id;
  end if;
end;
$$;

revoke execute on function public.set_admin_dish_availability(uuid, uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.set_admin_dish_availability(uuid, uuid, uuid, boolean)
  to service_role;
