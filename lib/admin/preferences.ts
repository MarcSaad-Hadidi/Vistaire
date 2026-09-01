import type { AdminLocale } from "@/lib/admin/foundationRoutes";

export type AdminTheme = "light" | "dark";
export type AdminPreferences = Readonly<{ locale: AdminLocale; theme: AdminTheme }>;
export type AdminPreferenceMutation =
  | Readonly<{ kind: "locale"; value: AdminLocale }>
  | Readonly<{ kind: "theme"; value: AdminTheme }>;

export const ADMIN_LOCALE_COOKIE = "vistaire-admin-locale";
export const ADMIN_THEME_COOKIE = "vistaire-admin-theme";
export const ADMIN_LOCALE_HEADER = "x-vistaire-admin-locale";
export const ADMIN_THEME_HEADER = "x-vistaire-admin-theme";
export const DEFAULT_ADMIN_PREFERENCES: AdminPreferences = Object.freeze({ locale: "fr", theme: "light" });
export const ADMIN_PREFERENCE_COOKIE_MAX_AGE = 31_536_000;

export function parseAdminLocale(value: unknown): AdminLocale | null {
  return value === "fr" || value === "en" ? value : null;
}

export function parseAdminTheme(value: unknown): AdminTheme | null {
  return value === "light" || value === "dark" ? value : null;
}

export function resolveAdminPreferences(localeCookie: unknown, themeCookie: unknown): AdminPreferences {
  return {
    locale: parseAdminLocale(localeCookie) ?? DEFAULT_ADMIN_PREFERENCES.locale,
    theme: parseAdminTheme(themeCookie) ?? DEFAULT_ADMIN_PREFERENCES.theme
  };
}

export function parseAdminPreferenceMutation(input: FormData): AdminPreferenceMutation | null {
  const kind = input.get("kind");
  const value = input.get("value");
  if (kind === "locale") {
    const locale = parseAdminLocale(value);
    return locale ? { kind, value: locale } : null;
  }
  if (kind === "theme") {
    const theme = parseAdminTheme(value);
    return theme ? { kind, value: theme } : null;
  }
  return null;
}

export function sanitizeAdminReturnTo(value: string | null, requestOrigin: string): string {
  if (!value) return "/admin";
  try {
    const target = new URL(value, requestOrigin);
    if (target.origin !== requestOrigin) return "/admin";
    if (target.pathname !== "/admin" && !target.pathname.startsWith("/admin/")) return "/admin";
    return `${target.pathname}${target.search}`;
  } catch {
    return "/admin";
  }
}

export function readAdminPreferencesFromHeaders(headers: Pick<Headers, "get">): AdminPreferences {
  return resolveAdminPreferences(headers.get(ADMIN_LOCALE_HEADER), headers.get(ADMIN_THEME_HEADER));
}
