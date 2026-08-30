import type { AdminReportModel } from "@/lib/admin/reports/contracts";
import styles from "./AdminReports.module.css";

export function ReportReliability({ report }: { report: AdminReportModel }) {
  const reliability = report.reliability;
  const percent = reliability.totalEvidence === 0 ? 0 : Math.round(reliability.availableEvidence / reliability.totalEvidence * 100);
  return <div className={styles.reliability} data-evidence-ids={reliability.evidenceIds.join(",")}><div className={styles.reliabilityRing} style={{ "--reliability": `${percent * 3.6}deg` } as React.CSSProperties}><strong>{percent}</strong><span>%</span></div><div><p>{reliability.label}</p><strong>{reliability.state === "complete" ? (report.locale === "fr" ? "Complète" : "Complete") : reliability.state === "limited" ? (report.locale === "fr" ? "Limitée" : "Limited") : (report.locale === "fr" ? "Indisponible" : "Unavailable")}</strong><small>{reliability.availableEvidence} / {reliability.totalEvidence} {report.locale === "fr" ? "preuves disponibles" : "available evidence records"}</small></div></div>;
}
