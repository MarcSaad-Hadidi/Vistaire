import { ADMIN_ANALYTICS_THRESHOLDS } from "./analyticsThresholds.ts";

export type AdminPanelEvidence<T> =
  | { kind: "supported"; data: T }
  | { kind: "insufficient"; reason: string }
  | { kind: "unavailable"; reason: string };

type EventRow = Record<string, unknown>;
export type AdminAnalyticsPanelScope = { restaurantId: string; menuId: string; source: "production"; metricDefinition: "all-events-v1" };
type DailyPoint = { day: string; count: number };
type Ranked = { slug: string; count: number; label?: string };
type SearchTerm = { term: string; count: number; previousCount: number; changeRate: number | null; daily: number[] };
type DensePeriod = { startInclusive: string; endExclusive: string; bucketCount: number };

export type AdminAnalyticsPanels = {
  currentDaily: AdminPanelEvidence<DailyPoint[]>;
  dailyComparison: AdminPanelEvidence<{ current: DailyPoint[]; previous: DailyPoint[] }>;
  hourWeekday: AdminPanelEvidence<{ weekdayUtc: number; hourUtc: number; count: number }[]>;
  categories: AdminPanelEvidence<Ranked[]>;
  serviceWindows: AdminPanelEvidence<{ timezone: "UTC"; windows: ServiceWindow[] }>;
  ranking: AdminPanelEvidence<Ranked[]>;
  searches: AdminPanelEvidence<SearchTerm[]>;
};

type ServiceWindow = { id: string; label: string; startHourUtc: number; endHourUtc: number; count: number };
type Input = { currentEvents: EventRow[]; previousEvents: EventRow[]; currentDurationMs: number; previousDurationMs: number; currentPeriod?: DensePeriod; previousPeriod?: DensePeriod; currentScope?: AdminAnalyticsPanelScope | null; previousScope?: AdminAnalyticsPanelScope | null; selectedMenuCategorySlugs?: string[]; selectedMenuCategories?: { slug: string; label: string }[]; sourceComplete?: boolean };

const stringValue = (row: EventRow, key: string) => typeof row[key] === "string" ? row[key] as string : "";
function unavailable<T>(): AdminPanelEvidence<T> { return { kind: "unavailable", reason: "source-incomplete" }; }
function evidence<T>(data: T[], reason: string): AdminPanelEvidence<T[]> { return data.length ? { kind: "supported", data } : { kind: "insufficient", reason }; }

function countBy(values: string[]): Ranked[] {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].map(([slug, count]) => ({ slug, count })).sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
}

function validDate(row: EventRow): Date | null {
  const date = new Date(stringValue(row, "created_at"));
  return Number.isFinite(date.getTime()) ? date : null;
}

function daily(events: EventRow[]): DailyPoint[] {
  return countBy(events.map((row) => validDate(row)?.toISOString().slice(0, 10) ?? "")).map(({ slug, count }) => ({ day: slug, count })).sort((a, b) => a.day.localeCompare(b.day));
}

function denseDaily(events: EventRow[], period?: DensePeriod): DailyPoint[] {
  if (!period) return daily(events);
  const start = Date.parse(period.startInclusive);
  const end = Date.parse(period.endExclusive);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || period.bucketCount < 1) return [];
  const duration = (end - start) / period.bucketCount;
  const counts = Array.from({ length: period.bucketCount }, () => 0);
  for (const row of events) {
    const timestamp = validDate(row)?.getTime();
    if (timestamp === undefined) continue;
    const index = Math.floor((timestamp - start) / duration);
    if (index >= 0 && index < counts.length) counts[index] += 1;
  }
  return counts.map((count, index) => ({ day: new Date(start + index * duration).toISOString().slice(0, 10), count }));
}

export function partitionAdminAnalyticsEvents<T extends EventRow>(events: T[], window: { comparisonStartInclusive: string; comparisonEndExclusive: string; startInclusive: string; endExclusive: string }): { currentEvents: T[]; previousEvents: T[] } {
  const comparisonStart = Date.parse(window.comparisonStartInclusive);
  const comparisonEnd = Date.parse(window.comparisonEndExclusive);
  const currentStart = Date.parse(window.startInclusive);
  const currentEnd = Date.parse(window.endExclusive);
  const timestamp = (row: T) => Date.parse(stringValue(row, "created_at"));
  return {
    currentEvents: events.filter((row) => { const value = timestamp(row); return Number.isFinite(value) && value >= currentStart && value < currentEnd; }),
    previousEvents: events.filter((row) => { const value = timestamp(row); return Number.isFinite(value) && value >= comparisonStart && value < comparisonEnd; })
  };
}

function scopesMatch(current: AdminAnalyticsPanelScope | null | undefined, previous: AdminAnalyticsPanelScope | null | undefined): boolean {
  return Boolean(current && previous && current.restaurantId === previous.restaurantId && current.menuId === previous.menuId && current.source === previous.source && current.metricDefinition === previous.metricDefinition);
}

