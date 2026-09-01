import { headers } from "next/headers";
import { requireAdminRestaurantAccess } from "@/lib/admin/access";
import { loadAdminDataBundle } from "@/lib/admin/data/loadAdminData";
import { projectEvidenceForAudience } from "@/lib/admin/data/evidenceRegistry";
import { readAdminPreferencesFromHeaders } from "@/lib/admin/preferences";
import { buildAdminReport, parseAdminReportFilters } from "@/lib/admin/reports/buildReport";
import { serializeAdminReportCsv } from "@/lib/admin/reports/csv";
import { privateReportError, privateReportResponse } from "@/lib/admin/reports/exportReport";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const preferences = readAdminPreferencesFromHeaders(await headers());
  const access = await requireAdminRestaurantAccess("dashboard:read");
  if (!access.ok) return privateReportError(401, "unauthorized");

  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return privateReportError(400, "invalid-request");
  }
  const filters = parseAdminReportFilters({
    range: url.searchParams.get("range") ?? undefined,
    service: url.searchParams.get("service") ?? undefined
  });

  try {
    const result = await loadAdminDataBundle(access, filters.range);
    if (!result.ok) return privateReportError(503, "unavailable");
    const report = buildAdminReport({
      locale: preferences.locale,
      range: filters.range,
      service: filters.service,
      bundle: result.bundle
    });
    const evidence = projectEvidenceForAudience(result.bundle, "export");
    const bytes = serializeAdminReportCsv({ locale: preferences.locale, report, evidence });
    const date = result.bundle.window.current.to.slice(0, 10);
    const filename = preferences.locale === "fr" ? `bilan-vistaire-${date}.csv` : `vistaire-report-${date}.csv`;
    return privateReportResponse(bytes, {
      status: 200,
      contentType: "text/csv; charset=utf-8",
      headers: { "Content-Disposition": `attachment; filename="${filename}"` }
    });
  } catch {
    return privateReportError(503, "unavailable");
  }
}
