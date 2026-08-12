import Link from "next/link";
import { AdminPanel } from "@/components/admin/system/AdminPrimitives";
import type { TodayViewModel } from "./todayViewModel";
import { TODAY_COPY } from "./todayCopy";
import { TodayPanelState } from "./TodayPanelState";
import styles from "./AdminToday.module.css";

export function TodayTopDishes({ model }: { model: TodayViewModel }) {
  const copy = TODAY_COPY[model.locale];
  return (
    <AdminPanel
      action={<Link className={styles.panelLink} href="/admin/insights">{copy.viewDetails}</Link>}
      className={styles.topDishes}
      data-today-region="top-dishes"
      title={copy.topDishes}
    >
      {model.topDishes.state.kind === "available" && model.topDishes.data ? (
        <ol className={styles.ranking}>
          {model.topDishes.data.map((item) => (
            <li key={item.key}>
              <span className={styles.rank}>{item.rank}</span>
              <strong>{item.label}</strong>
              <span>{new Intl.NumberFormat(model.locale === "fr" ? "fr-CA" : "en-CA").format(item.count)}</span>
            </li>
          ))}
        </ol>
      ) : <TodayPanelState message={model.topDishes.message} state={model.topDishes.state} />}
    </AdminPanel>
  );
}