const serviceDefinitions = [
  { id: "overnight", label: "Nuit", startHourUtc: 0, endHourUtc: 5 },
  { id: "breakfast", label: "Matin", startHourUtc: 5, endHourUtc: 11 },
  { id: "lunch", label: "Midi", startHourUtc: 11, endHourUtc: 15 },
  { id: "afternoon", label: "Après-midi", startHourUtc: 15, endHourUtc: 18 },
  { id: "dinner", label: "Soirée", startHourUtc: 18, endHourUtc: 24 }
] as const;

export function isPrivacySafeAdminSearchTerm(value: string): boolean {
  const term = value.trim();
  if (!term || term.length > 80) return false;
  if (/@|https?:\/\/|www\.|\b\d{1,3}(?:\.\d{1,3}){3}\b/i.test(term)) return false;
  return term.replace(/\D/g, "").length < 7;
}

export function buildAdminAnalyticsPanels(input: Input): AdminAnalyticsPanels {
  if (input.sourceComplete === false) return {
    currentDaily: unavailable(), dailyComparison: unavailable(), hourWeekday: unavailable(), categories: unavailable(),
    serviceWindows: unavailable(), ranking: unavailable(), searches: unavailable()
  };
  const current = denseDaily(input.currentEvents, input.currentPeriod);
  const previous = denseDaily(input.previousEvents, input.previousPeriod);
  const heatmapCounts = new Map<string, number>();
  for (const row of input.currentEvents) {
    const date = validDate(row);
    if (!date) continue;
    const key = `${date.getUTCDay()}:${date.getUTCHours()}`;
    heatmapCounts.set(key, (heatmapCounts.get(key) ?? 0) + 1);
  }
  const hourWeekday = [...heatmapCounts].map(([key, count]) => {
    const [weekdayUtc, hourUtc] = key.split(":").map(Number);
    return { weekdayUtc, hourUtc, count };
  }).sort((a, b) => a.weekdayUtc - b.weekdayUtc || a.hourUtc - b.hourUtc);
  const dishEvents = input.currentEvents.filter((row) => stringValue(row, "event_name") === "dish_opened");
  const categoryLabels = new Map(input.selectedMenuCategories?.map(({ slug, label }) => [slug, label]) ?? []);
  const selectedCategories = input.selectedMenuCategories ? new Set(categoryLabels.keys()) : input.selectedMenuCategorySlugs ? new Set(input.selectedMenuCategorySlugs) : null;
  const normalizedSearchTerm = (row: EventRow) => stringValue(row, "search_query").trim().toLocaleLowerCase("fr-CA");
  const currentSearchEvents = input.currentEvents.filter((row) => stringValue(row, "event_name") === "search_used" && isPrivacySafeAdminSearchTerm(normalizedSearchTerm(row)));
  const previousSearchCounts = new Map(countBy(input.previousEvents.filter((row) => stringValue(row, "event_name") === "search_used").map(normalizedSearchTerm).filter(isPrivacySafeAdminSearchTerm)).map(({ slug, count }) => [slug, count]));
  const searches = countBy(currentSearchEvents.map(normalizedSearchTerm))
    .filter(({ count }) => count >= ADMIN_ANALYTICS_THRESHOLDS.minimumSearchTermCount)
    .map(({ slug: term, count }) => {
      const previousCount = previousSearchCounts.get(term) ?? 0;
      return {
        term,
        count,
        previousCount,
        changeRate: previousCount > 0 ? (count - previousCount) / previousCount : null,
        daily: denseDaily(currentSearchEvents.filter((row) => normalizedSearchTerm(row) === term), input.currentPeriod).map((point) => point.count)
      };
    });
  const hasRankingSample = dishEvents.length >= ADMIN_ANALYTICS_THRESHOLDS.minimumRankedDishEvents;
  const rankedItems = (values: string[]) => hasRankingSample ? countBy(values).filter(({ count }) => count >= ADMIN_ANALYTICS_THRESHOLDS.minimumRankedItemCount) : [];
  const serviceWindows = serviceDefinitions.map((definition) => ({ ...definition, count: input.currentEvents.reduce((count, row) => { const hour = validDate(row)?.getUTCHours(); return count + (hour !== undefined && hour >= definition.startHourUtc && hour < definition.endHourUtc ? 1 : 0); }, 0) }));
  return {
    currentDaily: evidence(current, "no-current-events"),
    dailyComparison: !scopesMatch(input.currentScope, input.previousScope) ? { kind: "unavailable", reason: "incompatible-scope" } : input.currentDurationMs === input.previousDurationMs && current.length && previous.length ? { kind: "supported", data: { current, previous } } : { kind: "insufficient", reason: "incompatible-or-empty-period" },
    hourWeekday: evidence(hourWeekday, "no-timestamped-events"),
    categories: evidence(rankedItems(dishEvents.map((row) => stringValue(row, "category_slug")).filter((slug) => !selectedCategories || selectedCategories.has(slug))).map((item) => categoryLabels.has(item.slug) ? { ...item, label: categoryLabels.get(item.slug)! } : item), "no-category-evidence"),
    serviceWindows: input.currentEvents.some(validDate) ? { kind: "supported", data: { timezone: "UTC", windows: serviceWindows } } : { kind: "insufficient", reason: "no-timestamped-events" },
    ranking: evidence(rankedItems(dishEvents.map((row) => stringValue(row, "dish_slug"))), "no-dish-ranking-evidence"),
    searches: evidence(searches, "no-search-evidence")
  };
}
