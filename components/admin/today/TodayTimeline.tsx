import { AdminPanel } from "@/components/admin/system/AdminPrimitives";
import type { TodayViewModel } from "./todayViewModel";
import { TODAY_COPY } from "./todayCopy";
import { TodayPanelState } from "./TodayPanelState";
import styles from "./AdminToday.module.css";

export function TodayTimeline({ model }: { model: TodayViewModel }) {
  const copy = TODAY_COPY[model.locale];
  return (
    <AdminPanel className={styles.timeline} data-today-region="timeline" title={copy.timeline}>
      {model.timeline.state.kind === "available" && model.timeline.data ? (
        <ol className={styles.timelineList}>
          {model.timeline.data.map((item) => (
            <li key={item.key}>
              <time>{item.label}</time>
              <span>{new Intl.NumberFormat(model.locale === "fr" ? "fr-CA" : "en-CA").format(item.count)} {model.locale === "fr" ? "interactions observées" : "observed interactions"}</span>
            </li>
          ))}
        </ol>
      ) : <TodayPanelState message={model.timeline.message} state={model.timeline.state} />}
    </AdminPanel>
  );
}
