import type { AdminReportModel } from "@/lib/admin/reports/contracts";
import styles from "./AdminReports.module.css";

export function ReportSearches({ report }: { report: AdminReportModel }) {
  if (!report.searches.value) return <div className={styles.emptyState} role="status"><strong>{report.locale === "fr" ? "Recherches protégées" : "Privacy-protected searches"}</strong><p>{report.searches.copy}</p></div>;
  return <ul className={styles.searchList}>{report.searches.value.map((search) => <li key={search.term}><span>{search.term}</span><strong>{search.count}</strong></li>)}</ul>;
}
