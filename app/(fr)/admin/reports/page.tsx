import { headers } from "next/headers";
import { AdminReportsPage } from "@/components/admin/reports/AdminReportsPage";
import { ReportActions } from "@/components/admin/reports/ReportActions";
import { AdminShell } from "@/components/admin/system/AdminShell";
import { AdminShellState } from "@/components/admin/system/AdminShellState";
import { requireAdminRestaurantAccess } from "@/lib/admin/access";
import { buildAdminReport, parseAdminReportFilters } from "@/lib/admin/reports/buildReport";
import { loadAdminDataBundle } from "@/lib/admin/data/loadAdminData";
import { readAdminPreferencesFromHeaders } from "@/lib/admin/preferences";

export const dynamic = "force-dynamic";

type ReportsSearchParams = { range?: string | string[]; service?: string | string[] };

export default async function AdminReportsRoute({ searchParams }: { searchParams?: Promise<ReportsSearchParams> }) {
  const preferences = readAdminPreferencesFromHeaders(await headers());
  const access = await requireAdminRestaurantAccess("dashboard:read");
  if (!access.ok) return <AdminShellState kind="forbidden" locale={preferences.locale} />;

  const filters = parseAdminReportFilters((await searchParams) ?? {});
  const dataResult = await loadAdminDataBundle(access, filters.range);
  if (!dataResult.ok) return <AdminShellState kind="error" locale={preferences.locale} />;

  const report = buildAdminReport({
    locale: preferences.locale,
    range: filters.range,
    service: filters.service,
    bundle: dataResult.bundle
  });
  const serviceLabel = report.service === "dinner"
    ? (preferences.locale === "fr" ? "Dîner" : "Dinner")
    : report.service === "lunch"
      ? (preferences.locale === "fr" ? "Déjeuner" : "Lunch")
      : (preferences.locale === "fr" ? "Tous les services" : "All services");
  const periodLabel = new Intl.DateTimeFormat(preferences.locale === "fr" ? "fr-CA" : "en-CA", {
    timeZone: report.window.timezone,
    dateStyle: "medium"
  }).format(new Date(report.window.current.to));
  return (
    <AdminShell
      activeRoute="reports"
      restaurantName={dataResult.presentation.restaurantName}
      restaurantId={dataResult.presentation.restaurantId}
      menuPath={dataResult.presentation.publicMenuPath}
      pageTitle={`${preferences.locale === "fr" ? "Bilan du service" : "Service report"} — ${serviceLabel}`}
      pageDescription={preferences.locale === "fr"
        ? `${periodLabel} · ${serviceLabel} | Comparé à la période alignée précédente`
        : `${periodLabel} · ${serviceLabel} | Compared with the aligned previous period`}
      observedAt={report.window.observedAt}
      timezone={report.window.timezone}
      headerDetails={<span>{report.window.timezone}</span>}
      headerActions={<ReportActions locale={report.locale} range={report.range} service={report.service} />}
    >
      <AdminReportsPage report={report} />
    </AdminShell>
  );
}
