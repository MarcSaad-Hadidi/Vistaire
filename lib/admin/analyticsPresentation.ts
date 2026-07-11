export type AdminPanelEvidence<T> =
  | { kind: "supported"; data: T }
  | { kind: "insufficient"; reason: string }
  | { kind: "unavailable"; reason: string };

type EventRow = Record<string, unknown>;
type DailyPoint = { day: string; count: number };
type Ranked = { slug: string; count: number };
type SearchTerm = { term: string; count: number };

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
type Input = { currentEvents: EventRow[]; previousEvents: EventRow[]; currentDurationMs: number; previousDurationMs: number; selectedMenuCategorySlugs?: string[]; sourceComplete?: boolean };

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

const serviceDefinitions = [
  { id: "overnight", label: "Nuit (UTC)", startHourUtc: 0, endHourUtc: 5 },
  { id: "breakfast", label: "Matin (UTC)", startHourUtc: 5, endHourUtc: 11 },
  { id: "lunch", label: "Déjeuner (UTC)", startHourUtc: 11, endHourUtc: 15 },
  { id: "afternoon", label: "Après-midi (UTC)", startHourUtc: 15, endHourUtc: 18 },
  { id: "dinner", label: "Dîner (UTC)", startHourUtc: 18, endHourUtc: 24 }
] as const;

export function buildAdminAnalyticsPanels(input: Input): AdminAnalyticsPanels {
  if (input.sourceComplete === false) return {
    currentDaily: unavailable(), dailyComparison: unavailable(), hourWeekday: unavailable(), categories: unavailable(),
    serviceWindows: unavailable(), ranking: unavailable(), searches: unavailable()
  };
  const current = daily(input.currentEvents);
  const previous = daily(input.previousEvents);
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
  const selectedCategories = input.selectedMenuCategorySlugs ? new Set(input.selectedMenuCategorySlugs) : null;
  const searches = countBy(input.currentEvents.filter((row) => stringValue(row, "event_name") === "search_used").map((row) => stringValue(row, "search_query").trim().toLocaleLowerCase("fr-CA")).filter((term) => term && !/@|\d{4,}/.test(term))).map(({ slug: term, count }) => ({ term, count }));
  const serviceWindows = serviceDefinitions.map((definition) => ({ ...definition, count: input.currentEvents.reduce((count, row) => { const hour = validDate(row)?.getUTCHours(); return count + (hour !== undefined && hour >= definition.startHourUtc && hour < definition.endHourUtc ? 1 : 0); }, 0) }));
  return {
    currentDaily: evidence(current, "no-current-events"),
    dailyComparison: input.currentDurationMs === input.previousDurationMs && current.length && previous.length ? { kind: "supported", data: { current, previous } } : { kind: "insufficient", reason: "incompatible-or-empty-period" },
    hourWeekday: evidence(hourWeekday, "no-timestamped-events"),
    categories: evidence(countBy(dishEvents.map((row) => stringValue(row, "category_slug")).filter((slug) => !selectedCategories || selectedCategories.has(slug))), "no-category-evidence"),
    serviceWindows: input.currentEvents.some(validDate) ? { kind: "supported", data: { timezone: "UTC", windows: serviceWindows } } : { kind: "insufficient", reason: "no-timestamped-events" },
    ranking: evidence(countBy(dishEvents.map((row) => stringValue(row, "dish_slug"))), "no-dish-ranking-evidence"),
    searches: evidence(searches, "no-search-evidence")
  };
}
