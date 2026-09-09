import Link from "next/link";
import { AlertIcon, InfoIcon, TrendIcon } from "@/components/admin/system/AdminIcons";
import { AdminPanel, AdminStatusBadge } from "@/components/admin/system/AdminPrimitives";
import type { TodayViewModel } from "./todayViewModel";
import { TODAY_COPY, todayStateLabel } from "./todayCopy";
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
          <li data-evidence-id={item.evidenceId ?? undefined} data-metric-id={item.metricId} key={item.metricId}>
            <span className={styles.briefingIcon} aria-hidden="true">
              {item.metricId === "observed-menu-opens" ? <AlertIcon /> : item.metricId === "dish-ranking" ? <TrendIcon /> : <InfoIcon />}
            </span>
            <div>
              <AdminStatusBadge tone={item.state.kind === "available" ? "available" : "neutral"}>
                {item.state.kind === "available" ? copy.currentPeriod : todayStateLabel(model.locale, item.state)}
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
