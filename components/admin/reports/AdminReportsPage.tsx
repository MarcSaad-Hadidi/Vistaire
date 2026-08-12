import { AdminPanel } from "../system/AdminPrimitives";
import type { AdminReportModel } from "@/lib/admin/reports/contracts";
import { ReportAvailabilityChanges } from "./ReportAvailabilityChanges";
import { ReportFilters } from "./ReportFilters";
import { ReportHighlights } from "./ReportHighlights";
import { ReportMetricGrid } from "./ReportMetricGrid";
import { ReportRecommendations } from "./ReportRecommendations";
import { ReportReliability } from "./ReportReliability";
import { ReportSearches } from "./ReportSearches";
import { ReportTimeline } from "./ReportTimeline";
import { ReportTopDishes } from "./ReportTopDishes";
import styles from "./AdminReports.module.css";

function periodLabel(report: AdminReportModel) {
  const formatter = new Intl.DateTimeFormat(report.locale === "fr" ? "fr-CA" : "en-CA", { timeZone: report.window.timezone, dateStyle: "medium", timeStyle: "short" });
  return formatter.format(new Date(report.window.current.to));
}

export function AdminReportsPage({ report }: { report: AdminReportModel }) {
  const fr = report.locale === "fr";
  return <div className={styles.report}>
    <header className={styles.reportHeader}>
      <div><p className={styles.eyebrow}>{fr ? "Bilan privÃ©" : "Private summary"}</p><h1>{fr ? "Bilan du service" : "Service report"}</h1><p>{fr ? "Une lecture fondÃ©e uniquement sur les interactions observÃ©es et leurs preuves." : "A view based only on observed interactions and their evidence."}</p></div>
      <div className={styles.period}><span>{fr ? "PÃ©riode alignÃ©e" : "Aligned period"}</span><strong>{periodLabel(report)}</strong><small>{report.window.timezone}</small></div>
    </header>
    <ReportFilters report={report}/>
    <AdminPanel className={styles.fullPanel} eyebrow={fr ? "Points clÃ©s du service" : "Service highlights"} data-report-card><ReportHighlights report={report}/></AdminPanel>
    <section className={styles.section} aria-labelledby="metrics-title"><header><p>{fr ? "Performance" : "Performance"}</p><h2 id="metrics-title">{fr ? "ComparÃ© Ã  la pÃ©riode alignÃ©e" : "Compared with the aligned period"}</h2></header><ReportMetricGrid report={report}/></section>
    <div className={styles.dashboardGrid}>
      <AdminPanel className={styles.timeline} title={fr ? "Chronologie du service" : "Service timeline"} data-report-card><ReportTimeline report={report}/></AdminPanel>
      <AdminPanel title={fr ? "Top plats du service" : "Top dishes"} data-report-card><ReportTopDishes report={report}/></AdminPanel>
      <AdminPanel title={fr ? "Recherches" : "Searches"} data-report-card><ReportSearches report={report}/></AdminPanel>
      <AdminPanel className={styles.availability} title={fr ? "Ã‰volution de la disponibilitÃ©" : "Availability changes"} data-report-card><ReportAvailabilityChanges report={report}/></AdminPanel>
      <AdminPanel title={fr ? "Preuves et fiabilitÃ©" : "Evidence reliability"} data-report-card><ReportReliability report={report}/></AdminPanel>
      <AdminPanel title={fr ? "Actions recommandÃ©es" : "Recommended actions"} data-report-card><ReportRecommendations report={report}/></AdminPanel>
    </div>
  </div>;
}

