import "server-only";

import {
  getBoolean,
  getString,
  readSupabaseRows
} from "@/lib/analytics/serverRows";
import { getDemoRestaurantId } from "@/lib/analytics/insights";
import {
  getAllDishes,
  getCategoryBySlug,
  getRestaurant
} from "@/lib/demoMenuData";
import { DEFAULT_LOCALE, normalizeLocale, type Locale } from "@/lib/i18n";
import { slugifyRestaurantSlug } from "@/lib/owner/menuUrlCore";
import {
  buildRelationalSupabasePublicMenu,
  buildSupabasePublicMenu,
  getPublicMenuRowSlug,
  normalizeGoogleReviewConfig,
  type PublicMenu,
  type PublicMenuRow
} from "@/lib/menu/publicMenuCore";

export type { PublicMenu, PublicMenuDish } from "@/lib/menu/publicMenuCore";

function demoMenu(slug: string, locale: Locale = "fr"): PublicMenu {
  const restaurant = getRestaurant(locale);
  const dishes = getAllDishes(locale);
  const recommendedTag = locale === "en" ? "Recommended" : "Recommandé";
  const unavailableTag = locale === "en" ? "Unavailable" : "Indisponible";

  return {
    restaurantId: getDemoRestaurantId(),
    slug,
    name: restaurant.name,
    location: restaurant.location,
    cuisineType: restaurant.cuisineType,
    googleReview: normalizeGoogleReviewConfig(restaurant.googleReview),
    source: "demo",
    dishes: dishes.slice(0, 60).map((dish, index) => ({
      id: dish.slug || `demo-${index}`,
      slug: dish.slug || `demo-${index}`,
      name: dish.name,
      description: dish.description ?? "",
      category:
        getCategoryBySlug(dish.categorySlug ?? "", locale)?.name ??
        (locale === "en" ? "Menu" : "Carte"),
      priceLabel: dish.price ? `$${dish.price}` : "",
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
        dish.isRecommended ? recommendedTag : "",
        dish.isAvailable ? "" : unavailableTag
      ].filter(Boolean)
    }))
  };
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

export async function getPublicMenuBySlug(
  rawSlug: string,
  locale: Locale | string = DEFAULT_LOCALE
): Promise<PublicMenu | null> {
  const slug = slugifyRestaurantSlug(rawSlug);
  const resolvedLocale = normalizeLocale(locale);
  if (!slug) return null;

  if (slug === "maison-elyse") {
    return demoMenu(slug, resolvedLocale);
  }

  const restaurantsResult = await readSupabaseRows("restaurants", 200);
  if (!restaurantsResult.ok || restaurantsResult.rows.length === 0) {
    return null;
  }

  const match = restaurantsResult.rows.find((row) => getPublicMenuRowSlug(row) === slug);
  if (!match) return null;

  const restaurantId = getString(match, ["id", "restaurant_id"], "");
  if (restaurantId === getDemoRestaurantId()) {
    return demoMenu(slug, resolvedLocale);
  }

  const [menusResult, categoriesResult, dishesResult] = await Promise.all([
    readSupabaseRows<PublicMenuRow>("menus", 500),
    readSupabaseRows<PublicMenuRow>("menu_categories", 1_000),
    readSupabaseRows<PublicMenuRow>("menu_dishes", 1_000)
  ]);
  const primaryMenu = menusResult.ok ? findPrimaryMenu(menusResult.rows, restaurantId) : null;

  if (primaryMenu) {
    return buildRelationalSupabasePublicMenu({
      slug,
      restaurantRow: match,
      menuRow: primaryMenu,
      categoryRows: categoriesResult.ok ? categoriesResult.rows : [],
      dishRows: dishesResult.ok ? dishesResult.rows : []
    });
  }

  return buildSupabasePublicMenu(
    slug,
    match,
    dishesResult.ok ? dishesResult.rows : []
  );
}
