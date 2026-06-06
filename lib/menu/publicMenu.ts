import "server-only";

import {
  getString,
  readSupabaseRows
} from "@/lib/analytics/serverRows";
import { getDemoRestaurantId } from "@/lib/analytics/insights";
import { getAllDishes, getRestaurant } from "@/lib/demoMenuData";
import { slugifyRestaurantSlug } from "@/lib/owner/menuUrlCore";
import {
  buildSupabasePublicMenu,
  getPublicMenuRowSlug,
  type PublicMenu
} from "@/lib/menu/publicMenuCore";

export type { PublicMenu, PublicMenuDish } from "@/lib/menu/publicMenuCore";

function demoMenu(slug: string): PublicMenu {
  const restaurant = getRestaurant();
  const dishes = getAllDishes();
  return {
    restaurantId: getDemoRestaurantId(),
    slug,
    name: restaurant.name,
    location: restaurant.location,
    cuisineType: restaurant.cuisineType,
    source: "demo",
    dishes: dishes.slice(0, 60).map((dish, index) => ({
      id: dish.slug || `demo-${index}`,
      slug: dish.slug || `demo-${index}`,
      name: dish.name,
      description: dish.description ?? "",
      category: dish.categorySlug ?? "Carte",
      priceLabel: dish.price ? String(dish.price) : "",
      imageUrl: dish.image ?? "",
      thumbnailUrl: dish.image ?? "",
      hasPhoto: Boolean(dish.image),
      photoStatus: dish.image ? "ready" : "missing",
      has3d: Boolean(
        dish.model3dUrl || dish.webModel3dUrl || dish.arModel3dUrl
      ),
      hasAr: Boolean(dish.arModel3dUrl || dish.usdzUrl || dish.arUsdzUrl),
      hasIosAr: Boolean(dish.usdzUrl || dish.arUsdzUrl),
      hasAndroidAr: Boolean(dish.arModel3dUrl),
      model3dUrl: dish.model3dUrl ?? "",
      webModel3dUrl: dish.webModel3dUrl ?? dish.model3dUrl ?? "",
      arModel3dUrl: dish.arModel3dUrl ?? "",
      usdzUrl: dish.usdzUrl ?? "",
      arUsdzUrl: dish.arUsdzUrl ?? dish.usdzUrl ?? "",
      posterUrl: dish.image ?? "",
      modelStatus:
        dish.model3dUrl ||
        dish.webModel3dUrl ||
        dish.arModel3dUrl ||
        dish.usdzUrl ||
        dish.arUsdzUrl
          ? "ready"
          : "missing",
      hasImmersive: Boolean(
        dish.model3dUrl ||
          dish.webModel3dUrl ||
          dish.arModel3dUrl ||
          dish.usdzUrl ||
          dish.arUsdzUrl
      ),
      available: dish.isAvailable,
      ingredients: dish.ingredients,
      allergens: dish.allergens,
      options: dish.options,
      houseNote: dish.chefRecommendation,
      tags: [
        dish.isSignature ? "Signature" : "",
        dish.isRecommended ? "Recommandé" : "",
        dish.isAvailable ? "" : "Indisponible"
      ].filter(Boolean)
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

  const match = restaurantsResult.rows.find((row) => getPublicMenuRowSlug(row) === slug);
  if (!match) return null;

  const restaurantId = getString(match, ["id", "restaurant_id"], "");
  if (restaurantId === getDemoRestaurantId()) {
    return demoMenu(slug);
  }

  const dishesResult = await readSupabaseRows("menu_dishes", 1_000);
  return buildSupabasePublicMenu(
    slug,
    match,
    dishesResult.ok ? dishesResult.rows : []
  );
}
