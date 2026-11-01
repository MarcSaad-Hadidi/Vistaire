export type AdminDashboardRange =
  | "today-utc"
  | "7d"
  | "30d"
  | "90d"
  | "365d"
  | "month"
  | "year"
  | `custom:${string}:${string}`;
export type AdminObservationWindow = {
  range: AdminDashboardRange;
  startInclusive: string;
  endExclusive: string;
  comparisonStartInclusive: string;
  comparisonEndExclusive: string;
};
const DAY = 86_400_000;
function customDates(value: string): { start: number; end: number } | null {
  const match = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(value);
  if (!match) return null;
  const start = Date.parse(`${match[1]}T00:00:00.000Z`),
    last = Date.parse(`${match[2]}T00:00:00.000Z`);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(last) ||
    new Date(start).toISOString().slice(0, 10) !== match[1] ||
    new Date(last).toISOString().slice(0, 10) !== match[2] ||
    last < start ||
    last - start >= 730 * DAY
  )
    return null;
  return { start, end: last + DAY };
}
export function parseAdminDashboardRange(value: unknown): AdminDashboardRange {
  if (typeof value !== "string") return "7d";
  if (
    ["today-utc", "7d", "30d", "90d", "365d", "month", "year"].includes(value)
  )
    return value as AdminDashboardRange;
  return customDates(value) ? (value as AdminDashboardRange) : "7d";
}
export function resolveAdminObservationWindow(
  range: AdminDashboardRange,
  now: Date,
): AdminObservationWindow {
  const custom = customDates(range);
  let end = now.getTime();
  let start: number;
  if (custom && custom.start < end) {
    start = custom.start;
    end = Math.min(custom.end, end);
  } else if (range === "today-utc")
    start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  else if (range === "month")
    start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  else if (range === "year") start = Date.UTC(now.getUTCFullYear(), 0, 1);
  else
    start =
      end -
      ({ "7d": 7, "30d": 30, "90d": 90, "365d": 365 }[range as "7d"] ?? 7) *
        DAY;
  const duration = end - start;
  return {
    range,
    startInclusive: new Date(start).toISOString(),
    endExclusive: new Date(end).toISOString(),
    comparisonStartInclusive: new Date(start - duration).toISOString(),
    comparisonEndExclusive: new Date(start).toISOString(),
  };
}
