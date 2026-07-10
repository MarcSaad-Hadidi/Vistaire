import "server-only";

import type { Category, Dish } from "@/lib/demoMenuData";
import {
  getDemoAdminInsights,
  type DemoAdminInsights,
  type SearchTrend,
  type TopDishInsight
} from "@/lib/demoAdminInsights";
import {
  buildEngagementFunnel,
  buildRuleBasedAdminRecommendations,
  calculateDishInterestScore,
  enrichSearchInsights,
  getInterestLevelFromScore,
  getSearchInterpretation
} from "@/lib/admin/recommendations";
import {
  getBoolean,
  getNumber,
  getString,
  readAnalyticsEventsForPeriod,
  readRestaurantDailyAnalyticsForPeriod,
  readSupabaseRowsByColumn,
  type AnyRow,
  type DataSourceStatus
} from "@/lib/analytics/serverRows";

export type RestaurantInsightsResult = {
  insights: DemoAdminInsights;
  source: DataSourceStatus;
  note: string;
};

const DEMO_RESTAURANT_ID = process.env.NEXT_PUBLIC_DEMO_RESTAURANT_ID ?? "11111111-1111-1111-1111-111111111111";
export const ANALYTICS_WINDOW_DAYS = 30;
export const DEFAULT_RESTAURANT_TIME_ZONE = "America/Toronto";

