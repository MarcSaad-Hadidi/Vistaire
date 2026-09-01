import type { AdminReportModel } from "@/lib/admin/reports/contracts";
import styles from "./AdminReports.module.css";

export function ReportAvailabilityChanges({ report }: { report: AdminReportModel }) {
  if (!report.availabilityChanges.value) return <div className={styles.emptyState} role="status"><strong>{report.locale === "fr" ? "Évolution des disponibilités" : "Availability changes"}</strong><p>{report.availabilityChanges.copy}</p></div>;
  return <ul className={styles.changeList}>{report.availabilityChanges.value.map((change) => <li key={`${change.label}-${change.occurredAt ?? "snapshot"}`}><span>{change.label}</span><strong>{change.state}</strong>{change.occurredAt ? <time>{change.occurredAt}</time> : null}</li>)}</ul>;
}
