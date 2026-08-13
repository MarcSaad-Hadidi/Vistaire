import "server-only";

import { cache } from "react";

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
import { MENU_PROJECTIONS } from "@/lib/menu/menuSchemaProjections";
import { getPublicMenuBySlug } from "@/lib/menu/publicMenu";
import { readSupabaseRowsByFilters } from "@/lib/analytics/serverRows";
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

const OWNER_RESTAURANT_COLUMNS =
  "id,name,slug,location,cuisine_type,status,contact_name,contact_email,contact_phone,notes,public_menu_url,qr_ready,qr_generated_at,created_at,updated_at";
const OWNER_DISH_COLUMNS =
  "id,restaurant_id,menu_id,category_id,slug,name,short_description,description,price_cents,currency,image_url,is_available,is_signature,is_recommended,has_immersive_view,allergens,allergen_declarations,metadata,created_at,updated_at,display_order";
const OWNER_UI_CONFIG_COLUMNS =
  "id,restaurant_id,theme,config_json,status,created_at,updated_at";
const OWNER_RESTAURANT_COLUMNS_FALLBACK =
  "id,name,slug,location,cuisine_type,status,contact_name,contact_email,contact_phone,notes,public_menu_url,qr_ready,qr_generated_at,created_at,updated_at";
const OWNER_DISH_COLUMNS_FALLBACK =
  "id,restaurant_id,menu_id,category_id,slug,name,short_description,description,price_cents,currency,image_url,is_available,is_signature,is_recommended,has_immersive_view,allergens,metadata,created_at,updated_at";

async function getOwnerMenuDataUncached(
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
    readSupabaseRowsByFilters<PublicMenuRow>({
      table: "restaurants",
      columns: OWNER_RESTAURANT_COLUMNS,
      filters: { id: restaurantId },
      orderBy: "id",
      limit: 1,
      fallbackColumns: OWNER_RESTAURANT_COLUMNS_FALLBACK
    }),
    readSupabaseRowsByFilters<PublicMenuRow>({
      table: "menus",
      columns: MENU_PROJECTIONS.menus,
      filters: { restaurant_id: restaurantId },
      orderBy: "id",
      limit: 500,
      fallbackColumns: MENU_PROJECTIONS.legacyMenus,
      fallbackOrderBy: "id"
    }),
    readSupabaseRowsByFilters<PublicMenuRow>({
      table: "menu_categories",
      columns: MENU_PROJECTIONS.menuCategories,
      filters: { restaurant_id: restaurantId },
      orderBy: ["display_order", "id"],
      limit: 1_000
    }),
    readSupabaseRowsByFilters<PublicMenuRow>({
      table: "menu_dishes",
      columns: OWNER_DISH_COLUMNS,
      filters: { restaurant_id: restaurantId },
      orderBy: ["display_order", "id"],
      limit: 1_000,
      fallbackColumns: OWNER_DISH_COLUMNS_FALLBACK,
      fallbackOrderBy: "id"
    }),
    readSupabaseRowsByFilters<PublicMenuRow>({
      table: "menu_ui_configs",
      columns: OWNER_UI_CONFIG_COLUMNS,
      filters: { restaurant_id: restaurantId },
      orderBy: "id",
      limit: 1_000
    })
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

export const getOwnerMenuData = cache(getOwnerMenuDataUncached);

