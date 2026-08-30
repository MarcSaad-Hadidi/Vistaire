import type { AdminRestaurantAccessResult } from "../accessCore.ts";
import type { AdminEvidencePayload, AdminMetricId, AdminMetricState, AdminRange, ProductionAdminMetricScope } from "./contracts.ts";
import { buildAdminEvidenceBundle, type AdminEvidenceRecordInput } from "./evidenceRegistry.ts";
import { coversEntirePeriod, type AdminInstrumentationCoverage } from "./instrumentation.ts";
import { getAdminMetricDefinition } from "./metricDefinitions.ts";
import { aggregatePrivateSearchPeriod } from "./searchPrivacy.ts";
import { resolveAdminObservationWindow, resolveAdminTimeZone } from "./time.ts";

type GrantedAdminAccess = Extract<AdminRestaurantAccessResult, { ok: true }>;
type RestaurantRead = { ok: true; restaurant: null | { id: string; name: string; slug: string } } | { ok: false; code: string; retryable: boolean };
type MenuRead = { ok: true; menu: null | { id: string; restaurantId: string; settingsJson: unknown; updatedAt: string } } | { ok: false; code: string; retryable: boolean };
type CatalogRead = { ok: true; categories: readonly unknown[]; dishes: readonly unknown[] } | { ok: false; code: string; retryable: boolean };
type ObservedEvent = Readonly<{
  eventName?: string; event_name?: string; sessionId?: string; session_id?: string;
  dishSlug?: string; dish_slug?: string; categorySlug?: string; category_slug?: string;
  searchQuery?: string; search_query?: string; createdAt?: string; created_at?: string;
}>;
type EventRead = { ok: true; events: readonly ObservedEvent[]; truncated: boolean; observedRows: number; rowLimit: number } | { ok: false; code: string; retryable: boolean };

export type AdminDataDependencies = Readonly<{
  now: () => Date;
  readRestaurant: (input: { restaurantId: string }) => Promise<RestaurantRead>;
  readMenu: (input: { restaurantId: string }) => Promise<MenuRead>;
  readCatalog: (scope: ProductionAdminMetricScope) => Promise<CatalogRead>;
  readEvents: (input: { scope: ProductionAdminMetricScope; window: { from: string; to: string }; maxRows: number }) => Promise<EventRead>;
  coverages: readonly AdminInstrumentationCoverage[];
}>;

const errorState = (read: { code?: string; retryable?: boolean } | null): AdminMetricState<never> => ({
  kind: "error",
  code: read?.code === "scope-integrity" ? "scope-integrity" : read?.code === "database" ? "database" : "query",
  retryable: read?.retryable ?? true
});

const OBSERVED_METRICS = [
  "observed-menu-opens", "observed-dish-opens", "observed-immersive-intents",
  "observed-ar-intents", "observed-sessions", "dish-ranking", "category-ranking",
  "activity-series", "time-distribution", "private-search-ranking"
] as const satisfies readonly AdminMetricId[];

const eventValue = (event: ObservedEvent, camel: keyof ObservedEvent, snake: keyof ObservedEvent): string => {
  const value = event[camel] ?? event[snake];
  return typeof value === "string" ? value.trim() : "";
};

const rowValues = (row: unknown, ...keys: string[]): unknown[] => {
  if (!row || typeof row !== "object" || Array.isArray(row)) return [];
  return keys.map((key) => (row as Record<string, unknown>)[key]);
};

const rowHasAny = (row: unknown, ...keys: string[]): boolean => rowValues(row, ...keys).some((value) =>
  value === true || (typeof value === "string" && Boolean(value.trim()))
);

const rowMetadataHasAny = (row: unknown, ...keys: string[]): boolean => {
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;
  return rowHasAny((row as Record<string, unknown>).metadata, ...keys);
};

