import type {
  AdminEvidencePayload,
  AdminMetricId,
  AdminMetricState,
  AdminRankingEntry,
  AdminSeriesPoint
} from "../../../lib/admin/data/contracts.ts";
import type {
  AdminEvidenceBundle,
  AdminEvidenceRecord,
  EvidenceId
} from "../../../lib/admin/data/evidenceRegistry.ts";
import type { AdminLocale } from "../../../lib/admin/foundationRoutes.ts";
import { TODAY_COPY, todayMetricLabel, todayStateCopy } from "./todayCopy.ts";

type TodayEvidenceState = AdminMetricState<AdminEvidencePayload>;

export type TodayMetricCard = Readonly<{
  metricId: AdminMetricId;
  evidenceId: EvidenceId | null;
  state: TodayEvidenceState;
  label: string;
  value: number | null;
  displayValue: string;
  rawValue: unknown;
  changeRate?: number | null;
  changeLabel: string | null;
  provenance: string;
}>;

export type TodayBriefingItem = Readonly<{
  metricId: AdminMetricId;
  evidenceId: EvidenceId | null;
  state: TodayEvidenceState;
  label: string;
  summary: string;
}>;

export type TodayActivityModel = Readonly<{
  points: readonly AdminSeriesPoint[];
}>;

export type TodayAlertItem = Readonly<{
  key: string;
  label: string;
  detail: string;
}>;

export type TodayDishRank = Readonly<{
  key: string;
  label: string;
  count: number;
  rank: number;
}>;

export type TodayTimelineItem = Readonly<{
  key: string;
  label: string;
  count: number;
}>;

export type TodaySearchItem = TodayDishRank;

export type TodayPanelState<T> = Readonly<{
  evidenceId: EvidenceId | null;
  state: TodayEvidenceState;
  data: T | null;
  message: string | null;
}>;

export type TodayMenuHealthModel = Readonly<{
  evidenceId: EvidenceId | null;
  state: TodayEvidenceState;
  totalDishes: number | null;
  label: string;
  message: string | null;
}>;

export type TodayViewModel = Readonly<{
  locale: AdminLocale;
  generatedAt: string;
  briefing: readonly TodayBriefingItem[];
  pulse: readonly TodayMetricCard[];
  activity: TodayPanelState<TodayActivityModel>;
  alerts: TodayPanelState<readonly TodayAlertItem[]>;
  topDishes: TodayPanelState<readonly TodayDishRank[]>;
  timeline: TodayPanelState<readonly TodayTimelineItem[]>;
  searches: TodayPanelState<readonly TodaySearchItem[]>;
  menuHealth: TodayMenuHealthModel;
}>;

const PULSE_METRICS = [
  "observed-sessions",
  "observed-menu-opens",
  "observed-dish-opens",
  "observed-immersive-intents",
  "private-search-ranking",
  "catalog-dishes"
] as const satisfies readonly AdminMetricId[];

const missingState = {
  kind: "unmeasured",
  reason: "unsupported-signal"
} as const satisfies TodayEvidenceState;

function findUiEvidence(
  bundle: AdminEvidenceBundle,
  metricId: AdminMetricId,
  preferredPeriods: readonly AdminEvidenceRecord["period"][] = ["current", "snapshot", "previous"]
): AdminEvidenceRecord | null {
  const records = Object.values(bundle.records).filter(
    (record) => record.metricId === metricId && record.audiences.includes("ui")
  );
  for (const period of preferredPeriods) {
    const record = records.find((candidate) => candidate.period === period);
    if (record) return record;
  }
  return null;
}

function numericCount(value: unknown): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const count = (value as { count?: unknown }).count;
  return typeof count === "number" && Number.isFinite(count) ? count : null;
}

function comparisonRate(value: unknown): number | null | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value) || !("changeRate" in value)) return undefined;
  const rate = (value as { changeRate?: unknown }).changeRate;
  if (rate === null) return null;
  return typeof rate === "number" && Number.isFinite(rate) ? rate : undefined;
}

function stateMessage(locale: AdminLocale, state: TodayEvidenceState): string | null {
  return state.kind === "available" ? null : todayStateCopy(locale, state);
}

function provenance(locale: AdminLocale, record: AdminEvidenceRecord | null): string {
  return record?.provenance.trust === "catalog"
    ? TODAY_COPY[locale].provenanceCatalog
    : TODAY_COPY[locale].provenanceObserved;
}

