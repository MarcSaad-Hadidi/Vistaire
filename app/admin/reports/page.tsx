import { headers } from "next/headers";
import { AdminReportsPage } from "@/components/admin/reports/AdminReportsPage";
import { AdminShell } from "@/components/admin/system/AdminShell";
import { AdminShellState } from "@/components/admin/system/AdminShellState";
import { requireAdminRestaurantAccess } from "@/lib/admin/access";
import { buildAdminReport, parseAdminReportFilters } from "@/lib/admin/reports/buildReport";
import { loadAdminDataBundle } from "@/lib/admin/data/loadAdminData";
import { loadAdminDashboardData } from "@/lib/admin/dashboardData";
import { readAdminPreferencesFromHeaders } from "@/lib/admin/preferences";

export const dynamic = "force-dynamic";

type ReportsSearchParams = { range?: string | string[]; service?: string | string[] };

export default async function AdminReportsRoute({ searchParams }: { searchParams?: Promise<ReportsSearchParams> }) {
  const preferences = readAdminPreferencesFromHeaders(await headers());
  const access = await requireAdminRestaurantAccess("dashboard:read");
  if (!access.ok) return <AdminShellState kind="forbidden" locale={preferences.locale} />;

  const filters = parseAdminReportFilters((await searchParams) ?? {});
  const legacyRange = filters.range === "today" ? "today-utc" : filters.range;
  const [dataResult, identityResult] = await Promise.all([
    loadAdminDataBundle(access, filters.range),
    loadAdminDashboardData(access.restaurantId, legacyRange)
  ]);
  if (!dataResult.ok) return <AdminShellState kind="error" locale={preferences.locale} />;

  const report = buildAdminReport({
    locale: preferences.locale,
    range: filters.range,
    service: filters.service,
    bundle: dataResult.bundle
  });
  const restaurantName = identityResult.ok
    ? identityResult.data.restaurant.name
    : preferences.locale === "fr" ? "Votre restaurant" : "Your restaurant";
  const menuPath = identityResult.ok ? identityResult.data.restaurant.publicMenuPath : "/";

  return (
    <AdminShell
      activeRoute="reports"
      restaurantName={restaurantName}
      menuPath={menuPath}
      headerDetails={<span>{preferences.locale === "fr" ? "Rapports privÃ©s" : "Private reports"}</span>}
    >
      <AdminReportsPage report={report} />
    </AdminShell>
  );
}

