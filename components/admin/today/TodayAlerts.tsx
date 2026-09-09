import { AdminPanel, AdminStatusBadge } from "@/components/admin/system/AdminPrimitives";
import type { TodayViewModel } from "./todayViewModel";
import { TODAY_COPY } from "./todayCopy";
import { TodayPanelState } from "./TodayPanelState";
import styles from "./AdminToday.module.css";

export function TodayAlerts({ model }: { model: TodayViewModel }) {
  const copy = TODAY_COPY[model.locale];
  return (
    <AdminPanel className={styles.alerts} data-today-region="alerts" title={copy.alerts}>
      {model.alerts.state.kind === "available" && model.alerts.data ? (
        <ul className={styles.rows}>
          {model.alerts.data.map((item) => (
            <li key={item.key}>
              <AdminStatusBadge tone="unavailable">{model.locale === "fr" ? "À vérifier" : "Review"}</AdminStatusBadge>
              <div><strong>{item.label}</strong><span>{item.detail}</span></div>
            </li>
          ))}
        </ul>
      ) : <TodayPanelState message={model.alerts.message} state={model.alerts.state} />}
    </AdminPanel>
  );
}