function metricCard(locale: AdminLocale, bundle: AdminEvidenceBundle, metricId: AdminMetricId): TodayMetricCard {
  const record = findUiEvidence(bundle, metricId);
  const state = record?.state ?? missingState;
  const rawValue = state.kind === "available" ? state.value : null;
  const value = state.kind === "available" ? numericCount(state.value) : null;
  const changeRate = state.kind === "available" ? comparisonRate(state.value) : undefined;
  const formatter = new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA");
  const displayValue = value === null ? TODAY_COPY[locale].unavailableValue : formatter.format(value);
  const changeLabel = changeRate === undefined
    ? null
    : changeRate === null
      ? TODAY_COPY[locale].comparedPeriod
      : new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", {
          style: "percent",
          maximumFractionDigits: 0,
          signDisplay: "exceptZero"
        }).format(changeRate);

  return {
    metricId,
    evidenceId: record?.evidenceId ?? null,
    state,
    label: todayMetricLabel(locale, metricId),
    value,
    displayValue,
    rawValue,
    changeRate,
    changeLabel,
    provenance: provenance(locale, record)
  };
}

function panelState<T>(
  locale: AdminLocale,
  record: AdminEvidenceRecord | null,
  map: (value: AdminEvidencePayload) => T | null
): TodayPanelState<T> {
  const state = record?.state ?? missingState;
  if (!record || state.kind !== "available") {
    return { evidenceId: record?.evidenceId ?? null, state, data: null, message: stateMessage(locale, state) };
  }
  const data = map(state.value);
  if (data === null) {
    return { evidenceId: record.evidenceId, state: missingState, data: null, message: todayStateCopy(locale, missingState) };
  }
  return { evidenceId: record.evidenceId, state, data, message: null };
}

function isSeries(value: AdminEvidencePayload): value is readonly AdminSeriesPoint[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as { key?: unknown; count?: unknown };
    return typeof candidate.key === "string" && typeof candidate.count === "number";
  });
}

function isRanking(value: AdminEvidencePayload): value is readonly AdminRankingEntry[] {
  return isSeries(value) && value.every((item) => typeof (item as { rank?: unknown }).rank === "number");
}

export function buildTodayViewModel(input: {
  locale: AdminLocale;
  bundle: AdminEvidenceBundle;
}): TodayViewModel {
  const { locale, bundle } = input;
  const pulse = PULSE_METRICS.map((metricId) => metricCard(locale, bundle, metricId));
  const briefing = ["observed-menu-opens", "dish-ranking", "catalog-dishes"].map((metricId) => {
    const card = metricCard(locale, bundle, metricId as AdminMetricId);
    return {
      metricId: card.metricId,
      evidenceId: card.evidenceId,
      state: card.state,
      label: card.label,
      summary: card.state.kind === "available"
        ? `${card.displayValue} · ${card.provenance}`
        : stateMessage(locale, card.state) ?? ""
    };
  });

  const activity = panelState(locale, findUiEvidence(bundle, "activity-series"), (value) =>
    isSeries(value) ? { points: value } : null
  );
  const topDishes = panelState(locale, findUiEvidence(bundle, "dish-ranking"), (value) =>
    isRanking(value) ? value.slice(0, 5).map((item) => ({ ...item, label: item.key })) : null
  );
  const timeline = panelState(locale, findUiEvidence(bundle, "time-distribution"), (value) =>
    isSeries(value) ? value.slice(0, 5).map((item) => ({ ...item, label: item.key })) : null
  );
  const searches = panelState(locale, findUiEvidence(bundle, "private-search-ranking"), (value) =>
    isRanking(value) ? value.slice(0, 5).map((item) => ({ ...item, label: item.key })) : null
  );
  const alerts = panelState(locale, findUiEvidence(bundle, "asset-errors"), (value) => {
    if (!Array.isArray(value)) return null;
    return value.slice(0, 5).flatMap((item, index) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as { key?: unknown; label?: unknown; detail?: unknown };
      if (typeof candidate.label !== "string" || typeof candidate.detail !== "string") return [];
      return [{ key: typeof candidate.key === "string" ? candidate.key : `alert-${index}`, label: candidate.label, detail: candidate.detail }];
    });
  });

  const menuRecord = findUiEvidence(bundle, "catalog-dishes", ["snapshot", "current"]);
  const menuState = menuRecord?.state ?? missingState;
  const totalDishes = menuState.kind === "available" ? numericCount(menuState.value) : null;

  return {
    locale,
    generatedAt: bundle.generatedAt,
    briefing,
    pulse,
    activity,
    alerts,
    topDishes,
    timeline,
    searches,
    menuHealth: {
      evidenceId: menuRecord?.evidenceId ?? null,
      state: menuState,
      totalDishes,
      label: TODAY_COPY[locale].totalDishes,
      message: stateMessage(locale, menuState)
    }
  };
}
