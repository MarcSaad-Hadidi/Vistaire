import Link from "next/link";
import type { AdminReportModel } from "@/lib/admin/reports/contracts";
import styles from "./AdminReports.module.css";

export function ReportRecommendations({ report }: { report: AdminReportModel }) {
  if (report.recommendations.length === 0) return <div className={styles.emptyState} role="status"><strong>{report.locale === "fr" ? "Aucune action sans preuve" : "No action without evidence"}</strong><p>{report.locale === "fr" ? "Les recommandations apparaÃ®tront avec des signaux fiables." : "Recommendations will appear with reliable signals."}</p></div>;
  return <ul className={styles.recommendations}>{report.recommendations.map((recommendation) => <li data-evidence-ids={recommendation.evidenceIds.join(",")} key={`${recommendation.href}-${recommendation.label}`}><Link href={recommendation.href}>{recommendation.label}<span aria-hidden="true">â†’</span></Link></li>)}</ul>;
}