function ranking(values: readonly string[], minimumSample = 0): AdminMetricState<AdminEvidencePayload> {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const key = raw.trim().toLocaleLowerCase("fr-CA").slice(0, 80);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size === 0) return { kind: "insufficient", reason: "no-events" };
  const admitted = [...counts].filter(([, count]) => count >= minimumSample)
    .sort(([leftKey, leftCount], [rightKey, rightCount]) => rightCount - leftCount || leftKey.localeCompare(rightKey, "fr-CA"));
  if (admitted.length === 0) return { kind: "insufficient", reason: minimumSample > 0 ? "privacy-threshold" : "no-events" };
  return { kind: "available", value: admitted.map(([key, count], index) => ({ key, count, rank: index + 1 })) };
}

function localHourSeries(events: readonly ObservedEvent[], timezone: string): AdminMetricState<AdminEvidencePayload> {
  const formatter = new Intl.DateTimeFormat("fr-CA", { timeZone: timezone, hour: "2-digit", hourCycle: "h23" });
  const counts = new Map<string, number>();
  for (const event of events) {
    const createdAt = eventValue(event, "createdAt", "created_at");
    if (!Number.isFinite(Date.parse(createdAt))) continue;
    const hour = formatter.formatToParts(new Date(createdAt)).find((part) => part.type === "hour")?.value;
    if (!hour) continue;
    const key = `${hour.padStart(2, "0")}:00`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size === 0) return { kind: "insufficient", reason: "no-events" };
  return { kind: "available", value: [...counts].sort(([left], [right]) => left.localeCompare(right)).map(([key, count]) => ({ key, count })) };
}

