import type { AdminLocale } from "@/lib/admin/foundationRoutes";
import type { AdminEvidenceBundle, AdminEvidenceRecord } from "@/lib/admin/data/evidenceRegistry";
import { ComparisonLineChart } from "../charts/ComparisonLineChart";
import { InteractiveDonut } from "../charts/InteractiveDonut";
import { InteractiveHeatmap } from "../charts/InteractiveHeatmap";
import { InteractiveLineChart } from "../charts/InteractiveLineChart";
import { Sparkline } from "../charts/Sparkline";
import { AdminPanel } from "../system/AdminPrimitives";
import styles from "./AdminInsights.module.css";

type SeriesPoint = Readonly<{ key: string; count: number }>;
type RankingPoint = Readonly<{ key: string; count: number; rank?: number }>;

function record(bundle: AdminEvidenceBundle, metricId: string, period: AdminEvidenceRecord["period"]) {
  return Object.values(bundle.records).find((item) => item.metricId === metricId && item.period === period);
}

function series(bundle: AdminEvidenceBundle, metricId: string, period: AdminEvidenceRecord["period"]): SeriesPoint[] {
  const candidate = record(bundle, metricId, period);
  if (candidate?.state.kind !== "available" || !Array.isArray(candidate.state.value)) return [];
  return candidate.state.value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const value = item as Record<string, unknown>;
    return typeof value.key === "string" && typeof value.count === "number" && Number.isFinite(value.count)
      ? [{ key: value.key, count: value.count }]
      : [];
  });
}

function ranking(bundle: AdminEvidenceBundle, metricId: string): RankingPoint[] {
  return series(bundle, metricId, "current").map((item, index) => ({ ...item, rank: index + 1 }));
}

function aligned(values: readonly SeriesPoint[], prefix: string) {
  return values.map((point, index) => ({
    label: `${prefix}${index + 1}`,
    detail: point.key,
    value: point.count
  }));
}

function heatmap(values: readonly SeriesPoint[]) {
  return values.flatMap((point) => {
    const match = /^(\d):([01]\d|2[0-3])$/.exec(point.key);
    if (!match) return [];
    const weekday = Number(match[1]);
    const rowOrder = [1, 2, 3, 4, 5, 6, 0];
    const row = rowOrder.indexOf(weekday);
    return row < 0 ? [] : [{ row, column: Number(match[2]), value: point.count }];
  });
}

function chartCopy(locale: AdminLocale) {
  return locale === "fr" ? {
    heading: "Analyses détaillées",
    intro: "Visualisations interactives fondées uniquement sur les preuves admises du registre.",
    current: "Activité observée",
    currentDescription: "Évolution exacte des ouvertures observées",
    comparison: "Comparaison des périodes",
    comparisonDescription: "Période actuelle et période précédente alignée",
    period: "Période analysée",
    previous: "Période précédente",
    interactions: "interactions",
    heatmap: "Moments d’activité",
    heatmapDescription: "Répartition exacte des consultations par jour et heure",
    category: "Répartition par catégorie",
    categoryDescription: "Consultations exactes par catégorie",
    dishes: "Répartition des plats consultés",
    dishesDescription: "Consultations exactes des plats classés",
    insufficient: "Les visualisations détaillées apparaîtront lorsque les preuves requises seront mesurées.",
    sparkLabels: ["Activité actuelle", "Activité précédente", "Répartition horaire", "Plats les plus consultés"]
  } : {
    heading: "Detailed analysis",
    intro: "Interactive visualizations based only on admitted registry evidence.",
    current: "Observed activity",
    currentDescription: "Exact trend of observed menu opens",
    comparison: "Period comparison",
    comparisonDescription: "Aligned current and previous periods",
    period: "Analysis period",
    previous: "Previous period",
    interactions: "interactions",
    heatmap: "Activity moments",
    heatmapDescription: "Exact dish-view distribution by day and hour",
    category: "Category distribution",
    categoryDescription: "Exact dish views by category",
    dishes: "Viewed dish distribution",
    dishesDescription: "Exact views of ranked dishes",
    insufficient: "Detailed visualizations will appear once the required evidence is measured.",
    sparkLabels: ["Current activity", "Previous activity", "Hourly distribution", "Most viewed dishes"]
  };
}

