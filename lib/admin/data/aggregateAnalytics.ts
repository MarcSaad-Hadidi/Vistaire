import type { AdminCountPayload, AdminMetricState, AdminPeriodBounds } from "./contracts.ts";
import { coversEntirePeriod, type AdminInstrumentationCoverage, type AdminRendererId, type AdminSignalId } from "./instrumentation.ts";

export function aggregateObservedMetric(input: {
  eventName: string;
  signal: AdminSignalId;
  requiredRenderers: readonly AdminRendererId[];
  bounds: AdminPeriodBounds;
  coverages: readonly AdminInstrumentationCoverage[];
  events: readonly Readonly<{ eventName?: string; event_name?: string }>[];
  truncated: boolean;
  observedRows?: number;
  rowLimit?: number;
  minimumSample?: number;
}): AdminMetricState<AdminCountPayload> {
  if (input.truncated) return { kind: "truncated", observedRows: input.observedRows ?? input.events.length, rowLimit: input.rowLimit ?? input.events.length };
  const covered = input.requiredRenderers.every((renderer) => {
    const coverage = input.coverages.find((item) => item.renderer === renderer);
    return Boolean(coverage && coversEntirePeriod(coverage, input.bounds, input.signal));
  });
  if (!covered) return { kind: "unmeasured", reason: "instrumentation-unverified" };
  const count = input.events.filter((event) => (event.eventName ?? event.event_name) === input.eventName).length;
  if (count > 0 && count < (input.minimumSample ?? 0)) return { kind: "insufficient", reason: "sample-too-small" };
  return { kind: "available", value: { count } };
}

export function compareAdminCountStates(input: {
  current: AdminMetricState<AdminCountPayload>;
  previous: AdminMetricState<AdminCountPayload>;
  compatible: boolean;
}): AdminMetricState<Readonly<{ count: number; previousCount: number; delta: number; changeRate: number | null }>> {
  if (!input.compatible || input.current.kind !== "available" || input.previous.kind !== "available") {
    return { kind: "insufficient", reason: "comparison-unavailable" };
  }
  const count = input.current.value.count;
  const previousCount = input.previous.value.count;
  return { kind: "available", value: {
    count, previousCount, delta: count - previousCount,
    changeRate: previousCount === 0 ? null : (count - previousCount) / previousCount
  } };
}
