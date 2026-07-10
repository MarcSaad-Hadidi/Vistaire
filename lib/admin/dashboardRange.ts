export type AdminDashboardRange = "today-utc" | "7d" | "30d";

export type AdminObservationWindow = {
  range: AdminDashboardRange;
  startInclusive: string;
  endExclusive: string;
  comparisonStartInclusive: string;
  comparisonEndExclusive: string;
};

export function parseAdminDashboardRange(value: unknown): AdminDashboardRange {
  return value === "today-utc" || value === "7d" || value === "30d" ? value : "7d";
}

export function resolveAdminObservationWindow(range: AdminDashboardRange, now: Date): AdminObservationWindow {
  const end = new Date(now);
  const start = range === "today-utc"
    ? new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
    : new Date(end.getTime() - (range === "7d" ? 7 : 30) * 86_400_000);
  const duration = end.getTime() - start.getTime();
  return {
    range,
    startInclusive: start.toISOString(),
    endExclusive: end.toISOString(),
    comparisonStartInclusive: new Date(start.getTime() - duration).toISOString(),
    comparisonEndExclusive: start.toISOString()
  };
}