function localWeekdayHourSeries(events: readonly ObservedEvent[], timezone: string): AdminMetricState<AdminEvidencePayload> {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  });
  const counts = new Map<string, number>();
  for (const event of events) {
    const createdAt = eventValue(event, "createdAt", "created_at");
    if (!Number.isFinite(Date.parse(createdAt))) continue;
    const parts = new Map(formatter.formatToParts(new Date(createdAt)).map((part) => [part.type, part.value]));
    const year = Number(parts.get("year"));
    const month = Number(parts.get("month"));
    const day = Number(parts.get("day"));
    const hour = parts.get("hour");
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || !hour) continue;
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const key = `${weekday}:${hour.padStart(2, "0")}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size === 0) return { kind: "insufficient", reason: "no-events" };
  return { kind: "available", value: [...counts].sort(([left], [right]) => left.localeCompare(right)).map(([key, count]) => ({ key, count })) };
}

function observedGate(input: {
  metricId: AdminMetricId;
  read: EventRead | null;
  bounds: { from: string; to: string };
  coverages: readonly AdminInstrumentationCoverage[];
  timezoneConfigured: boolean;
}): AdminMetricState<never> | null {
  if (!input.timezoneConfigured) return { kind: "unavailable", reason: "timezone-unconfigured" };
  if (!input.read?.ok) return errorState(input.read);
  if (input.read.truncated) return { kind: "truncated", observedRows: input.read.observedRows, rowLimit: input.read.rowLimit };
  const definition = getAdminMetricDefinition(input.metricId);
  if (!definition.signal) return { kind: "unmeasured", reason: "unsupported-signal" };
  const covered = definition.requiredRenderers.every((renderer) => {
    const coverage = input.coverages.find((item) => item.renderer === renderer);
    return Boolean(coverage && coversEntirePeriod(coverage, input.bounds, definition.signal));
  });
  return covered ? null : { kind: "unmeasured", reason: "instrumentation-unverified" };
}

function derivedObservedState(
  metricId: AdminMetricId,
  events: readonly ObservedEvent[],
  timezone: string,
  bounds: { from: string; to: string }
): AdminMetricState<AdminEvidencePayload> {
  const definition = getAdminMetricDefinition(metricId);
  if (metricId === "observed-sessions") {
    const sessions = new Set(events
      .filter((event) => eventValue(event, "eventName", "event_name") === definition.signal)
      .map((event) => eventValue(event, "sessionId", "session_id"))
      .filter(Boolean));
    return { kind: "available", value: { count: sessions.size } };
  }
  if (metricId === "dish-ranking") return ranking(events.filter((event) => eventValue(event, "eventName", "event_name") === "dish_opened").map((event) => eventValue(event, "dishSlug", "dish_slug")));
  if (metricId === "category-ranking") return ranking(events.filter((event) => eventValue(event, "eventName", "event_name") === "dish_opened").map((event) => eventValue(event, "categorySlug", "category_slug")));
  if (metricId === "private-search-ranking") {
    const privateSearch = aggregatePrivateSearchPeriod({ events, bounds, minimumDistinctSessions: 3, audience: "mistral" });
    return privateSearch.kind === "available"
      ? { kind: "available", value: privateSearch.value.map((item, index) => ({ key: item.term, count: item.count, rank: index + 1 })) }
      : privateSearch;
  }
  if (metricId === "time-distribution") {
    return localWeekdayHourSeries(events.filter((event) => eventValue(event, "eventName", "event_name") === definition.signal), timezone);
  }
  if (metricId === "activity-series") {
    return localHourSeries(events.filter((event) => eventValue(event, "eventName", "event_name") === definition.signal), timezone);
  }
  const count = events.filter((event) => eventValue(event, "eventName", "event_name") === definition.signal).length;
  return count > 0 && count < definition.minimumSample
    ? { kind: "insufficient", reason: "sample-too-small" }
    : { kind: "available", value: { count } };
}

function evidence(input: {
  metricId: AdminEvidenceRecordInput["metricId"];
  period: AdminEvidenceRecordInput["period"];
  state: AdminEvidenceRecordInput["state"];
  generatedAt: string;
  sourceUpdatedAt: string | null;
}): AdminEvidenceRecordInput {
  return {
    metricId: input.metricId,
    definitionVersion: getAdminMetricDefinition(input.metricId).definitionVersion,
    labelKey: `metrics.${input.metricId}`,
    state: input.state,
    period: input.period,
    provenance: { source: "production", trust: input.metricId.startsWith("catalog-") ? "catalog" : "observed" },
    freshness: { generatedAt: input.generatedAt, sourceUpdatedAt: input.sourceUpdatedAt },
    sample: { state: input.state.kind },
    privacy: { classification: "aggregate", promptUnsafe: false },
    audiences: ["ui", "export", "mistral"]
  };
}

export async function loadAdminDataBundleWithDependencies(
  input: { access: GrantedAdminAccess; range: AdminRange },
  dependencies: AdminDataDependencies
) {
  const restaurantRead = await dependencies.readRestaurant({ restaurantId: input.access.restaurantId });
  if (!restaurantRead.ok || !restaurantRead.restaurant ||
      restaurantRead.restaurant.id !== input.access.restaurantId ||
      !restaurantRead.restaurant.name.trim() || !restaurantRead.restaurant.slug.trim()) {
    return { ok: false as const, error: { code: "configuration" as const, retryable: false } };
  }
  const menuRead = await dependencies.readMenu({ restaurantId: input.access.restaurantId });
  if (!menuRead.ok || !menuRead.menu || menuRead.menu.restaurantId !== input.access.restaurantId) {
    return { ok: false as const, error: { code: "configuration" as const, retryable: false } };
  }
  const timezoneResolution = resolveAdminTimeZone(menuRead.menu.settingsJson);
  const scope: ProductionAdminMetricScope = {
    restaurantId: input.access.restaurantId,
    menuId: menuRead.menu.id,
    source: "production",
    timezone: timezoneResolution.timezone
  };
  const observedAt = dependencies.now();
  const window = resolveAdminObservationWindow({ range: input.range, observedAt, timezone: scope.timezone });

  let catalog: CatalogRead | null = null;
  let current: EventRead | null = null;
  let previous: EventRead | null = null;
  try { catalog = await dependencies.readCatalog(scope); } catch { catalog = null; }
  try { current = await dependencies.readEvents({ scope, window: window.current, maxRows: 10_000 }); } catch { current = null; }
  try { previous = await dependencies.readEvents({ scope, window: window.previous, maxRows: 10_000 }); } catch { previous = null; }

  const records: AdminEvidenceRecordInput[] = [];
  const catalogStates: ReadonlyArray<readonly [AdminMetricId, AdminMetricState<AdminEvidencePayload>]> = catalog?.ok ? [
    ["catalog-dishes", { kind: "available", value: { count: catalog.dishes.length } }],
    ["catalog-photos", { kind: "available", value: { count: catalog.dishes.filter((dish) => rowHasAny(dish, "image_url", "imageUrl") || rowMetadataHasAny(dish, "photoStoragePath", "photo_storage_path")).length } }],
    ["catalog-immersive-assets", { kind: "available", value: { count: catalog.dishes.filter((dish) => rowHasAny(dish, "has_immersive_view", "hasImmersiveView") || rowMetadataHasAny(dish, "model3dUrl", "model_3d_url", "webModel3dUrl", "web_model_3d_url", "arModel3dUrl", "ar_model_3d_url", "usdzUrl", "usdz_url", "arUsdzUrl", "ar_usdz_url", "webModel3dStoragePath", "web_model_3d_storage_path", "arModel3dStoragePath", "ar_model_3d_storage_path", "arUsdzStoragePath", "ar_usdz_storage_path", "usdzStoragePath", "usdz_storage_path")).length } }]
  ] : ["catalog-dishes", "catalog-photos", "catalog-immersive-assets"].map((metricId) => [metricId as AdminMetricId, errorState(catalog)] as const);
  for (const [metricId, state] of catalogStates) records.push(evidence({ metricId, period: "snapshot", generatedAt: window.observedAt, sourceUpdatedAt: menuRead.menu.updatedAt, state }));

  for (const [period, read, bounds] of [["current", current, window.current], ["previous", previous, window.previous]] as const) {
    for (const metricId of OBSERVED_METRICS) {
      const gate = observedGate({ metricId, read, bounds, coverages: dependencies.coverages, timezoneConfigured: timezoneResolution.kind !== "fallback" });
      const state = gate ?? derivedObservedState(metricId, read?.ok ? read.events : [], scope.timezone, bounds);
      records.push(evidence({ metricId, period, state, generatedAt: window.observedAt, sourceUpdatedAt: null }));
    }
  }

  const bundle = buildAdminEvidenceBundle({ scope, window, generatedAt: window.observedAt, records });
  return {
    ok: true as const,
    bundle,
    timezoneResolution,
    presentation: {
      restaurantName: restaurantRead.restaurant.name.trim(),
      publicMenuPath: `/menu/${encodeURIComponent(restaurantRead.restaurant.slug.trim())}`
    }
  };
}

export async function loadAdminDataBundle(access: GrantedAdminAccess, range: AdminRange) {
  const repository = await import("./repository.ts");
  const visualFixture = process.env.NODE_ENV !== "production" && process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE === "1";
  const fixtureNow = visualFixture && process.env.VISTAIRE_ADMIN_VISUAL_NOW ? new Date(process.env.VISTAIRE_ADMIN_VISUAL_NOW) : null;
  const fixtureCoverages: readonly AdminInstrumentationCoverage[] = visualFixture ? (["public-menu", "maison-elyse", "trouvable"] as const).map((renderer) => ({
    version: "admin-vnext-observed-v1", renderer, source: "production",
    coverageStartAt: "2020-01-01T00:00:00.000Z", coverageEndAt: "2100-01-01T00:00:00.000Z",
    proof: { kind: "verified-deployment", deploymentId: `visual-fixture-${renderer}` },
    signals: { menu_opened: "covered", category_viewed: "covered", dish_opened: "covered", dish_3d_clicked: "covered", dish_ar_clicked: "covered", search_used: "covered" }
  })) : [];
  return loadAdminDataBundleWithDependencies({ access, range }, {
    now: () => fixtureNow && Number.isFinite(fixtureNow.getTime()) ? fixtureNow : new Date(),
    readRestaurant: repository.readProductionAdminRestaurant,
    readMenu: repository.readProductionAdminMenu,
    readCatalog: repository.readProductionAdminCatalog,
    readEvents: repository.readProductionAdminEvents,
    coverages: fixtureCoverages
  });
}
