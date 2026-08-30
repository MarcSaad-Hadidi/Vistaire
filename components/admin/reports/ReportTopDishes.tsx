import type { AdminReportModel } from "@/lib/admin/reports/contracts";
import styles from "./AdminReports.module.css";

export function ReportTopDishes({ report }: { report: AdminReportModel }) {
  if (!report.topDishes.value) return <div className={styles.emptyState} role="status"><strong>{report.locale === "fr" ? "Classement en attente" : "Ranking pending"}</strong><p>{report.topDishes.copy}</p></div>;
  return <ol className={styles.ranking}>{report.topDishes.value.map((dish) => <li key={dish.key}><span className={styles.rank}>{dish.rank}</span><span>{dish.key.replaceAll("-", " ")}</span><strong>{dish.count}</strong></li>)}</ol>;
}
