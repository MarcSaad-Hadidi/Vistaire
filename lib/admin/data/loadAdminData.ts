import type { AdminRestaurantAccessResult } from "../accessCore.ts";
import { aggregateObservedMetric } from "./aggregateAnalytics.ts";
import type { AdminMetricState, AdminRange, ProductionAdminMetricScope } from "./contracts.ts";
import { buildAdminEvidenceBundle, type AdminEvidenceRecordInput } from "./evidenceRegistry.ts";
import type { AdminInstrumentationCoverage } from "./instrumentation.ts";
import { resolveAdminObservationWindow, resolveAdminTimeZone } from "./time.ts";

type GrantedAdminAccess = Extract<AdminRestaurantAccessResult, { ok: true }>;
type MenuRead = { ok: true; menu: null | { id: string; restaurantId: string; settingsJson: unknown; updatedAt: string } } | { ok: false; code: string; retryable: boolean };
type CatalogRead = { ok: true; categories: readonly unknown[]; dishes: readonly unknown[] } | { ok: false; code: string; retryable: boolean };
type EventRead = { ok: true; events: readonly Readonly<{ eventName?: string; event_name?: string }>[]; truncated: boolean; observedRows: number; rowLimit: number } | { ok: false; code: string; retryable: boolean };

export type AdminDataDependencies = Readonly<{
  now: () => Date;
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

function evidence(input: {
  metricId: AdminEvidenceRecordInput["metricId"];
  period: AdminEvidenceRecordInput["period"];
  state: AdminEvidenceRecordInput["state"];
  generatedAt: string;
  sourceUpdatedAt: string | null;
}): AdminEvidenceRecordInput {
  return {
    metricId: input.metricId,
    definitionVersion: "admin-vnext-observed-v1",
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
  records.push(evidence({
    metricId: "catalog-dishes", period: "snapshot", generatedAt: window.observedAt,
    sourceUpdatedAt: menuRead.menu.updatedAt,
    state: catalog?.ok ? { kind: "available", value: { count: catalog.dishes.length } } : errorState(catalog)
  }));

  for (const [period, read, bounds] of [["current", current, window.current], ["previous", previous, window.previous]] as const) {
    let state: AdminEvidenceRecordInput["state"];
    if (timezoneResolution.kind === "fallback") {
      state = { kind: "unavailable", reason: "timezone-unconfigured" };
    } else if (!read?.ok) {
      state = errorState(read);
    } else {
      state = aggregateObservedMetric({
        eventName: "menu_opened", signal: "menu_opened",
        requiredRenderers: ["public-menu", "maison-elyse", "trouvable"],
        bounds, coverages: dependencies.coverages, events: read.events,
        truncated: read.truncated, observedRows: read.observedRows, rowLimit: read.rowLimit
      });
    }
    records.push(evidence({ metricId: "observed-menu-opens", period, state, generatedAt: window.observedAt, sourceUpdatedAt: null }));
  }

  const bundle = buildAdminEvidenceBundle({ scope, window, generatedAt: window.observedAt, records });
  return { ok: true as const, bundle, timezoneResolution };
}

export async function loadAdminDataBundle(access: GrantedAdminAccess, range: AdminRange) {
  const repository = await import("./repository.ts");
  return loadAdminDataBundleWithDependencies({ access, range }, {
    now: () => new Date(),
    readMenu: repository.readProductionAdminMenu,
    readCatalog: repository.readProductionAdminCatalog,
    readEvents: repository.readProductionAdminEvents,
    coverages: []
  });
}
