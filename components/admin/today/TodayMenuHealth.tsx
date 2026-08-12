import Link from "next/link";
import { AvailableDishIcon } from "@/components/admin/system/AdminIcons";
import { AdminPanel } from "@/components/admin/system/AdminPrimitives";
import type { TodayViewModel } from "./todayViewModel";
import { TODAY_COPY } from "./todayCopy";
import { TodayPanelState } from "./TodayPanelState";
import styles from "./AdminToday.module.css";

export function TodayMenuHealth({ model }: { model: TodayViewModel }) {
  const copy = TODAY_COPY[model.locale];
  return (
    <AdminPanel
      action={<Link className={styles.panelLink} href="/admin/more">{copy.viewDetails}</Link>}
      className={styles.menuHealth}
      data-today-region="menu-health"
      title={copy.menuHealth}
    >
      {model.menuHealth.state.kind === "available" && model.menuHealth.totalDishes !== null ? (
        <div className={styles.healthValue} data-evidence-id={model.menuHealth.evidenceId ?? undefined}>
          <span><AvailableDishIcon /></span>
          <strong>{new Intl.NumberFormat(model.locale === "fr" ? "fr-CA" : "en-CA").format(model.menuHealth.totalDishes)}</strong>
          <p>{model.menuHealth.label}</p>
        </div>
      ) : <TodayPanelState message={model.menuHealth.message} state={model.menuHealth.state} />}
    </AdminPanel>
  );
}
