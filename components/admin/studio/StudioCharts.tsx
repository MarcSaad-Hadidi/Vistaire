"use client";
import { useId, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";
import chartStyles from "./StudioCharts.module.css";
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
function HeatmapSwatch() {
  return null;
}

export function StudioTrend({
  series,
  label,
  comparison,
}: {
  series: AdminMetricSeries;
  label: string;
  comparison: boolean;
}) {
  const { t, locale, number, date: day } = useStudioLocale();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const expand = useRef<HTMLButtonElement>(null);
  const [selection, setSelection] = useState(["current", "previous"]);
  const [inspection, setInspection] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const data = series.current.map((point, index) => ({
    date: point.bucket,
    previousDate: comparison ? (series.previous[index]?.bucket ?? null) : null,
    current: point.value,
    previous: comparison ? (series.previous[index]?.value ?? null) : null,
  }));
  const filteredVisible = selection.filter(
    (key) => key === "current" || comparison,
  );
  const visible = filteredVisible.length ? filteredVisible : ["current"];
  const setVisible = (next: string[]) => {
    if (next.length) setSelection(next);
  };
  const totals = {
    current: data.reduce((sum, row) => sum + row.current, 0),
    previous: data.reduce((sum, row) => sum + (row.previous ?? 0), 0),
  };
  const config = {
    current: { label: t("Actuel"), color: "var(--chart-current)" },
    ...(comparison
      ? { previous: { label: t("Précédent"), color: "var(--chart-previous)" } }
      : {}),
  };
  const inspected = data[Math.min(inspection, Math.max(0, data.length - 1))];
  const readout = inspected
    ? `${day(inspected.date)} · ${label} : ${number(inspected.current)} · ${t("Précédent")} : ${inspected.previousDate ? day(inspected.previousDate) + " · " + number(inspected.previous ?? undefined) : "N/A"}`
    : "";
  const plot = (large = false) => (
    <LineChart
      data={data}
      config={config}
      xDataKey="date"
      responsive
      height={large ? 430 : 320}
      curve="linear"
      animate={{ revealDurationMs: 550 }}
      accessibilityLayer
      aria-label={
        locale === "en"
          ? `${label} by day. Use left and right arrows to explore.`
          : `${label} par jour. Flèches gauche et droite pour explorer.`
      }
      rootProps={{
        interaction: {
          kind: "series",
          mode: "visibility",
          eligibleKeys: comparison ? ["current", "previous"] : ["current"],
        },
      }}
      visibleSeries={visible}
      onVisibleSeriesChange={setVisible}
      xAxis={{
        tickFormatter: day,
        minTickGap: 30,
        interval: "preserveStartEnd",
        height: 34,
        padding: { left: 10, right: 10 },
        tick: { fontSize: 11, fill: "var(--muted)" },
        axisLine: false,
        tickLine: false,
      }}
      yAxis={{
        allowDecimals: false,
        width: 56,
        tickCount: 5,
        domain: [0, "auto"],
        tick: { fontSize: 11, fill: "var(--muted)" },
        axisLine: false,
        tickLine: false,
      }}
      grid={{ vertical: false, stroke: "var(--line)", strokeDasharray: "2 5" }}
      margin={{ top: 16, right: 18, bottom: 12, left: 0 }}
      series={[
        {
          seriesKey: "current",
          dataKey: "current",
          strokeWidth: 2.7,
          dot: data.length === 1,
          activeDot: {
            r: 5,
            fill: "var(--surface)",
            stroke: "var(--chart-current)",
            strokeWidth: 2.5,
          },
        },
        ...(comparison
          ? [
              {
                seriesKey: "previous",
                dataKey: "previous" as const,
                strokeWidth: 2,
                strokeDasharray: "6 5",
                dot: data.length === 1,
                activeDot: {
                  r: 4,
                  fill: "var(--surface)",
                  stroke: "var(--chart-previous)",
                  strokeWidth: 2,
                },
              },
            ]
          : []),
      ]}
      tooltip={{
        cursor: { stroke: "var(--muted)", strokeDasharray: "4 4" },
        maxWidth: 310,
        content: ({ active, payload }) => {
          const row = payload?.[0]?.payload as
            (typeof data)[number] | undefined;
          if (!active || !row) return null;
          return (
            <div
              className={chartStyles.tooltip}
              data-kind-ui="chart-tooltip"
              data-studio-tooltip-date={row.date}
            >
              <strong>{label}</strong>
              <div>
                <span>{day(row.date)}</span>
                <b
                  data-kind-ui="chart-tooltip-value"
                  data-studio-tooltip-series="current"
                  data-studio-tooltip-value={row.current}
                >
                  {number(row.current)}
                </b>
              </div>
              {comparison && (
                <div>
                  <span>
                    {row.previousDate ? day(row.previousDate) : t("Précédent")}
                  </span>
                  <b
                    data-kind-ui="chart-tooltip-value"
                    data-studio-tooltip-series="previous"
                    data-studio-tooltip-date={row.previousDate ?? undefined}
                    data-studio-tooltip-value={row.previous ?? undefined}
                  >
                    {row.previous === null ? "N/A" : number(row.previous)}
                  </b>
                </div>
              )}
            </div>
          );
        },
      }}
      legend={{
        "aria-label": t("Afficher ou masquer une période"),
        emphasis: "none",
        children: ({ key, label: name, visible: shown, marker }) => (
          <>
            {marker}
            <span>{name}</span>
            <strong>{number(totals[key as keyof typeof totals])}</strong>
            <small>
              {locale === "en"
                ? shown
                  ? "Visible"
                  : "Hidden"
                : shown
                  ? "Visible"
                  : "Masqué"}
            </small>
          </>
        ),
      }}
    />
  );
  const inspector = (large = false) => (
    <div className={chartStyles.inspection}>
      <label htmlFor={`${id}-${large ? "expanded" : "inline"}`}>
        {locale === "en" ? "Explore days" : "Explorer les jours"}
        <span>
          {Math.min(inspection + 1, data.length)} / {data.length}
        </span>
      </label>
      <input
        id={`${id}-${large ? "expanded" : "inline"}`}
        type="range"
        min={0}
        max={Math.max(0, data.length - 1)}
        value={Math.min(inspection, Math.max(0, data.length - 1))}
        onChange={(event) => setInspection(Number(event.target.value))}
        aria-valuetext={readout}
      />
      <p role="status" aria-live="polite">
        {readout}
      </p>
    </div>
  );
  return (
    <div
      className={`${styles.chart} ${chartStyles.trend}`}
      data-studio-chart="trend"
    >
      <div className={chartStyles.command}>
        <span>
          {locale === "en" ? "Daily" : "Par jour"}
          <i />
          {data.length
            ? `${day(data[0].date)} — ${day(data[data.length - 1].date)}`
            : ""}
        </span>
        <button
          ref={expand}
          type="button"
          onClick={() => {
            setExpanded(true);
            dialog.current?.showModal();
          }}
          aria-label={
            locale === "en"
              ? "Expand trend chart"
              : "Agrandir le graphique d’évolution"
          }
        >
          {locale === "en" ? "Expand" : "Agrandir"}
          <Maximize2 size={14} />
        </button>
      </div>
      {data.length ? (
        plot()
      ) : (
        <p>
          {locale === "en"
            ? "No data for this period"
            : "Aucune donnée pour cette période"}
        </p>
      )}
      {!comparison && (
        <p className={styles.muted}>
          {t("Comparaison précédente indisponible")}
        </p>
      )}
      <details className={styles.dataDisclosure}>
        <summary>{t("Voir les chiffres")}</summary>
        <p>
          {locale === "en"
            ? "Hover or touch the chart. Select a legend to hide its line. Use arrow keys or the slider to inspect days."
            : "Survolez ou touchez le graphique. Cliquez sur une légende pour masquer sa courbe. Explorez les jours au clavier ou avec le curseur."}
        </p>
        {inspector()}
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date (UTC)</th>
                <th>{t("Actuel")}</th>
                <th>{locale === "en" ? "Previous date" : "Date précédente"}</th>
                <th>{t("Précédent")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.date}>
                  <td>{day(row.date)}</td>
                  <td>{number(row.current)}</td>
                  <td>{row.previousDate ? day(row.previousDate) : "N/A"}</td>
                  <td>
                    {row.previous === null ? "N/A" : number(row.previous)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <dialog
        ref={dialog}
        className={chartStyles.dialog}
        aria-labelledby={`${id}-title`}
        onClose={() => {
          setExpanded(false);
          expand.current?.focus();
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            dialog.current?.close();
        }}
      >
        <header>
          <div>
            <span>{t("Analyses")}</span>
            <h2 id={`${id}-title`}>
              {locale === "en"
                ? "A closer look at the trend"
                : "L’évolution, en grand."}
            </h2>
            <p>{label}</p>
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label={
              locale === "en"
                ? "Close expanded chart"
                : "Fermer le graphique agrandi"
            }
          >
            <X size={18} />
          </button>
        </header>
        {expanded && (
          <>
            {plot(true)}
            {inspector(true)}
          </>
        )}
      </dialog>
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
  const { t, number } = useStudioLocale();
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
  const { t, number } = useStudioLocale();
  const rows = [
    t("Lun"),
    t("Mar"),
    t("Mer"),
    t("Jeu"),
    t("Ven"),
    t("Sam"),
    t("Dim"),
  ];
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
            return (
              <>
                <span aria-hidden="true">
                  {hour % 6 === 0 || hour === 23 ? hour : ""}
                </span>
                <span className={styles.srOnly}>{column}</span>
              </>
            );
          }}
        />
        <HeatmapTooltip />
        <HeatmapLegend label={t("Nombre d’événements")} />
      </HeatmapChart>
    </div>
  );
}
