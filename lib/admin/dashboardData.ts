import "server-only";

import {
  buildRelationalSupabasePublicMenu,
  type PublicMenuDish
} from "@/lib/menu/publicMenuCore";
import {
  getNumber,
  getString,
  readSupabaseRowsByColumn,
  type AnyRow
} from "@/lib/analytics/serverRows";
import { getRestaurantInsights } from "@/lib/analytics/insights";
import {
  buildAdminAnalyticsState,
  type AdminAnalyticsState
} from "@/lib/admin/analyticsState";
import {
  buildAdminMenuReadiness,
  selectAdminDashboardMenu,
  type AdminMenuCategory,
  type AdminMenuDish,
  type AdminMenuReadiness
} from "@/lib/admin/menuReadiness";
import type { DemoAdminInsights } from "@/lib/demoAdminInsights";

export type AdminDashboardData = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    menuPath: string | null;
  };
  categories: AdminMenuCategory[];
  dishes: AdminMenuDish[];
  readiness: AdminMenuReadiness;
  analytics: AdminAnalyticsState<DemoAdminInsights>;
  dataStatus: "real" | "partial" | "empty";
};

export type AdminDashboardLoadResult =
  | { ok: true; data: AdminDashboardData }
  | {
      ok: false;
      reason:
        | "restaurant-lookup-failed"
        | "restaurant-not-found"
        | "menu-lookup-failed";
    };

type AdminDashboardReadDependencies = {
  readRows: typeof readSupabaseRowsByColumn;
  readInsights: typeof getRestaurantInsights;
};

function toAdminDish(dish: PublicMenuDish): AdminMenuDish {
  return {
    id: dish.id,
    slug: dish.slug,
    name: dish.name,
    category: dish.category,
    ...(dish.categorySlug ? { categorySlug: dish.categorySlug } : {}),
    description: dish.description,
    priceLabel: dish.priceLabel,
    priceCents: dish.priceCents,
    imageUrl: dish.imageUrl,
    thumbnailUrl: dish.thumbnailUrl,
    hasPhoto: dish.hasPhoto,
    photoStatus: dish.photoStatus,
    hasImmersive: dish.hasImmersive,
    has3d: dish.has3d,
    hasAr: dish.hasAr,
    available: dish.available
  };
}

function toAdminCategory(row: AnyRow, index: number): AdminMenuCategory {
  const label = getString(row, ["name", "label", "category_name"], "Carte");
  return {
    id: getString(row, ["id", "category_id"], `category-${index + 1}`),
    label,
    slug: getString(row, ["slug", "category_slug"], `categorie-${index + 1}`)
  };
}

export async function loadAdminDashboardData(
  restaurantId: string
): Promise<AdminDashboardLoadResult> {
  return loadAdminDashboardDataWithDependencies(restaurantId, {
    readRows: readSupabaseRowsByColumn,
    readInsights: getRestaurantInsights
  });
}

export async function loadAdminDashboardDataWithDependencies(
  restaurantId: string,
  dependencies: AdminDashboardReadDependencies
): Promise<AdminDashboardLoadResult> {
  const {
    readRows: readSupabaseRowsByColumn,
    readInsights: getRestaurantInsights
  } = dependencies;
  const restaurantResult = await readSupabaseRowsByColumn(
    "restaurants",
    "id",
    restaurantId,
    1
  );
  if (!restaurantResult.ok) {
    return { ok: false, reason: "restaurant-lookup-failed" };
  }
  const restaurantRow = restaurantResult.rows[0] ?? null;
  if (!restaurantRow) {
    return { ok: false, reason: "restaurant-not-found" };
  }

  const menuResult = await readSupabaseRowsByColumn(
    "menus",
    "restaurant_id",
    restaurantId,
    100
  );
  if (!menuResult.ok) {
    return { ok: false, reason: "menu-lookup-failed" };
  }

  const [categoryResult, dishResult] = await Promise.all([
    readSupabaseRowsByColumn(
      "menu_categories",
      "restaurant_id",
      restaurantId,
      250
    ),
    readSupabaseRowsByColumn(
      "menu_dishes",
      "restaurant_id",
      restaurantId,
      500
    )
  ]);
  const selectedMenu = selectAdminDashboardMenu(menuResult.rows);
  const insightsResult = await getRestaurantInsights(
    restaurantId,
    selectedMenu?.id
  );
  const categoryRows = selectedMenu
    ? (categoryResult.ok ? categoryResult.rows : []).filter(
        (row) => getString(row, ["menu_id"], "") === selectedMenu.id
      )
    : [];
  const dishRows = selectedMenu
    ? (dishResult.ok ? dishResult.rows : []).filter(
        (row) => getString(row, ["menu_id"], "") === selectedMenu.id
      )
    : [];
  const menu = buildRelationalSupabasePublicMenu({
    slug: getString(restaurantRow, ["slug"], ""),
    restaurantRow,
    categoryRows,
    dishRows,
    includeUnavailableDishes: true
  });
  const categories = categoryRows
    .map((row, index) => ({
      row,
      index,
      order: getNumber(row, ["display_order", "sort_order", "order"], index)
    }))
    .sort((left, right) => left.order - right.order || left.index - right.index)
    .map(({ row, index }) => toAdminCategory(row, index));
  const dishes = menu.dishes.map(toAdminDish);
  const successfulReads = [categoryResult, dishResult].filter((result) => result.ok)
    .length;
  const dataStatus =
    successfulReads === 2
      ? dishes.length > 0
        ? "real"
        : "empty"
      : "partial";

  return {
    ok: true,
    data: {
      restaurant: {
        id: restaurantId,
        name: getString(restaurantRow, ["name"], "Restaurant"),
        slug: menu.slug,
        menuPath: menu.slug ? `/menu/${menu.slug}` : null
      },
      categories,
      dishes,
      readiness: buildAdminMenuReadiness(categories, dishes),
      analytics: buildAdminAnalyticsState(insightsResult),
      dataStatus
    }
  };
}
