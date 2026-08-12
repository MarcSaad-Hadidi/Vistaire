import Link from "next/link";
import type { AdminReportModel, AdminReportService } from "@/lib/admin/reports/contracts";
import styles from "./AdminReports.module.css";

const ranges = ["today", "7d", "30d"] as const;
const services: readonly AdminReportService[] = ["all", "lunch", "dinner"];

export function ReportFilters({ report }: { report: AdminReportModel }) {
  const fr = report.locale === "fr";
  const rangeLabel = { today: fr ? "Aujourdâ€™hui" : "Today", "7d": fr ? "7 jours" : "7 days", "30d": fr ? "30 jours" : "30 days" };
  const serviceLabel = { all: fr ? "Tous les services" : "All services", lunch: fr ? "DÃ©jeuner" : "Lunch", dinner: fr ? "DÃ®ner" : "Dinner" };
  return (
    <nav className={styles.filters} aria-label={fr ? "Filtres du rapport" : "Report filters"} data-report-print-hidden>
      <div className={styles.filterGroup} aria-label={fr ? "PÃ©riode" : "Period"}>
        {ranges.map((range) => <Link aria-current={range === report.range ? "page" : undefined} href={`/admin/reports?range=${range}&service=${report.service}`} key={range}>{rangeLabel[range]}</Link>)}
      </div>
      <div className={styles.filterGroup} aria-label={fr ? "Service" : "Service"}>
        {services.map((service) => <Link aria-current={service === report.service ? "page" : undefined} href={`/admin/reports?range=${report.range}&service=${service}`} key={service}>{serviceLabel[service]}</Link>)}
      </div>
    </nav>
  );
}

