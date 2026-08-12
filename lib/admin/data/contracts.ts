export type AdminDatasetSource = "production" | "demo" | "internal" | "test";
export type IanaTimeZone = string & { readonly __brand: "IanaTimeZone" };
export type AdminRange = "today" | "7d" | "30d";

export type AdminMetricScope<S extends AdminDatasetSource = AdminDatasetSource> =
  Readonly<{
    restaurantId: string;
    menuId: string;
    source: S;
    timezone: IanaTimeZone;
  }>;
export type ProductionAdminMetricScope = AdminMetricScope<"production">;

export type AdminMetricState<T> =
  | { kind: "available"; value: T }
  | { kind: "insufficient"; reason: "no-events" | "sample-too-small" | "privacy-threshold" | "comparison-unavailable" }
  | { kind: "unmeasured"; reason: "not-instrumented" | "instrumentation-unverified" | "unsupported-signal" }
  | { kind: "unavailable"; reason: "not-applicable" | "timezone-unconfigured" | "schema-not-deployed" | "worker-not-active" }
  | { kind: "error"; code: "configuration" | "database" | "query" | "scope-integrity"; retryable: boolean }
  | { kind: "truncated"; observedRows: number; rowLimit: number };

export type AdminCountPayload = Readonly<{ count: number }>;
export type AdminRatioPayload = Readonly<{ numerator: number; denominator: number; ratio: number | null }>;
export type AdminSeriesPoint = Readonly<{ key: string; count: number }>;
export type AdminSeriesPayload = readonly AdminSeriesPoint[];
export type AdminRankingEntry = Readonly<{ key: string; count: number; rank: number }>;
export type AdminRankingPayload = readonly AdminRankingEntry[];
export type AdminEvidencePayload = AdminCountPayload | AdminRatioPayload | AdminSeriesPayload | AdminRankingPayload | readonly unknown[];

export const ADMIN_METRIC_IDS = [
  "catalog-dishes",
  "catalog-photos",
  "catalog-immersive-assets",
  "observed-menu-opens",
  "observed-dish-opens",
  "observed-immersive-intents",
  "observed-ar-intents",
  "observed-sessions",
  "dish-ranking",
  "category-ranking",
  "activity-series",
  "time-distribution",
  "private-search-ranking",
  "active-sessions",
  "average-duration",
  "searches-without-results",
  "filter-usage",
  "funnel",
  "3d-success",
  "ar-success",
  "mobile-performance",
  "asset-errors"
] as const;
export type AdminMetricId = (typeof ADMIN_METRIC_IDS)[number];

export type AdminPeriodBounds = Readonly<{ from: string; to: string }>;

export function parseAdminRange(input: unknown): AdminRange {
  if (input === "today" || input === "7d" || input === "30d") return input;
  throw new Error("Invalid admin range.");
}

export function parseIanaTimeZone(input: unknown): IanaTimeZone {
  if (typeof input !== "string" || !input || input === "Etc/Unknown") {
    throw new Error("Invalid IANA timezone.");
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: input }).format(0);
  } catch {
    throw new Error("Invalid IANA timezone.");
  }
  return input as IanaTimeZone;
}

export function assertProductionAdminMetricScope(input: unknown): ProductionAdminMetricScope {
  if (!input || typeof input !== "object") throw new Error("Invalid production scope.");
  const candidate = input as Record<string, unknown>;
  if (
    typeof candidate.restaurantId !== "string" || !candidate.restaurantId ||
    typeof candidate.menuId !== "string" || !candidate.menuId ||
    candidate.source !== "production"
  ) throw new Error("Invalid production scope.");
  parseIanaTimeZone(candidate.timezone);
  return input as ProductionAdminMetricScope;
}
