import "server-only";

import { getDemoRestaurantId } from "@/lib/analytics/insights";
import { getRestaurant } from "@/lib/demoMenuData";
import {
  getVisiblePublicMenuCategories,
  type PublicMenuRow
} from "@/lib/menu/publicMenuCore";
import {
  DEFAULT_PUBLIC_MENU_SETTINGS,
  serializePublicMenuSettings
} from "@/lib/menu/publicMenuSettings";
import { getPublicMenuBySlug } from "@/lib/menu/publicMenu";
import { readSupabaseRows } from "@/lib/analytics/serverRows";
import {
  buildOwnerMenuDataFromRows,
  type OwnerMenuDataFailure,
  type OwnerMenuDataSuccess
} from "@/lib/owner/menuDataCore";

const OWNER_DEMO_PUBLIC_MENU_SETTINGS = serializePublicMenuSettings({
  ...DEFAULT_PUBLIC_MENU_SETTINGS,
  supportedLocales: ["fr-CA", "en-CA"],
  publicMenuStyle: "maison-elyse"
});

async function fallbackMenu(): Promise<OwnerMenuDataSuccess> {
  const restaurant = getRestaurant();
  const menu = await getPublicMenuBySlug("maison-elyse");
  const fallback = menu ?? {
    restaurantId: getDemoRestaurantId(),
    slug: restaurant.slug,
    name: restaurant.name,
    location: restaurant.location,
    cuisineType: restaurant.cuisineType,
    googleReview: {
      enabled: false,
      googleReviewUrl: ""
    },
    settings: OWNER_DEMO_PUBLIC_MENU_SETTINGS,
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

  const [
    restaurantsResult,
    menusResult,
    categoriesResult,
    dishesResult,
    uiConfigsResult
  ] = await Promise.all([
    readSupabaseRows<PublicMenuRow>("restaurants", 300),
    readSupabaseRows<PublicMenuRow>("menus", 500),
    readSupabaseRows<PublicMenuRow>("menu_categories", 1_000),
    readSupabaseRows<PublicMenuRow>("menu_dishes", 1_000),
    readSupabaseRows<PublicMenuRow>("menu_ui_configs", 1_000)
  ]);

  if (!restaurantsResult.ok || restaurantsResult.rows.length === 0) {
    return fallbackMenu();
  }

  return buildOwnerMenuDataFromRows({
    restaurantId,
    restaurantRows: restaurantsResult.rows,
    menuRows: menusResult.ok ? menusResult.rows : [],
    categoryRows: categoriesResult.ok ? categoriesResult.rows : [],
    dishRows: dishesResult.ok ? dishesResult.rows : [],
    uiConfigRows: uiConfigsResult.ok ? uiConfigsResult.rows : [],
    dishesAvailable: dishesResult.ok
  });
}

