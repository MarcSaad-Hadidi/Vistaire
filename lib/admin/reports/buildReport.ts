import { compareAdminCountStates } from "../data/aggregateAnalytics.ts";
import type {
  AdminCountPayload,
  AdminMetricState,
  AdminRange,
  AdminRankingPayload,
  AdminSeriesPayload
} from "../data/contracts.ts";
import type { AdminEvidenceBundle, AdminEvidenceRecord, EvidenceId } from "../data/evidenceRegistry.ts";
import type { SearchTermEvidence } from "../data/searchPrivacy.ts";
import type {
  AdminReportEvidence,
  AdminReportLocale,
  AdminReportMetric,
  AdminReportModel,
  AdminReportPanel,
  AdminReportService
} from "./contracts.ts";
import { comparisonCopy, reportMetricLabel, reportStateCopy } from "./reportCopy.ts";

const METRICS = [
  "observed-menu-opens",
  "observed-dish-opens",
  "observed-immersive-intents",
  "observed-ar-intents",
  "observed-sessions",
  "catalog-dishes"
] as const;

const unavailableState = { kind: "unmeasured", reason: "unsupported-signal" } as const;

export function parseAdminReportFilters(input: Readonly<{ range?: unknown; service?: unknown }>): {
  range: AdminRange;
  service: AdminReportService;
} {
  const range = input.range === "today" || input.range === "7d" || input.range === "30d" ? input.range : "today";
  const service = input.service === "all" || input.service === "lunch" || input.service === "dinner"
    ? input.service
    : input.service === undefined
      ? "dinner"
      : "all";
  return { range, service };
}

function recordFor(bundle: AdminEvidenceBundle, metricId: string, period: AdminEvidenceRecord["period"]): AdminEvidenceRecord | null {
  return Object.values(bundle.records).find((record) =>
    record.metricId === metricId && record.period === period && record.audiences.includes("ui")
  ) ?? null;
}

function evidence<T>(
  locale: AdminReportLocale,
  service: AdminReportService,
  record: AdminEvidenceRecord | null,
  forcedState?: AdminMetricState<T>
): AdminReportEvidence<T> {
  const state = forcedState ?? (record?.state as AdminMetricState<T> | undefined) ?? unavailableState;
  return {
    state,
    value: state.kind === "available" ? state.value : null,
    evidenceIds: record ? [record.evidenceId] : [],
    copy: reportStateCopy(locale, state, service)
  };
}

function compatible(bundle: AdminEvidenceBundle, current: AdminEvidenceRecord, previous: AdminEvidenceRecord): boolean {
  if (current.metricId !== previous.metricId || current.definitionVersion !== previous.definitionVersion) return false;
  const expected = {
    source: bundle.scope.source,
    timezone: bundle.scope.timezone,
    alignment: bundle.window.alignment
  };
  for (const key of ["source", "timezone", "alignment"] as const) {
    const currentValue = current.provenance[key];
    const previousValue = previous.provenance[key];
    if (currentValue !== undefined && currentValue !== expected[key]) return false;
    if (previousValue !== undefined && previousValue !== expected[key]) return false;
    if (currentValue !== undefined && previousValue !== undefined && currentValue !== previousValue) return false;
  }
  return true;
}

function metric(bundle: AdminEvidenceBundle, locale: AdminReportLocale, service: AdminReportService, metricId: string): AdminReportMetric {
  const currentRecord = recordFor(bundle, metricId, metricId === "catalog-dishes" ? "snapshot" : "current");
  const previousRecord = recordFor(bundle, metricId, "previous");
  if (service !== "all") {
    const current = evidence<AdminCountPayload>(locale, service, currentRecord, unavailableState);
    return {
      metricId,
      label: reportMetricLabel(locale, metricId),
      current,
      comparison: evidence(locale, service, null, unavailableState)
    };
  }
  const current = evidence<AdminCountPayload>(locale, service, currentRecord);
  const comparisonState = currentRecord && previousRecord
    ? compareAdminCountStates({
      current: currentRecord.state as AdminMetricState<AdminCountPayload>,
      previous: previousRecord.state as AdminMetricState<AdminCountPayload>,
      compatible: compatible(bundle, currentRecord, previousRecord)
    })
    : { kind: "insufficient", reason: "comparison-unavailable" } as const;
  const comparisonEvidenceIds = [currentRecord?.evidenceId, previousRecord?.evidenceId].filter(Boolean) as EvidenceId[];
  return {
    metricId,
    label: reportMetricLabel(locale, metricId),
    current,
    comparison: {
      state: comparisonState,
      value: comparisonState.kind === "available" ? comparisonState.value : null,
      evidenceIds: comparisonEvidenceIds,
      copy: comparisonState.kind === "available"
        ? comparisonCopy(locale, comparisonState.value.changeRate)
        : reportStateCopy(locale, comparisonState, service)
    }
  };
}

