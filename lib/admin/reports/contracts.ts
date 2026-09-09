import type {
  AdminMetricState,
  AdminRange,
  AdminSeriesPayload,
  AdminRankingPayload
} from "../data/contracts.ts";
import type { EvidenceId } from "../data/evidenceRegistry.ts";
import type { AdminObservationWindow } from "../data/time.ts";
import type { SearchTermEvidence } from "../data/searchPrivacy.ts";

export type AdminReportService = "all" | "lunch" | "dinner";
export type AdminReportLocale = "fr" | "en";
export type AdminReportComparisonValue = Readonly<{
  count: number;
  previousCount: number;
  delta: number;
  changeRate: number | null;
}>;
export type AdminReportEvidence<T> = Readonly<{
  state: AdminMetricState<T>;
  value: T | null;
  evidenceIds: readonly EvidenceId[];
  copy: string;
}>;

export type AdminReportMetric = Readonly<{
  metricId: string;
  label: string;
  current: AdminReportEvidence<Readonly<{ count: number }>>;
  comparison: AdminReportEvidence<AdminReportComparisonValue>;
}>;

export type AdminRankedItem = Readonly<{ key: string; count: number; rank: number }>;
export type AvailabilityEvidence = Readonly<{ label: string; state: string; occurredAt?: string }>;
export type AdminReportPanel<T> = AdminReportEvidence<T>;

export type AdminReportHighlight = Readonly<{
  label: string;
  value: string;
  detail: string;
  evidenceIds: readonly EvidenceId[];
}>;

export type AdminReportReliability = Readonly<{
  label: string;
  state: "complete" | "limited" | "unavailable";
  availableEvidence: number;
  totalEvidence: number;
  evidenceIds: readonly EvidenceId[];
}>;

export type AdminReportRecommendation = Readonly<{
  label: string;
  href: "/admin/availability" | "/admin/insights" | "/admin/more";
  evidenceIds: readonly EvidenceId[];
}>;

export type AdminReportModel = Readonly<{
  locale: AdminReportLocale;
  range: AdminRange;
  service: AdminReportService;
  window: AdminObservationWindow;
  highlights: readonly AdminReportHighlight[];
  metrics: readonly AdminReportMetric[];
  timeline: AdminReportPanel<AdminSeriesPayload>;
  topDishes: AdminReportPanel<AdminRankingPayload>;
  searches: AdminReportPanel<readonly SearchTermEvidence[]>;
  availabilityChanges: AdminReportPanel<readonly AvailabilityEvidence[]>;
  reliability: AdminReportReliability;
  recommendations: readonly AdminReportRecommendation[];
}>;
