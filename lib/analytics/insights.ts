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
import {
  buildPeriodAnalytics,
  hasPeriodActivity,
  resolveAnalyticsSourceHealth,
  sortSearchRowsByCount
} from "@/lib/analytics/insightsCore.mjs";

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

function previousCalendarDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function startOfLocalDayIso(day: string, timeZone: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const provisional = new Date(Date.UTC(year, month - 1, date));
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(provisional);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  const observed = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  return new Date(provisional.getTime() + (Date.UTC(year, month - 1, date) - observed)).toISOString();
}

export function getAnalyticsPeriod(now = new Date(), timeZone = DEFAULT_RESTAURANT_TIME_ZONE) {
  const format = new Intl.DateTimeFormat("fr-CA", { timeZone, day: "numeric", month: "short" });
  const currentDay = localDate(now, timeZone);
  const fromDay = previousCalendarDays(currentDay, ANALYTICS_WINDOW_DAYS - 1);
  const toDay = nextCalendarDay(currentDay);
  return {
    fromIso: startOfLocalDayIso(fromDay, timeZone),
    toIso: startOfLocalDayIso(toDay, timeZone),
    fromDay,
    toDay,
    label: `${format.format(new Date(`${fromDay}T12:00:00.000Z`))} au ${format.format(now)}`
  };
}

function count(row: AnyRow, keys: string[]) { return getNumber(row, keys, 0); }
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

export function buildRealInsights(args: {
  restaurantName: string; periodLabel: string; menuDishRows: AnyRow[]; menuCategoryRows: AnyRow[];
  dailyRows: AnyRow[]; eventRows: AnyRow[];
}): DemoAdminInsights | null {
  const period = buildPeriodAnalytics({ dailyRows: args.dailyRows, eventRows: args.eventRows });
  const { menuOpens, sessions, dishViews, searches, filters, immersive, ar, categoryViews } = period.metrics;
  const { dishRows, searchRows, categoryRows } = period;
  const topDishes: TopDishInsight[] = [...dishRows].sort((a, b) => count(b, ["dish_opened_count", "dish_views"]) - count(a, ["dish_opened_count", "dish_views"])).slice(0, 6).map((row, index, all) => {
    const { dish, category } = resolveDish(row, index + 1, args.menuDishRows, args.menuCategoryRows);
    const views = count(row, ["dish_opened_count", "dish_views", "dish_opened"]);
    const immersiveInteractions = count(row, ["immersive_interaction_count", "dish_3d_clicked_count", "dish_ar_clicked_count", "immersive_interactions"]);
    return { rank: index + 1, dish, category, views, averageTime: "Non suivi", immersiveInteractions, interestScore: calculateDishInterestScore({ views, immersiveInteractions, maxRawScore: Math.max(1, ...all.map((item) => count(item, ["dish_opened_count", "dish_views"]))) }), interestLevel: getInterestLevelFromScore(calculateDishInterestScore({ views, immersiveInteractions, maxRawScore: Math.max(1, ...all.map((item) => count(item, ["dish_opened_count", "dish_views"]))) })) };
  });
  const searchInsights = enrichSearchInsights(sortSearchRowsByCount(searchRows).map((row) => ({ term: getString(row, ["search_query", "term"], "Recherche"), count: count(row, ["search_count", "count"]), trend: "Stable" as SearchTrend, interpretation: getSearchInterpretation(getString(row, ["search_query", "term"], "Recherche")) })).filter((row) => row.count > 0));
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
  return hasPeriodActivity(period.metrics) ? insights : null;
}

function emptyInsights(restaurantName: string): DemoAdminInsights {
  return { generatedFor: restaurantName, serviceLabel: "30 derniers jours", dailySummary: "Les premières tendances apparaîtront après les prochaines consultations du menu.", summary: [], topDishes: [], searchInsights: [], immersiveInsights: [], engagementFunnel: [], serviceActivity: [], recommendations: [] };
}

export async function getRestaurantInsights(restaurantId: string, menuId?: string): Promise<RestaurantInsightsResult> {
  const scopedRestaurantId = restaurantId.trim();
  if (!scopedRestaurantId) return { insights: emptyInsights("Votre restaurant"), source: "empty", note: "Identité restaurant indisponible." };
  const period = getAnalyticsPeriod();
  const [restaurantResult, menuCategoryResult, menuDishResult, dailyResult, eventResult] = await Promise.all([
    readSupabaseRowsByColumn("restaurants", "id", scopedRestaurantId, 1),
    readSupabaseRowsByColumn("menu_categories", "restaurant_id", scopedRestaurantId, 250),
    readSupabaseRowsByColumn("menu_dishes", "restaurant_id", scopedRestaurantId, 500),
    readRestaurantDailyAnalyticsForPeriod({ restaurantId: scopedRestaurantId, fromDay: period.fromDay, toDay: period.toDay }),
    readAnalyticsEventsForPeriod({ restaurantId: scopedRestaurantId, fromIso: period.fromIso, toIso: period.toIso, menuId })
  ]);
  const restaurantName = restaurantResult.ok ? getString(restaurantResult.rows[0] ?? {}, ["name"], "Votre restaurant") : "Votre restaurant";
  const menuMatches = (row: AnyRow) => !menuId || getString(row, ["menu_id"], "") === menuId;
  const insights = buildRealInsights({
    restaurantName,
    periodLabel: period.label,
    menuDishRows: (menuDishResult.ok ? menuDishResult.rows : []).filter(menuMatches),
    menuCategoryRows: (menuCategoryResult.ok ? menuCategoryResult.rows : []).filter(menuMatches),
    // Daily aggregates without a menu_id cannot prove they belong to the
    // selected menu, so only event data may represent that menu.
    dailyRows: (dailyResult.ok ? dailyResult.rows : []).filter(menuMatches),
    eventRows: eventResult.ok ? eventResult.rows : []
  });
  const failedReads = [restaurantResult, menuCategoryResult, menuDishResult, dailyResult, eventResult]
    .filter((result) => !result.ok).length;
  const source = resolveAnalyticsSourceHealth({
    hasActivity: Boolean(insights),
    eventReadOk: eventResult.ok,
    eventTruncated: eventResult.truncated,
    dailyReadOk: dailyResult.ok,
    failedReads
  });
  if (insights && source === "partial") {
    return {
      insights,
      source,
      note: "Données réelles partielles : une source de période est incomplète ou indisponible."
    };
  }
  if (!insights && source === "partial") {
    return {
      insights: emptyInsights(restaurantName),
      source,
      note: "Données partielles : aucune activité exploitable n’a pu être confirmée pour toute la période."
    };
  }
  if (insights) return { insights, source: eventResult.truncated ? "partial" : "real", note: eventResult.truncated ? "Données réelles partielles : la limite de sécurité des événements a été atteinte." : "Données réelles sur les 30 derniers jours." };
  if (process.env.NODE_ENV !== "production" && scopedRestaurantId === DEMO_RESTAURANT_ID) return { insights: getDemoAdminInsights(), source: "preview", note: "Prévisualisation locale uniquement." };
  return { insights: emptyInsights(restaurantName), source: "empty", note: "Aucune activité menu disponible pour le moment." };
}

export function getDemoRestaurantId(): string { return DEMO_RESTAURANT_ID; }
