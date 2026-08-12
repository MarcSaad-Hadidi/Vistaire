import Link from "next/link";
import {
  AvailabilityIcon,
  InsightsIcon,
  MoreIcon,
  ReportsIcon
} from "@/components/admin/system/AdminIcons";
import type { AdminLocale } from "@/lib/admin/foundationRoutes";
import { AdminPanel } from "@/components/admin/system/AdminPrimitives";
import { TODAY_COPY } from "./todayCopy";
import styles from "./AdminToday.module.css";

const actionCopy = {
  fr: [
    ["/admin/availability", "Gérer les disponibilités"],
    ["/admin/insights", "Explorer l’intelligence menu"],
    ["/admin/reports", "Consulter les rapports"],
    ["/admin/more", "Vérifier la qualité"]
  ],
  en: [
    ["/admin/availability", "Manage availability"],
    ["/admin/insights", "Explore menu intelligence"],
    ["/admin/reports", "View reports"],
    ["/admin/more", "Review quality"]
  ]
} as const;

const icons = [<AvailabilityIcon key="availability" />, <InsightsIcon key="insights" />, <ReportsIcon key="reports" />, <MoreIcon key="more" />];

export function TodayQuickActions({ locale }: { locale: AdminLocale }) {
  return (
    <AdminPanel className={styles.quickActions} data-today-region="quick-actions" title={TODAY_COPY[locale].quickActions}>
      <nav aria-label={TODAY_COPY[locale].quickActions}>
        {actionCopy[locale].map(([href, label], index) => (
          <Link href={href} key={href}>{icons[index]}<span>{label}</span></Link>
        ))}
      </nav>
    </AdminPanel>
  );
}