function panel<T>(bundle: AdminEvidenceBundle, locale: AdminReportLocale, service: AdminReportService, metricId: string): AdminReportPanel<T> {
  const record = recordFor(bundle, metricId, "current");
  return service === "all" ? evidence<T>(locale, service, record) : evidence<T>(locale, service, record, unavailableState);
}
function searchPanel(bundle: AdminEvidenceBundle, locale: AdminReportLocale, service: AdminReportService): AdminReportPanel<readonly SearchTermEvidence[]> {
  const ranking = panel<AdminRankingPayload>(bundle, locale, service, "private-search-ranking");
  if (ranking.state.kind !== "available") {
    return { state: ranking.state, value: null, evidenceIds: ranking.evidenceIds, copy: ranking.copy };
  }
  const value = ranking.state.value.flatMap((item) => {
    const candidate = item as Readonly<{ key?: unknown; term?: unknown; count?: unknown }>;
    const term = typeof candidate.term === "string" ? candidate.term : typeof candidate.key === "string" ? candidate.key : null;
    return term && typeof candidate.count === "number" && Number.isFinite(candidate.count)
      ? [{ term, count: candidate.count }]
      : [];
  });
  if (value.length !== ranking.state.value.length) {
    const state = { kind: "error", code: "scope-integrity", retryable: false } as const;
    return { state, value: null, evidenceIds: ranking.evidenceIds, copy: reportStateCopy(locale, state, service) };
  }
  return { ...ranking, state: { kind: "available", value }, value };
}

function formatPercent(locale: AdminReportLocale, rate: number): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", { style: "percent", maximumFractionDigits: 0 }).format(rate);
}

export function buildAdminReport(input: {
  locale: AdminReportLocale;
  range: AdminRange;
  service: AdminReportService;
  bundle: AdminEvidenceBundle;
}): AdminReportModel {
  const metrics = METRICS.map((metricId) => metric(input.bundle, input.locale, input.service, metricId));
  const highlights = metrics
    .filter((item) => item.comparison.state.kind === "available")
    .slice(0, 4)
    .map((item) => {
      const value = item.comparison.value!;
      return {
        label: item.label,
        value: value.changeRate === null ? `${value.delta >= 0 ? "+" : ""}${value.delta}` : formatPercent(input.locale, value.changeRate),
        detail: item.comparison.copy,
        evidenceIds: item.comparison.evidenceIds
      };
    });
  const timeline = panel<AdminSeriesPayload>(input.bundle, input.locale, input.service, "activity-series");
  const topDishes = panel<AdminRankingPayload>(input.bundle, input.locale, input.service, "dish-ranking");
  const searches = searchPanel(input.bundle, input.locale, input.service);
  const availabilityChanges = evidence<readonly { label: string; state: string; occurredAt?: string }[]>(input.locale, input.service, null, unavailableState);
  const requiredEvidence = [
    ...metrics.map((item) => item.current),
    timeline,
    topDishes,
    searches,
    availabilityChanges
  ];
  const availableEvidence = requiredEvidence.filter((item) => item.state.kind === "available");
  const reliabilityState = availableEvidence.length === 0
    ? "unavailable"
    : availableEvidence.length === requiredEvidence.length
      ? "complete"
      : "limited";
  const recommendations = metrics
    .filter((item) => item.current.state.kind === "available")
    .slice(0, 3)
    .map((item, index) => ({
      label: input.locale === "fr" ? `Examiner ${item.label.toLocaleLowerCase("fr-CA")}` : `Review ${item.label.toLocaleLowerCase("en-CA")}`,
      href: (["/admin/insights", "/admin/availability", "/admin/more"] as const)[index],
      evidenceIds: item.current.evidenceIds
    }));

  return {
    locale: input.locale,
    range: input.range,
    service: input.service,
    window: input.bundle.window,
    highlights,
    metrics,
    timeline,
    topDishes,
    searches,
    availabilityChanges,
    reliability: {
      label: input.locale === "fr" ? "Fiabilité des preuves" : "Evidence reliability",
      state: reliabilityState,
      availableEvidence: availableEvidence.length,
      totalEvidence: requiredEvidence.length,
      evidenceIds: [...new Set(availableEvidence.flatMap((item) => item.evidenceIds))]
    },
    recommendations
  };
}
