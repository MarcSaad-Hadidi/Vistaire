"use client";
import { useStudioLocale } from "./studioLocale";
import {
  LineChart,
  HeatmapChart,
  HeatmapGrid,
  HeatmapTooltip,
  HeatmapLegend,
  Root,
  BarChart,
  BarSeries,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  createHeatmapScale,
} from "@kind-ui/charts";
import "@kind-ui/charts/styles.css";
import type { AdminMetricSeries } from "@/lib/admin/analyticsState";
import styles from "./Studio.module.css";

// Native grid-cell labels and the focus/touch tooltip retain exact values.
// Text inside all 168 cells would make a 24-hour mobile matrix unreadable.
function HeatmapSwatch() { return null; }

export function StudioTrend({
  series,
  label,
  comparison,
}: {
  series: AdminMetricSeries;
  label: string;
  comparison: boolean;
}) {
 const {t,locale,number,date:day}=useStudioLocale();
  const data = series.current.map((point, index) => ({
    date: point.bucket,
    current: point.value,
    previous: comparison ? (series.previous[index]?.value ?? null) : null,
  }));
  const config = {
    current: { label: t("Période sélectionnée"), color: "var(--chart-current)" },
    ...(comparison
      ? {
          previous: {
            label: t("Période précédente"),
            color: "var(--chart-previous)",
          },
        }
      : {}),
  };
  return (
    <div className={styles.chart} data-studio-chart="trend">
      <LineChart
        data={data}
        config={config}
        xDataKey="date"
        responsive
        height={300}
        curve="linear"
        accessibilityLayer
        aria-label={locale === "en" ? `${label} by day. Use left and right arrows to explore.` : `${label} par jour. Flèches gauche et droite pour explorer.`}
        rootProps={{
          interaction: {
            kind: "series",
            mode: "visibility",
            eligibleKeys: comparison ? ["current", "previous"] : ["current"],
          },
        }}
        xAxis={{
          tickFormatter: day,
          minTickGap: 30,
          tick: { fontSize: 11, fill: "var(--muted)" },
          axisLine: false,
          tickLine: false,
        }}
        yAxis={{
          allowDecimals: false,
          width: 46,
          tick: { fontSize: 11, fill: "var(--muted)" },
          axisLine: false,
          tickLine: false,
        }}
        grid={{
          vertical: false,
          stroke: "var(--line)",
          strokeDasharray: "2 5",
        }}
        margin={{ top: 15, right: 15, bottom: 8, left: 0 }}
        series={[
          {
            seriesKey: "current",
            dataKey: "current",
            strokeWidth: 2.5,
            dot: data.length === 1,
            activeDot: { r: 5 },
          },
          ...(comparison
            ? [
                {
                  seriesKey: "previous",
                  dataKey: "previous" as const,
                  strokeWidth: 2,
                  strokeDasharray: "6 5",
                  dot: data.length === 1,
                },
              ]
            : []),
        ]}
        legend={{ "aria-label": t("Afficher ou masquer une période") }}
      />
      {!comparison && (
        <p className={styles.muted}>{t("Comparaison précédente indisponible")}</p>
      )}
      <details className={styles.dataDisclosure}>
        <summary>{t("Voir les chiffres")}</summary>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date (UTC)</th>
                <th>{t("Actuel")}</th>
                <th>{t("Précédent")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.date}>
                  <td>{day(row.date)}</td>
                  <td>{number(row.current)}</td>
                  <td>
                    {row.previous === null ? "N/A" : number(row.previous)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
export function StudioBars({
  rows,
  label,
}: {
  rows: { label: string; count: number }[];
  label: string;
}) {
  const {t,number}=useStudioLocale();
  return (
    <div className={styles.chart}>
      <Root config={{ count: { label, color: "var(--chart-current)" } }}>
        <BarChart
          data={rows}
          responsive
          height={260}
          accessibilityLayer
          margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--line)"
            strokeDasharray="2 5"
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            width={42}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip />
          <BarSeries
            dataKey="count"
            fill="var(--chart-current)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </Root>
      <details className={styles.dataDisclosure}>
        <summary>{t("Voir les chiffres")}</summary>
        <table className={styles.table}>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{number(row.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
export function StudioHeatmap({
  cells,
}: {
  cells: { weekdayUtc: number; hourUtc: number; count: number }[];
}) {
  const {t,number}=useStudioLocale();
  const rows = [t("Lun"), t("Mar"), t("Mer"), t("Jeu"), t("Ven"), t("Sam"), t("Dim")];
  const columns = Array.from({ length: 24 }, (_, i) => `${i} h`);
  const counts = new Map(
    cells.map((cell) => [`${cell.weekdayUtc}:${cell.hourUtc}`, cell.count]),
  );
  const data = rows.flatMap((row, index) =>
    columns.map((column, hour) => ({
      row,
      column,
      value: counts.get(`${(index + 1) % 7}:${hour}`) ?? 0,
    })),
  );
  const max = Math.max(1, ...cells.map((cell) => cell.count));
  return (
    <div className={styles.chart}>
      <HeatmapChart
        rows={rows}
        columns={columns}
        data={data}
        scale={createHeatmapScale({
          domain: [0, max],
          colors: ["#e8f7ff", "#46c5de", "#3b82f6", "#5b21b6"],
        })}
        formatValue={number}
        missingLabel={t("Indisponible")}
        aria-label={t("Événements par jour et heure UTC")}
      >
          <HeatmapGrid
            className={styles.heatmapGrid}
            caption={t("Moments d’activité · heures UTC")}
            layout={{ gap: 2 }}
            Cell={HeatmapSwatch}
            columnLabel={(column) => {
              const hour = Number.parseInt(column, 10);
              return <><span aria-hidden="true">{hour % 6 === 0 || hour === 23 ? hour : ""}</span><span className={styles.srOnly}>{column}</span></>;
            }}
          />
        <HeatmapTooltip />
        <HeatmapLegend label={t("Nombre d’événements")} />
      </HeatmapChart>
    </div>
  );
}
