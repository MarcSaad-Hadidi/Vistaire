import Link from "next/link";
import { InteractiveLineChart } from "@/components/admin/charts/InteractiveLineChart";
import { AdminPanel } from "@/components/admin/system/AdminPrimitives";
import type { TodayViewModel } from "./todayViewModel";
import { TODAY_COPY } from "./todayCopy";
import { TodayPanelState } from "./TodayPanelState";
import styles from "./AdminToday.module.css";

export function TodayActivity({ model }: { model: TodayViewModel }) {
  const copy = TODAY_COPY[model.locale];
  const points = model.activity.data?.points ?? [];
  return (
    <AdminPanel
      action={<Link className={styles.panelLink} href="/admin/insights">{copy.viewDetails}</Link>}
      className={styles.activity}
      data-today-region="activity"
      title={copy.activity}
    >
      {model.activity.state.kind === "available" && model.activity.data ? (
        <InteractiveLineChart
          data={points.map((point) => ({ label: point.key, value: point.count }))}
          description={model.locale === "fr" ? "Interactions observées au fil du service" : "Observed interactions throughout the service"}
          numberLocale={model.locale === "fr" ? "fr-CA" : "en-CA"}
          period={copy.currentPeriod}
          summary={model.locale === "fr" ? "Valeurs exactes issues du registre de preuves." : "Exact values from the evidence registry."}
          title={copy.activity}
          unit={model.locale === "fr" ? "interactions observées" : "observed interactions"}
          variant="detailed"
        />
      ) : <TodayPanelState message={model.activity.message} state={model.activity.state} />}
    </AdminPanel>
  );
}
