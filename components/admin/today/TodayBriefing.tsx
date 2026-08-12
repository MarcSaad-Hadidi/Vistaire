import Link from "next/link";
import { AdminPanel, AdminStatusBadge } from "@/components/admin/system/AdminPrimitives";
import type { TodayViewModel } from "./todayViewModel";
import { TODAY_COPY } from "./todayCopy";
import styles from "./AdminToday.module.css";

const briefingHref = {
  "observed-menu-opens": "/admin/insights",
  "dish-ranking": "/admin/insights",
  "catalog-dishes": "/admin/more"
} as const;

export function TodayBriefing({ model }: { model: TodayViewModel }) {
  const copy = TODAY_COPY[model.locale];
  return (
    <AdminPanel
      className={styles.briefing}
      data-today-region="briefing"
      eyebrow={copy.currentPeriod}
      title={copy.briefing}
    >
      <ul className={styles.briefingList}>
        {model.briefing.map((item) => (
          <li data-evidence-id={item.evidenceId ?? undefined} key={item.metricId}>
            <div>
              <AdminStatusBadge tone={item.state.kind === "available" ? "available" : "neutral"}>
                {item.state.kind === "available" ? copy.currentPeriod : item.state.kind}
              </AdminStatusBadge>
              <h3>{item.label}</h3>
              <p>{item.summary}</p>
            </div>
            <Link href={briefingHref[item.metricId as keyof typeof briefingHref] ?? "/admin/insights"}>
              {copy.viewDetails}
            </Link>
          </li>
        ))}
      </ul>
    </AdminPanel>
  );
}
