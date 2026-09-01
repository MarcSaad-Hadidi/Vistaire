import type { AdminReportModel } from "@/lib/admin/reports/contracts";
import styles from "./AdminReports.module.css";

export function ReportHighlights({ report }: { report: AdminReportModel }) {
  const fr = report.locale === "fr";
  if (report.highlights.length === 0) return <div className={styles.emptyState} role="status"><strong>{fr ? "Comparaison en attente" : "Comparison pending"}</strong><p>{fr ? "Aucune paire de preuves alignées n’est disponible." : "No aligned evidence pair is available."}</p></div>;
  return <div className={styles.highlightGrid}>{report.highlights.map((item) => <article className={styles.highlight} data-evidence-ids={item.evidenceIds.join(",")} key={item.label}><span className={styles.trendMark} aria-hidden="true">↗</span><div><p>{item.label}</p><strong>{item.value}</strong><small>{item.detail}</small></div></article>)}</div>;
}
