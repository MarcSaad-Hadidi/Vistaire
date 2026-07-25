-- Persist the business order of dishes without relying on UUID ordering.
-- Existing rows keep their legacy read order at 0 until an owner explicitly
-- assigns an order. Public reads use id as a stable secondary key for those
-- rows, so the migration does not need to invent a business order.
alter table public.menu_dishes
  add column if not exists display_order integer not null default 0;

-- The metadata fallback lets this migration recover order written by a newer
-- owner flow before the column reached an older environment. Metadata is
-- arbitrary legacy JSON, so the integer cast is deliberately bounded first.
with safe_metadata_orders as (
  select
    dish.id,
    case
      when candidate.value ~ '^[1-9][0-9]*$' and length(candidate.value) <= 10 then
        case
          when candidate.value::numeric <= 2147483647 then candidate.value::integer
          else null
        end
      else null
    end as display_order
  from public.menu_dishes as dish
  cross join lateral (values (dish.metadata ->> 'displayOrder')) as candidate(value)
  where dish.display_order = 0
    and jsonb_typeof(dish.metadata) = 'object'
)
update public.menu_dishes as dish
set display_order = safe.display_order
from safe_metadata_orders as safe
where dish.id = safe.id
  and safe.display_order is not null;

create index if not exists menu_dishes_menu_category_display_order_idx
  on public.menu_dishes (menu_id, category_id, display_order);
