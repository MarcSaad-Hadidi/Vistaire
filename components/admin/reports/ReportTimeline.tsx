import type { AdminReportModel } from "@/lib/admin/reports/contracts";
import styles from "./AdminReports.module.css";

export function ReportTimeline({ report }: { report: AdminReportModel }) {
  const values = report.timeline.value;
  if (!values) return <div className={styles.emptyState} role="status"><strong>{report.locale === "fr" ? "Chronologie non mesurée" : "Timeline not measured"}</strong><p>{report.timeline.copy}</p></div>;
  const max = Math.max(1, ...values.map((point) => point.count));
  return <div><div className={styles.timelineChart} role="img" aria-label={report.locale === "fr" ? "Chronologie des interactions observées" : "Timeline of observed interactions"}>{values.map((point) => <span key={point.key} style={{ height: `${Math.max(5, point.count / max * 100)}%` }} title={`${point.key}: ${point.count}`}/>)}</div><ul className={styles.exactList}>{values.map((point) => <li key={point.key}><span>{point.key}</span><strong>{point.count}</strong></li>)}</ul></div>;
}

