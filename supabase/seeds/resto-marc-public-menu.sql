-- Resto Marc public menu pilot seed.
-- Apply manually after choosing the correct Vistaire Supabase project.
-- Verification query: select id, name, slug from public.restaurants where slug = 'resto-marc';

create extension if not exists "pgcrypto";

create table if not exists public.menu_dishes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  restaurant_slug text not null,
  name text not null,
  description text not null default '',
  category_name text not null default 'Carte',
  price numeric(10, 2) not null default 0,
  available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.menu_dishes
  add column if not exists restaurant_id uuid references public.restaurants(id) on delete cascade,
  add column if not exists restaurant_slug text not null default '',
  add column if not exists name text not null default '',
  add column if not exists description text not null default '',
  add column if not exists category_name text not null default 'Carte',
  add column if not exists price numeric(10, 2) not null default 0,
  add column if not exists available boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists menu_dishes_restaurant_id_idx
  on public.menu_dishes (restaurant_id);

create index if not exists menu_dishes_restaurant_slug_idx
  on public.menu_dishes (restaurant_slug);

alter table public.menu_dishes enable row level security;
revoke all on table public.menu_dishes from anon, authenticated;
grant select, insert, update, delete on table public.menu_dishes to service_role;

with resto as (
  insert into public.restaurants (
    name,
    slug,
    location,
    cuisine_type,
    status,
    public_menu_url
  )
  values (
    'Resto Marc',
    'resto-marc',
    'Montréal',
    'Cuisine maison fraîche',
    'active',
    '/menu/resto-marc'
  )
  on conflict (slug) do update
    set
      name = excluded.name,
      location = excluded.location,
      cuisine_type = excluded.cuisine_type,
      status = excluded.status,
      public_menu_url = excluded.public_menu_url,
      updated_at = now()
  returning id
),
removed as (
  delete from public.menu_dishes
  where restaurant_slug = 'resto-marc'
    and name in (
      'Salade fraîche maison',
      'Soupe du jour',
      'Bol de riz au poulet et légumes',
      'Sandwich poulet grillé',
      'Pâtes sauce maison',
      'Gâteau au chocolat',
      'Coupe de fruits frais',
      'Limonade maison',
      'Thé glacé'
    )
  returning 1
)
insert into public.menu_dishes (
  restaurant_id,
  restaurant_slug,
  name,
  description,
  category_name,
  price,
  available,
  sort_order
)
select
  resto.id,
  'resto-marc',
  dish.name,
  dish.description,
  dish.category_name,
  dish.price,
  true,
  dish.sort_order
from resto
cross join (
  values
    (
      'Salade fraîche maison',
      'Légumes croquants, vinaigrette légère et herbes fraîches.',
      'Entrées',
      8.99,
      10
    ),
    (
      'Soupe du jour',
      'Soupe maison préparée avec les ingrédients du moment.',
      'Entrées',
      7.49,
      20
    ),
    (
      'Bol de riz au poulet et légumes',
      'Riz chaud servi avec morceaux de poulet grillé, légumes sautés, sauce maison légère et garniture fraîche.',
      'Plats',
      17.99,
      30
    ),
    (
      'Sandwich poulet grillé',
      'Pain moelleux, poulet grillé, légumes frais et sauce maison.',
      'Plats',
      14.99,
      40
    ),
    (
      'Pâtes sauce maison',
      'Pâtes servies avec une sauce tomate maison, herbes et parmesan.',
      'Plats',
      15.99,
      50
    ),
    (
      'Gâteau au chocolat',
      'Gâteau moelleux au chocolat, servi en portion généreuse.',
      'Desserts',
      6.99,
      60
    ),
    (
      'Coupe de fruits frais',
      'Mélange de fruits frais coupés, léger et rafraîchissant.',
      'Desserts',
      5.99,
      70
    ),
    (
      'Limonade maison',
      'Limonade fraîche, citronnée et légèrement sucrée.',
      'Boissons',
      4.49,
      80
    ),
    (
      'Thé glacé',
      'Thé glacé maison servi bien frais.',
      'Boissons',
      4.49,
      90
    )
) as dish(name, description, category_name, price, sort_order);
