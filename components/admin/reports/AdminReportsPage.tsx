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

function ReportChanges({ report }: { report: AdminReportModel }) {
  const fr = report.locale === "fr";
  if (report.availabilityChanges.value?.length) {
    return <ul className={styles.changeList}>{report.availabilityChanges.value.map((change) => <li key={`${change.label}-${change.occurredAt ?? "snapshot"}`}><span>{change.label}</span><strong>{change.state}</strong>{change.occurredAt ? <time>{change.occurredAt}</time> : null}</li>)}</ul>;
  }
  return <div className={styles.emptyState} role="status"><strong>{fr ? "Aucun changement mesuré" : "No measured changes"}</strong><p>{fr ? "Les changements apparaîtront lorsqu’une preuve dédiée sera disponible." : "Changes will appear when dedicated evidence is available."}</p></div>;
}

function ReportSummary({ report }: { report: AdminReportModel }) {
  const fr = report.locale === "fr";
  const reliability = report.reliability;
  const available = reliability.availableEvidence;
  if (available === 0) return <div className={styles.emptyState} role="status"><strong>{fr ? "Résumé indisponible" : "Summary unavailable"}</strong><p>{fr ? "Aucune synthèse n’est formulée sans preuve disponible." : "No summary is stated without available evidence."}</p></div>;
  return <div className={styles.reportSummary} data-evidence-ids={reliability.evidenceIds.join(",")}><strong>{reliability.state === "complete" ? (fr ? "Lecture complète" : "Complete reading") : (fr ? "Lecture limitée" : "Limited reading")}</strong><p>{fr ? `${available} preuves sur ${reliability.totalEvidence} soutiennent ce bilan.` : `${available} of ${reliability.totalEvidence} evidence records support this report.`}</p></div>;
}

export function AdminReportsPage({ report }: { report: AdminReportModel }) {
  const fr = report.locale === "fr";
  return <div className={styles.report}>
    <ReportFilters report={report}/>
    <AdminPanel className={styles.fullPanel} eyebrow={fr ? "Points clés du service" : "Service highlights"} data-report-card><ReportHighlights report={report}/></AdminPanel>
    <section className={styles.section} aria-labelledby="metrics-title"><header><p>{fr ? "Performance" : "Performance"}</p><h2 id="metrics-title">{fr ? "Comparé à la période alignée" : "Compared with the aligned period"}</h2></header><ReportMetricGrid report={report}/></section>
    <div className={styles.dashboardGrid}>
      <AdminPanel className={styles.timeline} title={fr ? "Chronologie du service" : "Service timeline"} data-report-card><ReportTimeline report={report}/></AdminPanel>
      <AdminPanel title={fr ? "Top plats du service" : "Top dishes"} data-report-card><ReportTopDishes report={report}/></AdminPanel>
      <AdminPanel title={fr ? "Recherches" : "Searches"} data-report-card><ReportSearches report={report}/></AdminPanel>
      <AdminPanel className={styles.availability} title={fr ? "Évolution de la disponibilité" : "Availability changes"} data-report-card><ReportAvailabilityChanges report={report}/></AdminPanel>
      <AdminPanel className={styles.changes} title={fr ? "Ce qui a changé" : "What changed"} data-report-card><ReportChanges report={report}/></AdminPanel>
      <AdminPanel title={fr ? "Résumé Vistaire" : "Vistaire summary"} data-report-card><ReportSummary report={report}/></AdminPanel>
      <AdminPanel title={fr ? "Preuves et fiabilité" : "Evidence reliability"} data-report-card><ReportReliability report={report}/></AdminPanel>
      <AdminPanel title={fr ? "Actions recommandées" : "Recommended actions"} data-report-card><ReportRecommendations report={report}/></AdminPanel>
    </div>
  </div>;
}
