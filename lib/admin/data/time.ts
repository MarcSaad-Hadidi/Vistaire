import type { AdminPeriodBounds, AdminRange, IanaTimeZone } from "./contracts.ts";
import { parseIanaTimeZone } from "./contracts.ts";

export type AdminTimeZoneResolution =
  | { kind: "configured"; timezone: IanaTimeZone; source: "menus.settings_json" }
  | { kind: "fallback"; timezone: IanaTimeZone; source: "utc-fallback"; reason: "missing" | "invalid" };

export type AdminObservationWindow = Readonly<{
  range: AdminRange;
  timezone: IanaTimeZone;
  calendarDayCount: 1 | 7 | 30;
  observedAt: string;
  current: AdminPeriodBounds;
  previous: AdminPeriodBounds;
  alignment: "local-calendar-v1";
}>;

export type AdminTimeBucket = Readonly<{
  from: string;
  to: string;
  localHour: string;
  utcOffset: string;
}>;

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function localParts(date: Date, timezone: IanaTimeZone): LocalParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute"), second: value("second") };
}

function addLocalDays(parts: LocalParts, amount: number): LocalParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount, parts.hour, parts.minute, parts.second));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds() };
}

function localToInstant(parts: LocalParts, timezone: IanaTimeZone): Date {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  let guess = target;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const actual = localParts(new Date(guess), timezone);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const delta = target - actualAsUtc;
    if (delta === 0) return new Date(guess);
    guess += delta;
  }
  return new Date(guess);
}

export function resolveAdminTimeZone(settingsJson: unknown): AdminTimeZoneResolution {
  const timezone = settingsJson && typeof settingsJson === "object" && !Array.isArray(settingsJson)
    ? (settingsJson as Record<string, unknown>).timezone : undefined;
  if (timezone === undefined || timezone === null || timezone === "") {
    return { kind: "fallback", timezone: "UTC" as IanaTimeZone, source: "utc-fallback", reason: "missing" };
  }
  try {
    return { kind: "configured", timezone: parseIanaTimeZone(timezone), source: "menus.settings_json" };
  } catch {
    return { kind: "fallback", timezone: "UTC" as IanaTimeZone, source: "utc-fallback", reason: "invalid" };
  }
}

export function resolveAdminObservationWindow(input: { range: AdminRange; observedAt: Date; timezone: IanaTimeZone }): AdminObservationWindow {
  if (!Number.isFinite(input.observedAt.getTime())) throw new Error("Invalid observation clock.");
  const dayCount = input.range === "today" ? 1 : input.range === "7d" ? 7 : 30;
  const cutoff = localParts(input.observedAt, input.timezone);
  const currentStartLocal = addLocalDays({ ...cutoff, hour: 0, minute: 0, second: 0 }, -(dayCount - 1));
  const previousStartLocal = addLocalDays(currentStartLocal, -dayCount);
  const currentFrom = localToInstant(currentStartLocal, input.timezone).toISOString();
  return {
    range: input.range,
    timezone: input.timezone,
    calendarDayCount: dayCount as 1 | 7 | 30,
    observedAt: input.observedAt.toISOString(),
    current: { from: currentFrom, to: input.observedAt.toISOString() },
    previous: { from: localToInstant(previousStartLocal, input.timezone).toISOString(), to: currentFrom },
    alignment: "local-calendar-v1"
  };
}

export function buildAdminTimeBuckets(window: AdminObservationWindow): readonly AdminTimeBucket[] {
  const buckets: AdminTimeBucket[] = [];
  const to = Date.parse(window.current.to);
  const offsetFormatter = new Intl.DateTimeFormat("en", { timeZone: window.timezone, timeZoneName: "shortOffset" });
  for (let cursor = Date.parse(window.current.from); cursor < to; cursor += 3_600_000) {
    const date = new Date(cursor);
    const local = localParts(date, window.timezone);
    const offset = offsetFormatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value ?? "GMT";
    buckets.push({
      from: date.toISOString(),
      to: new Date(Math.min(cursor + 3_600_000, to)).toISOString(),
      localHour: String(local.hour).padStart(2, "0"),
      utcOffset: offset
    });
  }
  return buckets;
}
