export type AdminLocale = "fr" | "en";
export type AdminRouteId = "today" | "availability" | "intelligence" | "reports" | "more";
export type AdminRoutePath =
  | "/admin"
  | "/admin/availability"
  | "/admin/insights"
  | "/admin/reports"
  | "/admin/more";
export type AdminRouteAvailability = "integrated" | "deferred";
export type LegacyAdminRoute = "overview" | "availability" | "insights";

export type AdminRouteDefinition = Readonly<{
  id: AdminRouteId;
  href: AdminRoutePath;
  label: Readonly<Record<AdminLocale, string>>;
  availability: AdminRouteAvailability;
}>;

export const ADMIN_ROUTE_PATHS = Object.freeze({
  today: "/admin",
  availability: "/admin/availability",
  intelligence: "/admin/insights",
  reports: "/admin/reports",
  more: "/admin/more"
} as const satisfies Record<AdminRouteId, AdminRoutePath>);

export const ADMIN_ROUTES = Object.freeze([
  { id: "today", href: ADMIN_ROUTE_PATHS.today, label: { fr: "Aujourd’hui", en: "Today" }, availability: "integrated" },
  { id: "availability", href: ADMIN_ROUTE_PATHS.availability, label: { fr: "Disponibilités", en: "Availability" }, availability: "integrated" },
  { id: "intelligence", href: ADMIN_ROUTE_PATHS.intelligence, label: { fr: "Intelligence", en: "Intelligence" }, availability: "integrated" },
  { id: "reports", href: ADMIN_ROUTE_PATHS.reports, label: { fr: "Rapports", en: "Reports" }, availability: "deferred" },
  { id: "more", href: ADMIN_ROUTE_PATHS.more, label: { fr: "Plus", en: "More" }, availability: "deferred" }
] as const satisfies readonly AdminRouteDefinition[]);

export function normalizeLegacyAdminRoute(route: LegacyAdminRoute): AdminRouteId {
  if (route === "overview") return "today";
  if (route === "insights") return "intelligence";
  return "availability";
}
