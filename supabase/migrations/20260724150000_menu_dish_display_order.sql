-- Persist the business order of dishes without relying on UUID ordering.
-- Existing rows keep their legacy read order at 0 until an owner explicitly
-- assigns an order; targeted menus can then be backfilled safely.
alter table public.menu_dishes
  add column if not exists display_order integer not null default 0;

-- The metadata fallback lets this migration recover order written by a newer
-- owner flow before the column reached an older environment.
update public.menu_dishes
set display_order = (metadata ->> 'displayOrder')::integer
where display_order = 0
  and jsonb_typeof(metadata) = 'object'
  and metadata ->> 'displayOrder' ~ '^[1-9][0-9]*$';

create index if not exists menu_dishes_menu_category_display_order_idx
  on public.menu_dishes (menu_id, category_id, display_order);
