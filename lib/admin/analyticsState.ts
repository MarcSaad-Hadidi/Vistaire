import type { AdminObservationWindow } from "./dashboardRange.ts";
import { addComparisonEvidence, type AdminRawMetric } from "./analyticsEvidence.ts";

type FinalAdminAnalyticsState =
  | { kind: "real"; completeness: "complete" | "limited-sample"; observationWindow: AdminObservationWindow; lastUpdatedAt: string | null; freshness: "fresh" | "delayed" | "stale"; coverage: Record<string, boolean>; metrics: ReturnType<typeof addComparisonEvidence>[]; activitySeries: unknown[]; categoryBreakdown: unknown[]; topDishes: unknown[]; searches: unknown[]; immersive: unknown[]; funnel: { kind: "unsupported" | "measured" }; comparison: null | Record<string, unknown> }
  | { kind: "insufficient"; reason: "no-relevant-events" | "sample-too-small" | "instrumentation-unproven"; completeness: "complete" | "limited-sample"; observationWindow: AdminObservationWindow; availableEvidence: unknown[]; missingEvidence: string[] }
  | { kind: "unavailable"; reason: "configuration" | "database" | "query"; completeness: "truncated" | "partial-source"; title: string; explanation: string; retryable: boolean };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- temporary type-only bridge for the separately owned UI branch
export type AdminAnalyticsState<T = never> = [T] extends [never] ? FinalAdminAnalyticsState : any;

export type AdminAnalyticsInput = { observationWindow: AdminObservationWindow; instrumentationProven?: boolean; eventCount?: number; databaseError?: boolean; queryError?: boolean; truncated?: boolean; partialSource?: boolean; lastUpdatedAt?: string | null; metrics?: AdminRawMetric[] };

export function buildAdminAnalyticsState(input: AdminAnalyticsInput): AdminAnalyticsState {
  if (input.databaseError || input.queryError || input.truncated || input.partialSource) return { kind: "unavailable", reason: input.databaseError ? "database" : "query", completeness: input.truncated ? "truncated" : "partial-source", title: "Données indisponibles", explanation: input.partialSource || input.queryError ? "Une source est indisponible." : "La lecture est incomplète.", retryable: true };
  const count = input.eventCount ?? 0;
  if (!input.instrumentationProven || count === 0 || count < 5) return { kind: "insufficient", reason: !input.instrumentationProven ? "instrumentation-unproven" : count === 0 ? "no-relevant-events" : "sample-too-small", completeness: count > 0 ? "limited-sample" : "complete", observationWindow: input.observationWindow, availableEvidence: [], missingEvidence: [] };
  const lastUpdatedAt = input.lastUpdatedAt ?? null;
  const age = lastUpdatedAt ? Date.now() - new Date(lastUpdatedAt).getTime() : Infinity;
  return { kind: "real", completeness: count < 20 ? "limited-sample" : "complete", observationWindow: input.observationWindow, lastUpdatedAt, freshness: age <= 3_600_000 ? "fresh" : age <= 86_400_000 ? "delayed" : "stale", coverage: { menu: true, dish: true }, metrics: (input.metrics ?? []).map(addComparisonEvidence), activitySeries: [], categoryBreakdown: [], topDishes: [], searches: [], immersive: [], funnel: { kind: "unsupported" }, comparison: null };
}