function localDate(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function nextCalendarDay(day: string): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function getAnalyticsPeriod(now = new Date(), timeZone = DEFAULT_RESTAURANT_TIME_ZONE) {
  const toIso = now.toISOString();
  const fromIso = new Date(now.getTime() - ANALYTICS_WINDOW_DAYS * 86_400_000).toISOString();
  const format = new Intl.DateTimeFormat("fr-CA", { timeZone, day: "numeric", month: "short" });
  const toDay = localDate(new Date(toIso), timeZone);
  return { fromIso, toIso, fromDay: localDate(new Date(fromIso), timeZone), toDay: nextCalendarDay(toDay), label: `${format.format(new Date(fromIso))} au ${format.format(now)}` };
}

function count(row: AnyRow, keys: string[]) { return getNumber(row, keys, 0); }
function eventName(row: AnyRow) { return getString(row, ["event_name", "eventName", "event_type"], ""); }
function formatCount(value: number) { return new Intl.NumberFormat("fr-CA").format(Math.max(0, Math.round(value))); }
function compactName(name: string) { return name.replace(", bisque corsée & fenouil", ""); }

function fallbackDish(row: AnyRow, rank: number): Dish {
  const slug = getString(row, ["dish_slug", "dishSlug", "slug"], `plat-${rank}`);
  return {
    id: getString(row, ["dish_id", "id"], slug), slug,
    name: getString(row, ["dish_name", "name"], "Plat consulté"),
    categorySlug: getString(row, ["category_slug", "categorySlug"], "carte"),
    shortDescription: "", description: "", price: 0, image: null, ingredients: [], allergens: [], options: [], sides: [],
    chefRecommendation: "", isSignature: getBoolean(row, ["is_signature"], false), isRecommended: getBoolean(row, ["is_recommended"], false),
    isAvailable: getBoolean(row, ["is_available"], true), preparationTime: "", model3dUrl: "", usdzUrl: ""
  };
}

function resolveDish(row: AnyRow, rank: number, dishes: AnyRow[], categories: AnyRow[]): { dish: Dish; category: Category } {
  const slug = getString(row, ["dish_slug", "slug"], "");
  const menuDish = dishes.find((item) => getString(item, ["slug"], "") === slug) ?? row;
  const dish = fallbackDish({ ...row, ...menuDish }, rank);
  const categoryId = getString(menuDish, ["category_id"], "");
  const category = categories.find((item) => getString(item, ["id"], "") === categoryId) ?? {};
  return {
    dish,
    category: {
      id: getString(category, ["id"], `category-${rank}`),
      slug: getString(category, ["slug"], dish.categorySlug),
      name: getString(category, ["name"], "Carte"),
      description: getString(category, ["description"], ""),
      order: count(category, ["display_order", "sort_order"])
    }
  };
}

function buildRowsFromEvents(events: AnyRow[]) {
  const dishes = new Map<string, AnyRow>();
  const searches = new Map<string, number>();
  const categories = new Map<string, number>();
  for (const row of events) {
    const name = eventName(row);
    const slug = getString(row, ["dish_slug"], "");
    if (slug) {
      const current = dishes.get(slug) ?? { dish_slug: slug, dish_opened_count: 0, immersive_interaction_count: 0 };
      if (name === "dish_opened") current.dish_opened_count = count(current, ["dish_opened_count"]) + 1;
      if (name === "dish_3d_clicked" || name === "dish_ar_clicked") current.immersive_interaction_count = count(current, ["immersive_interaction_count"]) + 1;
      dishes.set(slug, current);
    }
    if (name === "search_used") {
      const term = getString(row, ["search_query"], "").toLowerCase();
      if (term) searches.set(term, (searches.get(term) ?? 0) + 1);
    }
    if (name === "category_viewed") {
      const slug = getString(row, ["category_slug"], "");
      if (slug) categories.set(slug, (categories.get(slug) ?? 0) + 1);
    }
  }
  return {
    dishes: [...dishes.values()],
    searches: [...searches].map(([search_query, search_count]) => ({ search_query, search_count })),
    categories: [...categories].map(([category_slug, category_viewed_count]) => ({ category_slug, category_viewed_count }))
  };
}

export function buildRealInsights(args: {
  restaurantName: string; periodLabel: string; menuDishRows: AnyRow[]; menuCategoryRows: AnyRow[];
  dailyRows: AnyRow[]; dishRows: AnyRow[]; searchRows: AnyRow[]; categoryRows: AnyRow[]; eventRows: AnyRow[];
}): DemoAdminInsights | null {
  const fromEvents = buildRowsFromEvents(args.eventRows);
  const menuOpens = args.dailyRows.reduce((sum, row) => sum + count(row, ["menu_opened_count", "menu_opens", "menu_opened"]), 0) || args.eventRows.filter((row) => eventName(row) === "menu_opened").length;
  const sessions = args.dailyRows.reduce((sum, row) => sum + count(row, ["unique_sessions", "session_count"]), 0) || new Set(args.eventRows.map((row) => getString(row, ["session_id"], "")).filter(Boolean)).size;
  const dishRows = fromEvents.dishes;
  const searchRows = fromEvents.searches;
  const categoryRows = fromEvents.categories;
  const dishViews = args.dailyRows.reduce((sum, row) => sum + count(row, ["dish_opened_count", "dish_views", "dish_opened"]), 0) || dishRows.reduce((sum, row) => sum + count(row, ["dish_opened_count", "dish_views", "dish_opened"]), 0);
  const searches = args.dailyRows.reduce((sum, row) => sum + count(row, ["search_used_count", "search_count", "searches"]), 0) || searchRows.reduce((sum, row) => sum + count(row, ["search_count", "count"]), 0);
  const filters = args.dailyRows.reduce((sum, row) => sum + count(row, ["filter_used_count", "filter_count", "filters"]), 0) || args.eventRows.filter((row) => eventName(row) === "filter_used").length;
  const immersive = args.dailyRows.reduce((sum, row) => sum + count(row, ["immersive_interaction_count", "dish_3d_clicked_count", "dish_ar_clicked_count", "immersive_interactions"]), 0) || dishRows.reduce((sum, row) => sum + count(row, ["immersive_interaction_count", "dish_3d_clicked_count", "dish_ar_clicked_count", "immersive_interactions"]), 0);
  const ar = args.dailyRows.reduce((sum, row) => sum + count(row, ["dish_ar_clicked_count", "dish_ar_clicked", "ar_clicks"]), 0) || args.eventRows.filter((row) => eventName(row) === "dish_ar_clicked").length;
  const categoryViews = args.dailyRows.reduce((sum, row) => sum + count(row, ["category_viewed_count", "category_views"]), 0) || categoryRows.reduce((sum, row) => sum + count(row, ["category_viewed_count", "views"]), 0);
  const topDishes: TopDishInsight[] = [...dishRows].sort((a, b) => count(b, ["dish_opened_count", "dish_views"]) - count(a, ["dish_opened_count", "dish_views"])).slice(0, 6).map((row, index, all) => {
    const { dish, category } = resolveDish(row, index + 1, args.menuDishRows, args.menuCategoryRows);
    const views = count(row, ["dish_opened_count", "dish_views", "dish_opened"]);
    const immersiveInteractions = count(row, ["immersive_interaction_count", "dish_3d_clicked_count", "dish_ar_clicked_count", "immersive_interactions"]);
    return { rank: index + 1, dish, category, views, averageTime: "Non suivi", immersiveInteractions, interestScore: calculateDishInterestScore({ views, immersiveInteractions, maxRawScore: Math.max(1, ...all.map((item) => count(item, ["dish_opened_count", "dish_views"]))) }), interestLevel: getInterestLevelFromScore(calculateDishInterestScore({ views, immersiveInteractions, maxRawScore: Math.max(1, ...all.map((item) => count(item, ["dish_opened_count", "dish_views"]))) })) };
  });
  const searchInsights = enrichSearchInsights(searchRows.map((row) => ({ term: getString(row, ["search_query", "term"], "Recherche"), count: count(row, ["search_count", "count"]), trend: "Stable" as SearchTrend, interpretation: getSearchInterpretation(getString(row, ["search_query", "term"], "Recherche")) })).filter((row) => row.count > 0));
  const topCategory = [...categoryRows].sort((a, b) => count(b, ["category_viewed_count", "views"]) - count(a, ["category_viewed_count", "views"]))[0];
  const topDishName = topDishes[0] ? compactName(topDishes[0].dish.name) : "Pas encore assez de données";
  const topCategoryName = topCategory ? getString(topCategory, ["category_name", "name", "category_slug"], "Carte") : "Pas encore assez de données";
  const summary = [
    ["menu-opens", "Ouvertures du menu", menuOpens], ["anonymous-sessions", "Sessions clients estimées", sessions], ["dish-views", "Plats consultés", dishViews], ["searches", "Recherches effectuées", searches], ["filters", "Filtres utilisés", filters], ["immersive-views", "Vues immersives", immersive], ["ar-option-used", "Afficher devant moi", ar]
  ].map(([id, label, value]) => ({ id: String(id), label: `${label} — 30 derniers jours`, value: formatCount(Number(value)), helper: `Données réelles du ${args.periodLabel}.` }));
  summary.push({ id: "top-dish", label: "Plat le plus consulté", value: topDishName, helper: topDishes.length ? "Signal le plus fort de la période." : "Pas encore assez de données." });
  summary.push({ id: "top-category", label: "Catégorie la plus populaire", value: topCategoryName, helper: topCategory ? "Section la plus consultée de la période." : "Pas encore assez de données." });
  const insights: DemoAdminInsights = { generatedFor: args.restaurantName, serviceLabel: `30 derniers jours (${args.periodLabel}) · Données réelles`, dailySummary: topDishes.length ? `${topDishName} génère le signal le plus fort.` : "Des signaux réels sont disponibles, mais aucun plat ne se détache encore.", summary, topDishes, searchInsights, immersiveInsights: [{ label: "Vues immersives", value: formatCount(immersive), helper: "Interactions 3D et AR de la période." }, { label: "Afficher devant moi", value: formatCount(ar), helper: "Interactions AR de la période." }, { label: "Plat le plus exploré", value: topDishName, helper: topDishes.length ? "Signal immersif le plus fort." : "Pas encore assez de données." }, { label: "Taux d’utilisation immersive", value: dishViews ? `${Math.round((immersive / dishViews) * 100)} %` : "0 %", helper: "Part des consultations qui déclenchent une interaction immersive." }], engagementFunnel: buildEngagementFunnel({ menuOpens, categoryViews, dishOpens: dishViews, immersiveViews: immersive }), serviceActivity: [], recommendations: [] };
  insights.recommendations = buildRuleBasedAdminRecommendations(insights);
  return menuOpens || sessions || dishViews || searches || immersive || categoryViews ? insights : null;
}

function emptyInsights(restaurantName: string): DemoAdminInsights {
  return { generatedFor: restaurantName, serviceLabel: "30 derniers jours", dailySummary: "Les premières tendances apparaîtront après les prochaines consultations du menu.", summary: [], topDishes: [], searchInsights: [], immersiveInsights: [], engagementFunnel: [], serviceActivity: [], recommendations: [] };
}

export async function getRestaurantInsights(restaurantId: string, menuId?: string): Promise<RestaurantInsightsResult> {
  const scopedRestaurantId = restaurantId.trim();
  if (!scopedRestaurantId) return { insights: emptyInsights("Votre restaurant"), source: "empty", note: "Identité restaurant indisponible." };
  const period = getAnalyticsPeriod();
  const [restaurantResult, menuCategoryResult, menuDishResult, dailyResult, dishResult, searchResult, categoryResult, eventResult] = await Promise.all([
    readSupabaseRowsByColumn("restaurants", "id", scopedRestaurantId, 1), readSupabaseRowsByColumn("menu_categories", "restaurant_id", scopedRestaurantId, 250), readSupabaseRowsByColumn("menu_dishes", "restaurant_id", scopedRestaurantId, 500), readRestaurantDailyAnalyticsForPeriod({ restaurantId: scopedRestaurantId, fromDay: period.fromDay, toDay: period.toDay }), readSupabaseRowsByColumn("restaurant_dish_analytics", "restaurant_id", scopedRestaurantId, 200), readSupabaseRowsByColumn("restaurant_search_analytics", "restaurant_id", scopedRestaurantId, 100), readSupabaseRowsByColumn("restaurant_category_analytics", "restaurant_id", scopedRestaurantId, 100), readAnalyticsEventsForPeriod({ restaurantId: scopedRestaurantId, fromIso: period.fromIso, toIso: period.toIso, menuId })
  ]);
  const restaurantName = restaurantResult.ok ? getString(restaurantResult.rows[0] ?? {}, ["name"], "Votre restaurant") : "Votre restaurant";
  const menuMatches = (row: AnyRow) => !menuId || getString(row, ["menu_id"], "") === menuId;
  const insights = buildRealInsights({ restaurantName, periodLabel: period.label, menuDishRows: (menuDishResult.ok ? menuDishResult.rows : []).filter(menuMatches), menuCategoryRows: (menuCategoryResult.ok ? menuCategoryResult.rows : []).filter(menuMatches), dailyRows: dailyResult.ok ? dailyResult.rows : [], dishRows: dishResult.ok ? dishResult.rows : [], searchRows: searchResult.ok ? searchResult.rows : [], categoryRows: categoryResult.ok ? categoryResult.rows : [], eventRows: eventResult.ok ? eventResult.rows : [] });
  if (insights) return { insights, source: eventResult.truncated ? "partial" : "real", note: eventResult.truncated ? "Données réelles partielles : la limite de sécurité des événements a été atteinte." : "Données réelles sur les 30 derniers jours." };
  if (process.env.NODE_ENV !== "production" && scopedRestaurantId === DEMO_RESTAURANT_ID) return { insights: getDemoAdminInsights(), source: "preview", note: "Prévisualisation locale uniquement." };
  return { insights: emptyInsights(restaurantName), source: "empty", note: "Aucune activité menu disponible pour le moment." };
}

export function getDemoRestaurantId(): string { return DEMO_RESTAURANT_ID; }
