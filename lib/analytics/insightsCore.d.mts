export type PeriodMetrics = {
  menuOpens: number;
  sessions: number;
  dishViews: number;
  searches: number;
  filters: number;
  immersive: number;
  ar: number;
  categoryViews: number;
};

export type PeriodAnalytics = {
  metrics: PeriodMetrics;
  dishRows: Record<string, unknown>[];
  searchRows: Record<string, unknown>[];
  categoryRows: Record<string, unknown>[];
};

export function buildPeriodAnalytics(input: {
  dailyRows?: Record<string, unknown>[];
  eventRows?: Record<string, unknown>[];
}): PeriodAnalytics;
export function hasPeriodActivity(metrics: PeriodMetrics): boolean;
export function resolveAnalyticsSourceHealth(input: {
  hasActivity: boolean;
  eventReadOk: boolean;
  eventTruncated: boolean;
  dailyReadOk: boolean;
  failedReads?: number;
}): "real" | "partial" | "empty";
