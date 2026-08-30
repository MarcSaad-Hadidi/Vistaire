"use client";

import Link from "next/link";
import { useState } from "react";
import { InteractiveLineChart } from "@/components/admin/charts/InteractiveLineChart";
import { AdminPanel } from "@/components/admin/system/AdminPrimitives";
import type { TodayViewModel } from "./todayViewModel";
import { TODAY_COPY } from "./todayCopy";
import { TodayPanelState } from "./TodayPanelState";
import styles from "./AdminToday.module.css";

export function TodayActivity({ model }: { model: TodayViewModel }) {
  const copy = TODAY_COPY[model.locale];
  const [metric, setMetric] = useState<"opens" | "dishes">("opens");
  const activity = metric === "opens"
    ? model.activity
    : {
        ...model.timeline,
        data: model.timeline.data ? { points: model.timeline.data.map(({ key, count }) => ({ key, count })) } : null
      };
  const points = activity.data?.points ?? [];
  const fr = model.locale === "fr";
  return (
    <AdminPanel
      action={<Link aria-label={fr ? "Voir les statistiques détaillées" : "View detailed statistics"} className={styles.panelLink} href="/admin/insights">{copy.viewDetails}</Link>}
      className={styles.activity}
      data-today-region="activity"
      title={copy.activity}
    >
      {activity.state.kind === "available" && activity.data ? (<>
        <div className={styles.activityMetricSelector} role="group" aria-label={fr ? "Mesure affichée" : "Displayed metric"}>
          <button aria-pressed={metric === "opens"} onClick={() => setMetric("opens")} type="button">{fr ? "Ouvertures" : "Opens"}</button>
          <button aria-pressed={metric === "dishes"} onClick={() => setMetric("dishes")} type="button">{fr ? "Consultations" : "Dish views"}</button>
        </div>
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
      </>) : <TodayPanelState message={activity.message} state={activity.state} />}
    </AdminPanel>
  );
}
