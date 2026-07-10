export type ObservationWindow = { label?: string; startedAt: string; endedAt: string };
export type Metric = { id: string; label: string; value: number; unit: string };
export type ActivityPoint = { label: string; value: number; unit?: string };
export type Evidence = { label: string; value: number | string };

export type TargetAnalyticsState =
  | { kind: "real"; completeness: "complete" | "limited-sample"; observationWindow: ObservationWindow; lastUpdatedAt: string | null; freshness: "fresh" | "delayed" | "stale"; coverage: { provenance?: string; source?: string }; metrics: Metric[]; activitySeries: ActivityPoint[]; categoryBreakdown: unknown[]; topDishes: unknown[]; searches: unknown[]; immersive: unknown[]; funnel: unknown; comparison: unknown }
  | { kind: "insufficient"; reason: "no-relevant-events" | "sample-too-small" | "instrumentation-unproven"; completeness: "complete" | "limited-sample"; observationWindow: ObservationWindow; availableEvidence: Evidence[]; missingEvidence: string[] }
  | { kind: "unavailable"; reason: "configuration" | "database" | "query"; completeness: "truncated" | "partial-source"; title: string; explanation: string; retryable: boolean };

export function buildAnalyticsPresentation(state: TargetAnalyticsState) {
  switch (state.kind) {
    case "real": {
      const total = state.activitySeries.reduce((sum, point) => sum + point.value, 0);
      const unit = state.activitySeries.find((point) => point.unit)?.unit ?? "événements";
      return { kind: "real" as const, completeness: state.completeness, metrics: state.metrics, activity: state.activitySeries, observationWindow: state.observationWindow, summary: `${total} ${unit} sur la période.`, provenance: state.coverage.provenance ?? state.coverage.source ?? "production", lastUpdatedAt: state.lastUpdatedAt, freshness: state.freshness };
    }
    case "insufficient":
      return { kind: "insufficient" as const, reason: state.reason, completeness: state.completeness, title: "Donnée insuffisante", availableEvidence: state.availableEvidence, missingEvidence: state.missingEvidence };
    case "unavailable":
      return { kind: "unavailable" as const, reason: state.reason, completeness: state.completeness, title: state.title, explanation: state.explanation, retryable: state.retryable };
    default: return assertNever(state);
  }
}

function assertNever(value: never): never { throw new Error(`État analytics non pris en charge: ${String(value)}`); }

type Presentation = ReturnType<typeof buildAnalyticsPresentation>;
const escapeHtml = (value: unknown) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
export function renderAnalyticsDom(p: Presentation): string {
  switch (p.kind) {
    case "real": return `<section data-state="real"><p>${escapeHtml(p.observationWindow.label ?? `${p.observationWindow.startedAt} — ${p.observationWindow.endedAt} UTC`)}</p><p>Dernière mise à jour: <time>${escapeHtml(p.lastUpdatedAt ?? "Non disponible")}</time> · ${p.freshness}</p><div class="bars">${p.activity.map(point => `<span data-bar-value="${point.value}">${escapeHtml(point.label)}</span>`).join("")}</div><table><tbody>${p.activity.map(point => `<tr><th>${escapeHtml(point.label)}</th><td>${point.value}</td></tr>`).join("")}</tbody></table></section>`;
    case "insufficient": return `<section role="status" data-reason="${p.reason}"><strong>${p.title}</strong><ul>${p.missingEvidence.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>`;
    case "unavailable": return `<section role="alert" data-reason="${p.reason}"><strong>${escapeHtml(p.title)}</strong><p>${escapeHtml(p.explanation)}</p></section>`;
    default: return assertNever(p);
  }
}
