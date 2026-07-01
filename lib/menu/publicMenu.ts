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
import {
  DEFAULT_PUBLIC_MENU_SETTINGS,
  serializePublicMenuSettings
} from "@/lib/menu/publicMenuSettings";

export type { PublicMenu, PublicMenuDish } from "@/lib/menu/publicMenuCore";

const DEMO_PUBLIC_MENU_SETTINGS = serializePublicMenuSettings({
  ...DEFAULT_PUBLIC_MENU_SETTINGS,
  supportedLocales: ["fr-CA", "en-CA"],
  publicMenuStyle: "maison-elyse"
});

function parseDemoPriceCents(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value * 100));
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim().replace(",", "."));
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
  }
  return 0;
}

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
    settings: DEMO_PUBLIC_MENU_SETTINGS,
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
      priceCents: parseDemoPriceCents(dish.price),
      priceCurrency: "CAD",
      baseCurrency: "CAD",
      displayPriceMode: "auto",
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
      webModel3dBytes: 0,
      arModel3dUrl: dish.arModel3dUrl ?? "",
      arModel3dBytes: 0,
      usdzUrl: dish.usdzUrl ?? "",
      arUsdzUrl: dish.arUsdzUrl ?? dish.usdzUrl ?? "",
      arUsdzBytes: 0,
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

function getObject(row: PublicMenuRow, key: string): PublicMenuRow {
  const value = row[key];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as PublicMenuRow;
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as PublicMenuRow;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function findLegacyMenuLanguages(
  rows: PublicMenuRow[],
  restaurantId: string
): unknown {
  const scoped = rows.filter(
    (row) => getString(row, ["restaurant_id", "restaurantId"], "") === restaurantId
  );
  const preferred =
    scoped.find((row) => getString(row, ["status"], "") === "published") ??
    scoped.find((row) => getString(row, ["status"], "") === "draft") ??
    scoped[0];
  if (!preferred) return undefined;
  const configJson = getObject(preferred, "config_json");
  return configJson.menuLanguages ?? configJson.menu_languages;
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

  const [menusResult, categoriesResult, dishesResult, uiConfigsResult] = await Promise.all([
    readSupabaseRows<PublicMenuRow>("menus", 500),
    readSupabaseRows<PublicMenuRow>("menu_categories", 1_000),
    readSupabaseRows<PublicMenuRow>("menu_dishes", 1_000),
    readSupabaseRows<PublicMenuRow>("menu_ui_configs", 1_000)
  ]);
  const primaryMenu = menusResult.ok ? findPrimaryMenu(menusResult.rows, restaurantId) : null;
  const legacyMenuLanguages = uiConfigsResult.ok
    ? findLegacyMenuLanguages(uiConfigsResult.rows, restaurantId)
    : undefined;

  if (primaryMenu) {
    return buildRelationalSupabasePublicMenu({
      slug,
      restaurantRow: match,
      menuRow: primaryMenu,
      categoryRows: categoriesResult.ok ? categoriesResult.rows : [],
      dishRows: dishesResult.ok ? dishesResult.rows : [],
      legacyMenuLanguages
    });
  }

  return buildSupabasePublicMenu(
    slug,
    match,
    dishesResult.ok ? dishesResult.rows : [],
    { legacyMenuLanguages }
  );
}
