import Link from "next/link";
import { AdminPanel } from "@/components/admin/system/AdminPrimitives";
import type { TodayViewModel } from "./todayViewModel";
import { TODAY_COPY } from "./todayCopy";
import { TodayPanelState } from "./TodayPanelState";
import styles from "./AdminToday.module.css";

export function TodaySearches({ model }: { model: TodayViewModel }) {
  const copy = TODAY_COPY[model.locale];
  return (
    <AdminPanel
      action={<Link className={styles.panelLink} href="/admin/insights">{copy.viewDetails}</Link>}
      className={styles.searches}
      data-today-region="searches"
      title={copy.searches}
    >
      {model.searches.state.kind === "available" && model.searches.data ? (
        <ol className={styles.searchList}>
          {model.searches.data.map((item) => (
            <li key={item.key}>
              <span>{item.label}</span>
              <strong>{new Intl.NumberFormat(model.locale === "fr" ? "fr-CA" : "en-CA").format(item.count)}</strong>
            </li>
          ))}
        </ol>
      ) : <TodayPanelState message={model.searches.message} state={model.searches.state} />}
    </AdminPanel>
  );
}