export function InsightsEvidenceCharts({ bundle, locale }: { bundle: AdminEvidenceBundle; locale: AdminLocale }) {
  const copy = chartCopy(locale);
  const period = `${copy.period} · ${bundle.window.range}`;
  const current = series(bundle, "activity-series", "current");
  const previous = series(bundle, "activity-series", "previous");
  const distribution = series(bundle, "time-distribution", "current");
  const cells = heatmap(distribution);
  const categories = ranking(bundle, "category-ranking").slice(0, 5);
  const dishes = ranking(bundle, "dish-ranking").slice(0, 5);
  const complete = current.length > 1 && previous.length > 1 && cells.length > 1 && categories.length > 1 && dishes.length > 1;

  return <section className={styles.detailedEvidence} aria-labelledby="detailed-evidence-title">
    <header className={styles.detailedEvidenceHeader}>
      <div><p>{copy.heading}</p><h2 id="detailed-evidence-title">{copy.heading}</h2></div>
      <span>{copy.intro}</span>
    </header>
    {!complete ? <p className={styles.detailedEvidenceEmpty}>{copy.insufficient}</p> : <>
      <div className={styles.evidenceSparklines} aria-label={copy.heading}>
        {[current, previous, distribution, dishes].map((values, index) => <article key={copy.sparkLabels[index]} data-kpi-trend>
          <span>{copy.sparkLabels[index]}</span>
          <Sparkline key={`${bundle.window.range}-${copy.sparkLabels[index]}`} values={values.map((item) => item.count)} label={copy.sparkLabels[index]} interactive />
        </article>)}
      </div>
      <div className={styles.primaryGrid}>
        <AdminPanel className={styles.activity} data-insights-panel>
          <InteractiveLineChart
            key={`activity-${bundle.window.range}`}
            data={current.map((point) => ({ label: point.key, value: point.count }))}
            title={copy.current}
            description={copy.currentDescription}
            period={period}
            unit={copy.interactions}
            summary={copy.intro}
            variant="detailed"
          />
        </AdminPanel>
        <AdminPanel className={styles.comparison} data-insights-panel>
          <ComparisonLineChart
            key={`comparison-${bundle.window.range}`}
            series={[
              { label: copy.current, values: aligned(current, "J") },
              { label: copy.previous, values: aligned(previous, "J") }
            ]}
            title={copy.comparison}
            description={copy.comparisonDescription}
            period={period}
            unit={copy.interactions}
            summary={copy.intro}
            variant="detailed"
          />
        </AdminPanel>
        <AdminPanel className={styles.heatmapPanel} data-insights-panel title={copy.heatmap}>
          <InteractiveHeatmap
            key={`heatmap-${bundle.window.range}`}
            data={cells}
            rowLabels={locale === "fr" ? ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
            columnLabels={Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")} h`)}
            title={copy.heatmap}
            description={copy.heatmapDescription}
            period={period}
            unit={copy.interactions}
            summary={copy.intro}
            variant="detailed"
          />
        </AdminPanel>
      </div>
      <div className={styles.evidenceDonutGrid}>
        <AdminPanel data-insights-panel>
          <InteractiveDonut
            key={`categories-${bundle.window.range}`}
            data={categories.map((point) => ({ label: point.key.replaceAll("-", " "), value: point.count }))}
            title={copy.category}
            description={copy.categoryDescription}
            period={period}
            unit={copy.interactions}
            summary={copy.intro}
            variant="detailed"
          />
        </AdminPanel>
        <AdminPanel data-insights-panel>
          <InteractiveDonut
            key={`dishes-${bundle.window.range}`}
            data={dishes.map((point) => ({ label: point.key.replaceAll("-", " "), value: point.count }))}
            title={copy.dishes}
            description={copy.dishesDescription}
            period={period}
            unit={copy.interactions}
            summary={copy.intro}
            variant="detailed"
          />
        </AdminPanel>
      </div>
    </>}
  </section>;
}
