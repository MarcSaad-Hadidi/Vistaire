import type { AdminAnalyticsState } from "@/lib/admin/analyticsState";

export type RealAdminAnalyticsState = Extract<AdminAnalyticsState, { kind: "real" }>;
export type InsufficientAdminAnalyticsState = Extract<AdminAnalyticsState, { kind: "insufficient" }>;
export type UnavailableAdminAnalyticsState = Extract<AdminAnalyticsState, { kind: "unavailable" }>;

const metricLabels: Record<RealAdminAnalyticsState["metrics"][number]["id"], string> = {
  "menu-opens": "Ouvertures du menu",
  "dish-opens": "Consultations de plats"
};

export function buildAnalyticsPresentation(state: AdminAnalyticsState) {
  switch (state.kind) {
    case "real": {
      const metrics = state.metrics.map((metric) => ({ ...metric, label: metricLabels[metric.id] ?? metric.id, unit: "événements" }));
      const activity = state.activitySeries.map((point) => ({ label: point.bucket, value: point.count }));
      const total = activity.reduce((sum, point) => sum + point.value, 0);
      return { kind: "real" as const, state, panels: state.panels, completeness: state.completeness, metrics, activity, observationWindow: state.observationWindow, summary: `${total} événements sur la période.`, lastUpdatedAt: state.lastUpdatedAt, freshness: state.freshness };
    }
    case "insufficient":
      return { kind: "insufficient" as const, reason: state.reason, completeness: state.completeness, title: "Donnée insuffisante", availableEvidence: state.availableEvidence, missingEvidence: state.missingEvidence };
    case "unavailable":
      return { kind: "unavailable" as const, reason: state.reason, completeness: state.completeness, title: state.title, explanation: state.explanation, retryable: state.retryable };
    default: return assertNever(state);
  }
}

function assertNever(value: never): never { throw new Error(`État analytics non pris en charge: ${String(value)}`); }
