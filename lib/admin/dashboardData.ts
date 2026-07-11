import "server-only";

import { buildRelationalSupabasePublicMenu, type PublicMenuDish } from "@/lib/menu/publicMenuCore";
import { getNullableString, getString, readAnalyticsEventsForPeriod, readSupabaseRowsByFilters, type AnyRow } from "@/lib/analytics/serverRows";
import { buildAdminAnalyticsState, type AdminAnalyticsState } from "@/lib/admin/analyticsState";
import { resolveAdminObservationWindow, type AdminDashboardRange } from "@/lib/admin/dashboardRange";
import { buildAdminMenuReadiness, selectAdminDashboardMenu, type AdminMenuCategory, type AdminMenuDish, type AdminMenuReadiness } from "@/lib/admin/menuReadiness";
import { buildMaisonElyseeDemoEvents, MAISON_ELYSEE_DEMO_ID } from "@/lib/admin/demoAnalyticsEvents";

export type AdminDashboardData = {
  restaurant: { id: string; name: string; slug: string; location: string | null; cuisineType: string | null; timezone: null; publicMenuPath: string };
  menu: { id: string; status: "published" | "draft"; categories: AdminMenuCategory[]; dishes: AdminMenuDish[]; readiness: AdminMenuReadiness };
  analytics: AdminAnalyticsState;
};
export type AdminDashboardLoadResult = { ok: true; data: AdminDashboardData } | { ok: false; reason: "restaurant-lookup-failed" | "restaurant-not-found" | "menu-lookup-failed" };

type Dependencies = {
  readRows: typeof readSupabaseRowsByFilters;
  readEvents: typeof readAnalyticsEventsForPeriod;
  now: () => Date;
};

const toDish = (dish: PublicMenuDish): AdminMenuDish => ({ id: dish.id, slug: dish.slug, name: dish.name, category: dish.category, ...(dish.categorySlug ? { categorySlug: dish.categorySlug } : {}), description: dish.description, priceLabel: dish.priceLabel, priceCents: dish.priceCents, imageUrl: dish.imageUrl, thumbnailUrl: dish.thumbnailUrl, hasPhoto: dish.hasPhoto, photoStatus: dish.photoStatus, hasImmersive: dish.hasImmersive, has3d: dish.has3d, hasAr: dish.hasAr, available: dish.available });
const toCategory = (row: AnyRow, index: number): AdminMenuCategory => ({ id: getString(row, ["id"], `category-${index}`), label: getString(row, ["name", "label"], "Carte"), slug: getString(row, ["slug"], `categorie-${index}`) });

export async function loadAdminDashboardData(restaurantId: string, range: AdminDashboardRange = "7d"): Promise<AdminDashboardLoadResult> {
  return loadAdminDashboardDataWithDependencies(restaurantId, range, { readRows: readSupabaseRowsByFilters, readEvents: readAnalyticsEventsForPeriod, now: () => new Date() });
}

export async function loadAdminDashboardDataWithDependencies(restaurantId: string, range: AdminDashboardRange, dependencies: Dependencies): Promise<AdminDashboardLoadResult> {
  const restaurantResult = await dependencies.readRows({ table: "restaurants", columns: "id,name,slug,city,cuisine_type", filters: { id: restaurantId }, orderBy: "id", limit: 1 });
  if (!restaurantResult.ok) return { ok: false, reason: "restaurant-lookup-failed" };
  const restaurantRow = restaurantResult.rows[0];
  if (!restaurantRow) return { ok: false, reason: "restaurant-not-found" };
  const menuResult = await dependencies.readRows({ table: "menus", columns: "id,restaurant_id,status,is_primary,updated_at", filters: { restaurant_id: restaurantId }, orderBy: "id", limit: 100 });
  if (!menuResult.ok) return { ok: false, reason: "menu-lookup-failed" };
  const selectedMenu = selectAdminDashboardMenu(menuResult.rows);
  if (!selectedMenu) return { ok: false, reason: "menu-lookup-failed" };
  const filters = { restaurant_id: restaurantId, menu_id: selectedMenu.id };
  const [categoriesResult, dishesResult] = await Promise.all([
    dependencies.readRows({ table: "menu_categories", columns: "id,restaurant_id,menu_id,name,slug,display_order", filters, orderBy: "display_order", limit: 250 }),
    dependencies.readRows({ table: "menu_dishes", columns: "id,restaurant_id,menu_id,category_id,name,slug,short_description,description,price_cents,currency,image_url,is_available,is_signature,is_recommended,has_immersive_view,metadata,created_at", filters, orderBy: "created_at", limit: 500 })
  ]);
  const categoryRows = categoriesResult.ok ? categoriesResult.rows : [];
  const dishRows = dishesResult.ok ? dishesResult.rows : [];
  const menu = buildRelationalSupabasePublicMenu({ slug: getString(restaurantRow, ["slug"]), restaurantRow, categoryRows, dishRows, includeUnavailableDishes: true });
  const categories = categoryRows.map(toCategory);
  const dishes = menu.dishes.map(toDish);
  const window = resolveAdminObservationWindow(range, dependencies.now());
  const events = await dependencies.readEvents({ restaurantId, menuId: selectedMenu.id, fromIso: window.startInclusive, toIso: window.endExclusive });
  const eventRows = process.env.NODE_ENV !== "production" && restaurantId === MAISON_ELYSEE_DEMO_ID && events.ok && events.rows.length === 0
    ? buildMaisonElyseeDemoEvents({ dishes, categories, endExclusive: window.endExclusive })
    : events.ok ? events.rows : [];
  const lastUpdatedAt = eventRows.reduce<string | null>((latest, row) => { const value = getNullableString(row, ["created_at"]); return value && (!latest || value > latest) ? value : latest; }, null);
  const readiness = buildAdminMenuReadiness(categories, dishes);
  const publicMenuPath = `/menu/${menu.slug}`;
  return { ok: true, data: { restaurant: { id: restaurantId, name: getString(restaurantRow, ["name"], "Restaurant"), slug: menu.slug, location: getNullableString(restaurantRow, ["city", "location"]), cuisineType: getNullableString(restaurantRow, ["cuisine_type"]), timezone: null, publicMenuPath }, menu: { id: selectedMenu.id, status: selectedMenu.status, categories, dishes, readiness }, analytics: buildAdminAnalyticsState({ observationWindow: window, events:eventRows, lastUpdatedAt, databaseError: !events.ok, truncated: events.ok && events.truncated, partialSource: !categoriesResult.ok || !dishesResult.ok }) } };
}
