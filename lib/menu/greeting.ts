export type GreetingPeriod = "morning" | "afternoon" | "evening" | "night";
type GreetingLocale = "fr" | "en" | "es" | "it" | "ar";

const GREETINGS: Record<GreetingLocale, Record<GreetingPeriod, string>> = {
  fr: {
    morning: "Bonjour",
    afternoon: "Bon après-midi",
    evening: "Bonsoir",
    night: "Bonne nuit"
  },
  en: {
    morning: "Good morning",
    afternoon: "Good afternoon",
    evening: "Good evening",
    night: "Good night"
  },
  es: {
    morning: "Buenos dias",
    afternoon: "Buenas tardes",
    evening: "Buenas noches",
    night: "Buenas noches"
  },
  it: {
    morning: "Buongiorno",
    afternoon: "Buon pomeriggio",
    evening: "Buonasera",
    night: "Buona notte"
  },
  ar: {
    morning: "صباح الخير",
    afternoon: "مساء الخير",
    evening: "مساء الخير",
    night: "تصبح على خير"
  }
};

function greetingLocaleFor(value: unknown): GreetingLocale {
  if (typeof value !== "string") return "fr";
  const normalized = value.trim().toLowerCase().replace("_", "-");
  try {
    const language = new Intl.Locale(normalized).language.toLowerCase();
    return language in GREETINGS ? (language as GreetingLocale) : "en";
  } catch {
    const language = normalized.split("-")[0] ?? "";
    return language in GREETINGS ? (language as GreetingLocale) : "en";
  }
}

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
  locale: string,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
): string {
  const resolvedLocale = greetingLocaleFor(locale);
  return GREETINGS[resolvedLocale][getGreetingPeriodForTime(date, timezone)];
}
