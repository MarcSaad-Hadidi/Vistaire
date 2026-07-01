import "server-only";

import { getDemoRestaurantId } from "@/lib/analytics/insights";
import { getRestaurant } from "@/lib/demoMenuData";
import {
  buildRelationalSupabasePublicMenu,
  buildSupabasePublicMenu,
  getPublicMenuRowSlug,
  getVisiblePublicMenuCategories,
  type PublicMenu,
  type PublicMenuCategory,
  type PublicMenuRow
} from "@/lib/menu/publicMenuCore";
import {
  DEFAULT_PUBLIC_MENU_SETTINGS,
  serializePublicMenuSettings
} from "@/lib/menu/publicMenuSettings";
import { getPublicMenuBySlug } from "@/lib/menu/publicMenu";
import { getBoolean, getString, readSupabaseRows } from "@/lib/analytics/serverRows";
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

function findPrimaryMenu(
  rows: PublicMenuRow[],
  restaurantId: string
): PublicMenuRow | null {
  const scoped = rows.filter((row) => getString(row, ["restaurant_id", "restaurantId"], "") === restaurantId);
  const published = scoped.filter((row) => getString(row, ["status"], "") !== "archived");
  return (
    published.find((row) => getBoolean(row, ["is_primary", "isPrimary"], false) && getString(row, ["status"], "") === "published") ??
    published.find((row) => getBoolean(row, ["is_primary", "isPrimary"], false)) ??
    published.find((row) => getString(row, ["slug"], "") === "principal") ??
    published[0] ??
    null
  );
}

function relationalCategories(args: {
  categoryRows: PublicMenuRow[];
  menuId: string;
  restaurantId: string;
  dishes: PublicMenu["dishes"];
}): PublicMenuCategory[] {
  const dishCountByCategoryId = new Map<string, number>();
  const dishCountByCategoryLabel = new Map<string, number>();
  for (const dish of args.dishes) {
    if (dish.categoryId) {
      dishCountByCategoryId.set(
        dish.categoryId,
        (dishCountByCategoryId.get(dish.categoryId) ?? 0) + 1
      );
    }
    dishCountByCategoryLabel.set(
      dish.category,
      (dishCountByCategoryLabel.get(dish.category) ?? 0) + 1
    );
  }

  return args.categoryRows
    .filter((row) => getString(row, ["restaurant_id", "restaurantId"], "") === args.restaurantId)
    .filter((row) => getString(row, ["menu_id", "menuId"], "") === args.menuId)
    .map((row, index) => {
      const id = getString(row, ["id", "category_id"], "");
      const label = getString(row, ["name", "label"], "Categorie");
      return {
        id: id || slugifyRestaurantSlug(label) || `category-${index + 1}`,
        label,
        description: getString(row, ["description"], ""),
        tone: "green" as const,
        count:
          (id ? dishCountByCategoryId.get(id) : undefined) ??
          dishCountByCategoryLabel.get(label) ??
          0
      };
    });
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
    googleReview: {
      enabled: false,
      googleReviewUrl: ""
    },
    settings: serializePublicMenuSettings(DEFAULT_PUBLIC_MENU_SETTINGS),
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

  const [restaurantsResult, menusResult, categoriesResult, dishesResult] = await Promise.all([
    readSupabaseRows<PublicMenuRow>("restaurants", 300),
    readSupabaseRows<PublicMenuRow>("menus", 500),
    readSupabaseRows<PublicMenuRow>("menu_categories", 1_000),
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
  const primaryMenu = menusResult.ok ? findPrimaryMenu(menusResult.rows, restaurantId) : null;
  const menu = primaryMenu
    ? buildRelationalSupabasePublicMenu({
        slug,
        restaurantRow,
        menuRow: primaryMenu,
        categoryRows: categoriesResult.ok ? categoriesResult.rows : [],
        dishRows: dishesResult.ok ? dishesResult.rows : []
      })
    : buildSupabasePublicMenu(
        slug,
        restaurantRow,
        dishesResult.ok ? dishesResult.rows : []
      );
  const menuId = primaryMenu ? getString(primaryMenu, ["id", "menu_id"], "") : "";
  const categories =
    primaryMenu && categoriesResult.ok
      ? relationalCategories({
          categoryRows: categoriesResult.rows,
          menuId,
          restaurantId,
          dishes: menu.dishes
        })
      : getVisiblePublicMenuCategories(menu.dishes);

  return {
    ok: true,
    restaurant: {
      id: menu.restaurantId,
      name: menu.name,
      slug: menu.slug,
      publicMenuPath: publicMenuPath(menu.slug)
    },
    menu,
    categories,
    dishes: menu.dishes,
    source: "supabase",
    note: dishesResult.ok
      ? "Plats charges depuis Supabase."
      : "Restaurant charge depuis Supabase; plats indisponibles pour le moment."
  };
}

