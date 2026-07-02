import {
  buildRelationalSupabasePublicMenu,
  buildSupabasePublicMenu,
  getPublicMenuRowSlug,
  getVisiblePublicMenuCategories,
  type PublicMenu,
  type PublicMenuCategory,
  type PublicMenuRow
} from "../menu/publicMenuCore.ts";
import { publicMenuSettingsFromUiConfigRows } from "./publicMenuSettingsFallback.ts";
import { slugifyRestaurantSlug } from "./menuUrlCore.ts";

export type OwnerMenuDataSuccess = {
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

export type OwnerMenuDataFailure = {
  ok: false;
  status: number;
  error: string;
};

type OwnerMenuDataRowsInput = {
  restaurantId: string;
  restaurantRows: PublicMenuRow[];
  menuRows: PublicMenuRow[];
  categoryRows: PublicMenuRow[];
  dishRows: PublicMenuRow[];
  uiConfigRows?: PublicMenuRow[];
  dishesAvailable?: boolean;
};

function getString(row: PublicMenuRow, candidates: string[], fallback = ""): string {
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function getBoolean(row: PublicMenuRow, candidates: string[], fallback = false): boolean {
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
  }
  return fallback;
}

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

export function buildOwnerMenuDataFromRows(
  args: OwnerMenuDataRowsInput
): OwnerMenuDataSuccess | OwnerMenuDataFailure {
  if (!args.restaurantId.trim()) {
    return { ok: false, status: 400, error: "restaurantId requis." };
  }

  const restaurantRow = args.restaurantRows.find((row) => {
    const id = getString(row, ["id", "restaurant_id"], "");
    return id === args.restaurantId;
  });

  if (!restaurantRow) {
    return { ok: false, status: 404, error: "Restaurant introuvable." };
  }

  const slug =
    getPublicMenuRowSlug(restaurantRow) ||
    slugifyRestaurantSlug(getString(restaurantRow, ["name", "restaurant_name"]));
  const primaryMenu = findPrimaryMenu(args.menuRows, args.restaurantId);
  const legacyPublicMenuSettings = publicMenuSettingsFromUiConfigRows(
    args.uiConfigRows ?? [],
    args.restaurantId
  );
  const menu = primaryMenu
    ? buildRelationalSupabasePublicMenu({
        slug,
        restaurantRow,
        menuRow: primaryMenu,
        categoryRows: args.categoryRows,
        dishRows: args.dishRows,
        includeUnavailableDishes: true,
        legacyPublicMenuSettings
      })
    : buildSupabasePublicMenu(slug, restaurantRow, args.dishRows, {
        includeUnavailableDishes: true,
        legacyPublicMenuSettings
      });
  const menuId = primaryMenu ? getString(primaryMenu, ["id", "menu_id"], "") : "";
  const categories =
    primaryMenu
      ? relationalCategories({
          categoryRows: args.categoryRows,
          menuId,
          restaurantId: args.restaurantId,
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
    note: args.dishesAvailable ?? true
      ? "Plats charges depuis Supabase."
      : "Restaurant charge depuis Supabase; plats indisponibles pour le moment."
  };
}
