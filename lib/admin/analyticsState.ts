import type { AdminObservationWindow } from "./dashboardRange.ts";
import { addComparisonEvidence, type AdminRawMetric } from "./analyticsEvidence.ts";

type EvidenceInput = {
  observationWindow: AdminObservationWindow;
  instrumentationProven?: boolean;
  eventCount?: number;
  databaseError?: boolean;
  queryError?: boolean;
  truncated?: boolean;
  partialSource?: boolean;
  lastUpdatedAt?: string | null;
  metrics?: AdminRawMetric[];
};

type HonestAdminAnalyticsState =
  | { kind: "real"; completeness: "complete" | "limited-sample"; observationWindow: AdminObservationWindow; lastUpdatedAt: string | null; metrics: ReturnType<typeof addComparisonEvidence>[] }
  | { kind: "insufficient"; reason: "no-relevant-events" | "sample-too-small" | "instrumentation-unproven"; completeness: "complete" | "limited-sample"; observationWindow: AdminObservationWindow; availableEvidence: unknown[]; missingEvidence: string[] }
  | { kind: "unavailable"; reason: "configuration" | "database" | "query"; completeness: "truncated" | "partial-source"; title: string; explanation: string; retryable: boolean };

type LegacyAdminAnalyticsState<T> =
  | { kind: "real"; note: string; insights: T }
  | { kind: "partial"; title: string; message: string; note: string; insights: T }
  | { kind: "empty" | "preview"; title: string; message: string };

export type AdminAnalyticsState<T = never> = [T] extends [never]
  ? HonestAdminAnalyticsState
  : LegacyAdminAnalyticsState<T>;

export function buildAdminAnalyticsState(input: EvidenceInput): AdminAnalyticsState;
export function buildAdminAnalyticsState<T>(input: { source: "real" | "partial" | "empty" | "preview"; note: string; insights: T }): AdminAnalyticsState<T>;
export function buildAdminAnalyticsState(input: any): any {
  if (input.source) {
    if (input.source === "real") return { kind: "real", note: input.note, insights: input.insights };
    if (input.source === "partial") return { kind: "partial", title: "Données en cours de consolidation", message: "Données réelles — échantillon encore limité.", note: input.note, insights: input.insights };
    if (input.source === "preview") return { kind: "preview", title: "Prévisualisation locale", message: "Les chiffres de présentation restent masqués." };
    return { kind: "empty", title: "Pas encore de données d’activité", message: "Les premières tendances apparaîtront après les prochaines consultations." };
  }
  if (input.databaseError || input.queryError || input.truncated || input.partialSource) {
    const partial = input.partialSource || input.queryError;
    return { kind: "unavailable", reason: input.databaseError ? "database" : "query", completeness: input.truncated ? "truncated" : "partial-source", title: "Données indisponibles", explanation: partial ? "Une source est indisponible." : "La lecture est incomplète.", retryable: true };
  }
  const count = input.eventCount ?? 0;
  if (!input.instrumentationProven || count === 0) {
    return { kind: "insufficient", reason: input.instrumentationProven ? "no-relevant-events" : "instrumentation-unproven", completeness: "complete", observationWindow: input.observationWindow, availableEvidence: [], missingEvidence: [] };
  }
  const completeness = count < 20 ? "limited-sample" : "complete";
  return { kind: "real", completeness, observationWindow: input.observationWindow, lastUpdatedAt: input.lastUpdatedAt ?? null, metrics: (input.metrics ?? []).map(addComparisonEvidence) };
}
