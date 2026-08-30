import type { AdminReportModel } from "@/lib/admin/reports/contracts";
import styles from "./AdminReports.module.css";

const number = (locale: "fr" | "en", value: number) => new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA").format(value);

export function ReportMetricGrid({ report }: { report: AdminReportModel }) {
  return <div className={styles.metricGrid}>{report.metrics.slice(0, 5).map((metric) => {
    const count = metric.current.value?.count;
    const comparison = metric.comparison.value;
    const trend = comparison
      ? comparison.changeRate === null
        ? `${comparison.delta >= 0 ? "+" : ""}${number(report.locale, comparison.delta)}`
        : new Intl.NumberFormat(report.locale === "fr" ? "fr-CA" : "en-CA", { style: "percent", maximumFractionDigits: 0 }).format(comparison.changeRate)
      : null;
    return <article className={styles.metric} data-evidence-ids={[...metric.current.evidenceIds, ...metric.comparison.evidenceIds].join(",")} data-state={metric.current.state.kind} key={metric.metricId}><span className={styles.metricDot} aria-hidden="true"/><p>{metric.label}</p><strong>{count === undefined || count === null ? "—" : number(report.locale, count)}</strong><small>{trend ? `${trend} · ${metric.comparison.copy}` : metric.current.copy}</small></article>;
  })}</div>;
}

