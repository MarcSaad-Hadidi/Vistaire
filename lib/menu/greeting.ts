export type GreetingPeriod = "morning" | "afternoon" | "evening" | "night";
type GreetingLocale = "fr" | "en" | "es" | "it" | "de" | "ar";

const GREETINGS: Record<GreetingLocale, Record<GreetingPeriod, string>> = {
  fr: {
    morning: "Bonjour",
    afternoon: "Bienvenue",
    evening: "Bonsoir",
    night: "Bonsoir"
  },
  en: {
    morning: "Good morning",
    afternoon: "Welcome",
    evening: "Good evening",
    night: "Good evening"
  },
  es: {
    morning: "Buenos días",
    afternoon: "Bienvenido",
    evening: "Buenas noches",
    night: "Buenas noches"
  },
  it: {
    morning: "Buongiorno",
    afternoon: "Benvenuto",
    evening: "Buonasera",
    night: "Buonasera"
  },
  de: {
    morning: "Guten Morgen",
    afternoon: "Willkommen",
    evening: "Guten Abend",
    night: "Guten Abend"
  },
  ar: {
    morning: "صباح الخير",
    afternoon: "أهلاً وسهلاً",
    evening: "مساء الخير",
    night: "مساء الخير"
  }
};

const SLEEP_GREETING_PATTERNS =
  /bonne nuit|good night|buona notte|gute nacht|تصبح على خير|sleep well|dormez bien|have a good night/i;

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
  const period = getGreetingPeriodForTime(date, timezone);
  const greeting = GREETINGS[resolvedLocale][period];
  if (SLEEP_GREETING_PATTERNS.test(greeting)) {
    return GREETINGS[resolvedLocale].afternoon;
  }
  return greeting;
}
