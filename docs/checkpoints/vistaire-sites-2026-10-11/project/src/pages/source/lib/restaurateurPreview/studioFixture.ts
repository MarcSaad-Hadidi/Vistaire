import type { AdminDashboardData } from "@/lib/admin/dashboardData";
import type { AdminDashboardRange } from "@/lib/admin/dashboardRange";
import type { AdminMetricSeries, AdminMetricSeriesId } from "@/lib/admin/analyticsState";
import { RESTAURATEUR_PREVIEW_FIXTURE } from "./fixture";
import type { RestaurateurPreviewLocale } from "./types";

export const PUBLIC_STUDIO_DEMO_RANGES: AdminDashboardRange[] = ["today-utc", "7d", "30d"];
export type PublicStudioDemoData = AdminDashboardData & { synthetic: true };
const DAY = 86_400_000;
const END = Date.parse("2026-08-09T00:00:00.000Z");
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
// Integer apportionment keeps every sample chart, dish and total consistent.
function allocate(total: number, weights: number[]) {
  const weight = sum(weights);
  const exact = weights.map(value => weight ? total * value / weight : 0);
  const result = exact.map(Math.floor);
  const order = exact.map((value, index) => ({ index, fraction: value - result[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let left = total - sum(result), i = 0; left > 0; left--, i++) result[order[i % order.length].index]++;
  return result;
}
function daily(values: number[], days: number) {
  if (days === 1) return [sum(values)];
  if (values.length === days) return [...values];
  return values.flatMap(value => allocate(value, [1, 1, 1]));
}

/** Public-only fixture. The shared chart state's legacy "real" tag means populated;
 * synthetic:true and AdminStudio demo mode are mandatory at this boundary. No loader or events. */
export function createPublicStudioDemo(range: AdminDashboardRange, locale: RestaurateurPreviewLocale): PublicStudioDemoData {
  if (!PUBLIC_STUDIO_DEMO_RANGES.includes(range)) throw new Error("Unsupported public demo range");
  const fixture = RESTAURATEUR_PREVIEW_FIXTURE;
  const period = fixture.periods[range === "today-utc" ? "24h" : range as "7d" | "30d"];
  const days = range === "today-utc" ? 1 : range === "7d" ? 7 : 30;
  const start = END - days * DAY;
  const priorStart = start - days * DAY;
  const iso = (time: number) => new Date(time).toISOString();
  const observationWindow = { range, startInclusive: iso(start), endExclusive: iso(END), comparisonStartInclusive: iso(priorStart), comparisonEndExclusive: iso(start) };
  const categories = fixture.categories.map(item => ({ id: item.id, slug: item.id, label: item.label[locale] }));
  const dishes = fixture.dishes.map(item => ({
    id: item.id, slug: item.id, name: locale === "fr" ? item.name : item.nameEn,
    category: categories.find(category => category.id === item.categoryId)!.label,
    categorySlug: item.categoryId, description: locale === "fr" ? "Plat de démonstration" : "Sample dish",
    priceLabel: new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(item.priceCents / 100),
    priceCents: item.priceCents, imageUrl: item.imageSrc, thumbnailUrl: item.imageSrc,
    hasPhoto: true, photoStatus: "ready", hasImmersive: true, has3d: true, hasAr: true, available: item.available,
  }));
  const series: Partial<Record<AdminMetricSeriesId, AdminMetricSeries>> = {};
  const metricPairs = [["menuOpened", "menuOpens", "menu-opens"], ["dishOpened", "dishOpens", "dish-opens"], ["searches", "searches", "searches"], ["immersive", "immersive", "immersive"]] as const;
  const points = (values: number[], from: number) => values.map((value, index) => ({ value, bucket: iso(from + index * DAY).slice(0, 10), timestampLabel: iso(from + index * DAY).slice(0, 10) }));
  const metric = (id: string, value: number, baseline: number) => ({ id, value, baseline, changeRate: baseline ? (value - baseline) / baseline : null });
  const metrics = metricPairs.map(([id, field, metricId]) => {
    series[id] = { id, current: points(daily(period.series[field], days), start), previous: points(daily(period.previousSeries[field], days), priorStart) };
    return metric(metricId, period.metrics[field], period.previousMetrics[field]);
  });
  // This public fixture records combined immersion. The 3D/AR split is explicitly illustrative.
  const currentImmersive = series.immersive!.current.map(point => point.value);
  const previousImmersive = series.immersive!.previous.map(point => point.value);
  const three = allocate(Math.round(period.metrics.immersive * .7), currentImmersive);
  const previousThree = allocate(Math.round(period.previousMetrics.immersive * .7), previousImmersive);
  const ar = currentImmersive.map((value, index) => value - three[index]);
  const previousAr = previousImmersive.map((value, index) => value - previousThree[index]);
  for (const [id, current, previous] of [["three", three, previousThree], ["ar", ar, previousAr]] as const) {
    series[id] = { id, current: points(current, start), previous: points(previous, priorStart) };
    metrics.push(metric(id, sum(current), sum(previous)));
  }
  const dishViews = dishes.map(dish => period.topDishes.find(row => row.dishId === dish.id)!.count);
  const dishThree = allocate(sum(three), dishViews), dishAr = allocate(sum(ar), dishViews);
  const previousViews = allocate(period.previousMetrics.dishOpens, dishViews);
  const dishStatistics = Object.fromEntries(dishes.map((dish, index) => [dish.id, {
    views: dishViews[index], three: dishThree[index], ar: dishAr[index], previousViews: previousViews[index],
    changeRate: previousViews[index] ? (dishViews[index] - previousViews[index]) / previousViews[index] : null,
  }]));
  const ranking = period.topDishes.map(row => ({ slug: row.dishId, count: row.count })).sort((a, b) => b.count - a.count);
  const categoryBreakdown = period.categoryBreakdown.map(row => ({ slug: row.categoryId, label: categories.find(item => item.id === row.categoryId)!.label, count: row.count }));
  const currentDaily = series.dishOpened!.current.map((point, index) => ({ day: point.bucket, count: metricPairs.reduce((total, [id]) => total + series[id]!.current[index].value, 0) }));
  const previousDaily = series.dishOpened!.previous.map((point, index) => ({ day: point.bucket, count: metricPairs.reduce((total, [id]) => total + series[id]!.previous[index].value, 0) }));
  const weekdayTotals = Array<number>(7).fill(0);
  for (const row of currentDaily) weekdayTotals[new Date(row.day).getUTCDay()] += row.count;
  const serviceRemainders = period.serviceBreakdown.map(row => row.count);
  const heatmap: { weekdayUtc: number; hourUtc: number; count: number }[] = [];
  for (const weekday of [1, 2, 3, 4, 5, 6, 0]) {
    let remaining = weekdayTotals[weekday];
    for (let service = 0; service < serviceRemainders.length; service++) {
      const count = Math.min(remaining, serviceRemainders[service]);
      if (count > 0) heatmap.push({ weekdayUtc: weekday, hourUtc: [2, 8, 12, 16, 19][service], count });
      remaining -= count;
      serviceRemainders[service] -= count;
    }
  }
  const searches = period.searchBreakdown.map(row => ({ term: row.term[locale], count: row.count }));
  const previousSearchCounts = allocate(period.previousMetrics.searches, searches.map(row => row.count));
  return {
    synthetic: true,
    restaurant: { id: "public-demo-restaurant", name: fixture.restaurant.name[locale], slug: "public-demo", location: null, cuisineType: null, timezone: null, publicMenuPath: locale === "fr" ? "/demo" : "/en/vistaire-menu" },
    menu: { id: "public-demo-menu", status: "published", categories, dishes, readiness: { score: 100, counts: { categories: categories.length, dishes: dishes.length, available: dishes.filter(dish => dish.available).length, unavailable: dishes.filter(dish => !dish.available).length, missingPrice: 0, missingDescription: 0, missingPhoto: 0, withPhoto: dishes.length, withImmersive: dishes.length }, actions: [] } },
    dishStatistics,
    analytics: { kind: "real", completeness: "complete", observationWindow, lastUpdatedAt: fixture.generatedAt, freshness: "fresh", coverage: { menuOpened: true, dishOpened: true }, metrics, metricSeries: series as Record<AdminMetricSeriesId, AdminMetricSeries>,
      activitySeries: currentDaily.map(row => ({ bucket: row.day, count: row.count })), categoryBreakdown, topDishes: ranking, searches,
      immersive: [{ name: "dish_3d_clicked", count: sum(three) }, { name: "dish_ar_clicked", count: sum(ar) }], funnel: { kind: "unsupported" }, comparison: null,
      panels: {
        currentDaily: { kind: "supported", data: currentDaily }, dailyComparison: { kind: "supported", data: { current: currentDaily, previous: previousDaily } },
        ranking: { kind: "supported", data: ranking }, categories: { kind: "supported", data: categoryBreakdown },
        hourWeekday: { kind: "supported", data: heatmap },
        serviceWindows: { kind: "supported", data: { timezone: "UTC", windows: period.serviceBreakdown.map((row, index) => ({ ...row, label: row.label[locale], startHourUtc: [0,5,11,15,18][index], endHourUtc: [5,11,15,18,24][index] })) } },
        searches: { kind: "supported", data: searches.map((row, index) => ({ ...row, previousCount: previousSearchCounts[index], changeRate: previousSearchCounts[index] ? (row.count - previousSearchCounts[index]) / previousSearchCounts[index] : null, daily: allocate(row.count, Array(days).fill(1)) })) },
      },
    },
  };
}

