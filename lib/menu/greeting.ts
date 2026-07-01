import { normalizeLocale, type Locale } from "../i18n.ts";

export type GreetingPeriod = "morning" | "afternoon" | "evening" | "night";

const GREETINGS: Record<Locale, Record<GreetingPeriod, string>> = {
  fr: {
    morning: "Bonjour",
    afternoon: "Bon apres-midi",
    evening: "Bonsoir",
    night: "Bonne nuit"
  },
  en: {
    morning: "Good Morning",
    afternoon: "Good Afternoon",
    evening: "Good Evening",
    night: "Good Night"
  }
};

function hourInTimezone(date: Date, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone
    }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    return Number.isFinite(hour) ? hour % 24 : date.getHours();
  } catch {
    return date.getHours();
  }
}

export function getGreetingPeriodForTime(
  date: Date,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
): GreetingPeriod {
  const hour = hourInTimezone(date, timezone);
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export function getGreetingForTime(
  date: Date,
  locale: Locale | string,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
): string {
  const resolvedLocale = normalizeLocale(locale);
  return GREETINGS[resolvedLocale][getGreetingPeriodForTime(date, timezone)];
}
