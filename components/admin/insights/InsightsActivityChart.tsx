"use client";

import { useState } from "react";
import type { AdminMetricSeries, AdminMetricSeriesId } from "@/lib/admin/analyticsState";
import { InteractiveLineChart } from "../charts/InteractiveLineChart";
import styles from "./AdminInsights.module.css";

const options: { id: AdminMetricSeriesId; label: string }[] = [
  { id: "menuOpened", label: "Ouvertures" },
  { id: "dishOpened", label: "Consultations" },
  { id: "searches", label: "Recherches" },
];

export function InsightsActivityChart({ series }: { series: Record<AdminMetricSeriesId, AdminMetricSeries> }) {
  const [metric, setMetric] = useState<AdminMetricSeriesId>("menuOpened");
  const selected = series[metric];
  return <div>
    <h2 className={styles.activityTitle}>Activité du menu sur la période</h2>
    <div className={styles.metricSelector} role="group" aria-label="Mesure affichée">
      {options.map((option) => <button key={option.id} type="button" aria-pressed={metric === option.id} onClick={() => setMetric(option.id)}>{option.label}</button>)}
    </div>
    <InteractiveLineChart data={selected.current.map((point) => ({ label: point.timestampLabel, value: point.value }))} title="Activité du menu sur la période" description="Évolution exacte de la mesure choisie" period="Période analysée" unit="interactions" summary="Sélectionnez une mesure pour comparer son rythme quotidien."/>
  </div>;
}
