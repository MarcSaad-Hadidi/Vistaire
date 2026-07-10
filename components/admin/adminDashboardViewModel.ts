export type ObservationWindow = { label?: string; startedAt?: string; endedAt?: string; startInclusive?: string; endExclusive?: string };
export type Metric = { id: string; label?: string; value: number; unit?: string; changeRate?: number | null };
export type ActivityPoint = { label?: string; value?: number; bucket?: string; count?: number; unit?: string };
export type Evidence = unknown;

export type TargetAnalyticsState =
  | { kind: "real"; completeness: "complete" | "limited-sample"; observationWindow: ObservationWindow; lastUpdatedAt: string | null; freshness: "fresh" | "delayed" | "stale"; coverage: { provenance?: string; source?: string; menuOpened?: boolean; dishOpened?: boolean }; metrics: Metric[]; activitySeries: ActivityPoint[]; categoryBreakdown: unknown[]; topDishes: unknown[]; searches: unknown[]; immersive: unknown[]; funnel: unknown; comparison: unknown }
  | { kind: "insufficient"; reason: "no-relevant-events" | "sample-too-small" | "instrumentation-unproven"; completeness: "complete" | "limited-sample"; observationWindow: ObservationWindow; availableEvidence: Evidence[]; missingEvidence: string[] }
  | { kind: "unavailable"; reason: "configuration" | "database" | "query"; completeness: "truncated" | "partial-source"; title: string; explanation: string; retryable: boolean };

export function buildAnalyticsPresentation(state: TargetAnalyticsState) {
  switch (state.kind) {
    case "real": {
      const activity = state.activitySeries.map((point) => ({ label: point.label ?? point.bucket ?? "Période", value: point.value ?? point.count ?? 0, unit: point.unit }));
      const metrics = state.metrics.map((metric) => ({ ...metric, label: metric.label ?? metric.id, unit: metric.unit ?? "événements" }));
      const total = activity.reduce((sum, point) => sum + point.value, 0);
      const unit = state.activitySeries.find((point) => point.unit)?.unit ?? "événements";
      return { kind: "real" as const, completeness: state.completeness, metrics, activity, observationWindow: state.observationWindow, summary: `${total} ${unit} sur la période.`, provenance: state.coverage.provenance ?? state.coverage.source ?? "production", lastUpdatedAt: state.lastUpdatedAt, freshness: state.freshness };
    }
    case "insufficient":
      return { kind: "insufficient" as const, reason: state.reason, completeness: state.completeness, title: "Donnée insuffisante", availableEvidence: state.availableEvidence, missingEvidence: state.missingEvidence };
    case "unavailable":
      return { kind: "unavailable" as const, reason: state.reason, completeness: state.completeness, title: state.title, explanation: state.explanation, retryable: state.retryable };
    default: return assertNever(state);
  }
}

function assertNever(value: never): never { throw new Error(`État analytics non pris en charge: ${String(value)}`); }
