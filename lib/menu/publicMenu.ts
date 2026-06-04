import "server-only";

import {
  getNumber,
  getString,
  readSupabaseRows,
  type AnyRow
} from "@/lib/analytics/serverRows";
import { getDemoRestaurantId } from "@/lib/analytics/insights";
import { getAllDishes, getRestaurant } from "@/lib/demoMenuData";
import { slugifyRestaurantSlug } from "@/lib/owner/menuUrlCore";

export type PublicMenuDish = {
  id: string;
  name: string;
  description: string;
  category: string;
  priceLabel: string;
  hasPhoto: boolean;
  hasImmersive: boolean;
};

export type PublicMenu = {
  slug: string;
  name: string;
  location: string;
  cuisineType: string;
  source: "supabase" | "demo";
  dishes: PublicMenuDish[];
};

function rowSlug(row: AnyRow): string {
  const name = getString(row, ["name", "restaurant_name"], "");
  return getString(row, ["slug", "restaurant_slug"], slugifyRestaurantSlug(name));
}

function formatPrice(row: AnyRow): string {
  const value = getNumber(row, ["price", "amount", "price_cad"], 0);
  if (!value) return "";
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD"
  }).format(value);
}

function mapDishRow(row: AnyRow, index: number): PublicMenuDish {
  return {
    id: getString(row, ["id", "dish_id", "slug", "dish_slug"], `dish-${index}`),
    name: getString(row, ["name", "dish_name", "title"], "Plat"),
    description: getString(row, ["description", "desc", "summary"], ""),
    category: getString(
      row,
      ["category_name", "categoryName", "category", "category_slug"],
      "Carte"
    ),
    priceLabel: formatPrice(row),
    hasPhoto: Boolean(
      getString(row, [
        "image",
        "image_url",
        "imageUrl",
        "photo_url",
        "photoUrl",
        "thumbnail_url"
      ])
    ),
    hasImmersive: Boolean(
      getString(row, [
        "model3d_url",
        "model3dUrl",
        "web_model_3d_url",
        "ar_model_3d_url",
        "usdz_url"
      ])
    )
  };
}

function demoMenu(slug: string): PublicMenu {
  const restaurant = getRestaurant();
  const dishes = getAllDishes();
  return {
    slug,
    name: restaurant.name,
    location: restaurant.location,
    cuisineType: restaurant.cuisineType,
    source: "demo",
    dishes: dishes.slice(0, 60).map((dish, index) => ({
      id: dish.slug || `demo-${index}`,
      name: dish.name,
      description: dish.description ?? "",
      category: dish.categorySlug ?? "Carte",
      priceLabel: dish.price ? String(dish.price) : "",
      hasPhoto: Boolean(dish.image),
      hasImmersive: Boolean(
        dish.model3dUrl ||
          dish.webModel3dUrl ||
          dish.arModel3dUrl ||
          dish.usdzUrl ||
          dish.arUsdzUrl
      )
    }))
  };
}

export async function getPublicMenuBySlug(
  rawSlug: string
): Promise<PublicMenu | null> {
  const slug = slugifyRestaurantSlug(rawSlug);
  if (!slug) return null;

  if (slug === "maison-elyse") {
    return demoMenu(slug);
  }

  const restaurantsResult = await readSupabaseRows("restaurants", 200);
  if (!restaurantsResult.ok || restaurantsResult.rows.length === 0) {
    return null;
  }

  const match = restaurantsResult.rows.find((row) => rowSlug(row) === slug);
  if (!match) return null;

  const restaurantId = getString(match, ["id", "restaurant_id"], "");
  if (restaurantId === getDemoRestaurantId()) {
    return demoMenu(slug);
  }

  const dishesResult = await readSupabaseRows("menu_dishes", 1_000);
  const dishRows = dishesResult.ok
    ? dishesResult.rows.filter((row) =>
        ["restaurant_id", "restaurantId", "restaurant_uuid", "restaurant"].some(
          (key) => String(row[key] ?? "") === restaurantId
        ) ||
        ["restaurant_slug", "restaurantSlug"].some(
          (key) => String(row[key] ?? "") === slug
        )
      )
    : [];

  return {
    slug,
    name: getString(match, ["name", "restaurant_name"], "Restaurant"),
    location: getString(match, ["location", "city", "address"], ""),
    cuisineType: getString(match, ["cuisine_type", "cuisineType"], ""),
    source: "supabase",
    dishes: dishRows.slice(0, 200).map(mapDishRow)
  };
}
