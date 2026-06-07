import "server-only";

import { getDemoRestaurantId } from "@/lib/analytics/insights";
import { getRestaurant } from "@/lib/demoMenuData";
import {
  buildSupabasePublicMenu,
  getPublicMenuRowSlug,
  getVisiblePublicMenuCategories,
  type PublicMenu,
  type PublicMenuCategory,
  type PublicMenuRow
} from "@/lib/menu/publicMenuCore";
import { getPublicMenuBySlug } from "@/lib/menu/publicMenu";
import { getString, readSupabaseRows } from "@/lib/analytics/serverRows";
import { slugifyRestaurantSlug } from "@/lib/owner/menuUrlCore";

type OwnerMenuDataSuccess = {
  ok: true;
  restaurant: {
    id: string;
    name: string;
    slug: string;
    publicMenuPath: string;
  };
  menu: PublicMenu;
  categories: PublicMenuCategory[];
  dishes: PublicMenu["dishes"];
  source: "supabase" | "fallback";
  note: string;
};

type OwnerMenuDataFailure = {
  ok: false;
  status: number;
  error: string;
};

function publicMenuPath(slug: string): string {
  return slug ? `/menu/${encodeURIComponent(slug)}` : "/demo";
}

async function fallbackMenu(): Promise<OwnerMenuDataSuccess> {
  const restaurant = getRestaurant();
  const menu = await getPublicMenuBySlug("maison-elyse");
  const fallback = menu ?? {
    restaurantId: getDemoRestaurantId(),
    slug: restaurant.slug,
    name: restaurant.name,
    location: restaurant.location,
    cuisineType: restaurant.cuisineType,
    source: "demo" as const,
    dishes: []
  };

  return {
    ok: true,
    restaurant: {
      id: getDemoRestaurantId(),
      name: restaurant.name,
      slug: restaurant.slug,
      publicMenuPath: "/demo"
    },
    menu: fallback,
    categories: getVisiblePublicMenuCategories(fallback.dishes),
    dishes: fallback.dishes,
    source: "fallback",
    note: "Donnees de demonstration affichees tant que Supabase ne repond pas."
  };
}

export async function getOwnerMenuData(
  restaurantId: string
): Promise<OwnerMenuDataSuccess | OwnerMenuDataFailure> {
  if (!restaurantId.trim()) {
    return { ok: false, status: 400, error: "restaurantId requis." };
  }

  const [restaurantsResult, dishesResult] = await Promise.all([
    readSupabaseRows<PublicMenuRow>("restaurants", 300),
    readSupabaseRows<PublicMenuRow>("menu_dishes", 1_000)
  ]);

  if (!restaurantsResult.ok || restaurantsResult.rows.length === 0) {
    return fallbackMenu();
  }

  const restaurantRow = restaurantsResult.rows.find((row) => {
    const id = getString(row, ["id", "restaurant_id"], "");
    return id === restaurantId;
  });

  if (!restaurantRow) {
    return { ok: false, status: 404, error: "Restaurant introuvable." };
  }

  const slug =
    getPublicMenuRowSlug(restaurantRow) ||
    slugifyRestaurantSlug(getString(restaurantRow, ["name", "restaurant_name"]));
  const menu = buildSupabasePublicMenu(
    slug,
    restaurantRow,
    dishesResult.ok ? dishesResult.rows : []
  );

  return {
    ok: true,
    restaurant: {
      id: menu.restaurantId,
      name: menu.name,
      slug: menu.slug,
      publicMenuPath: publicMenuPath(menu.slug)
    },
    menu,
    categories: getVisiblePublicMenuCategories(menu.dishes),
    dishes: menu.dishes,
    source: "supabase",
    note: dishesResult.ok
      ? "Plats charges depuis Supabase."
      : "Restaurant charge depuis Supabase; plats indisponibles pour le moment."
  };
}

