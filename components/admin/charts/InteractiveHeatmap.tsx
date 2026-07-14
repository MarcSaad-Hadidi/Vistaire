"use client";

import { ChartFrame, MetricTooltip } from "./ChartFrame";
import { buildHeatmapCells, selectAxisLabelIndexes, type HeatCellInput } from "./geometry";
import { formatChartValue } from "./formatters";
import { useChartInteraction, useReducedMotion } from "./useChartInteraction";
import type { AccessibleChartProps } from "./types";
import styles from "./Charts.module.css";

const width = 640;
const height = 240;
const left = 46;
const right = 12;
const top = 26;
const bottom = 42;

export function InteractiveHeatmap({
  data,
  rowLabels,
  columnLabels,
  title,
  subtitle,
  description,
  period,
  unit,
  summary,
  variant = "compact",
  valueFormatter,
}: AccessibleChartProps & { data: HeatCellInput[]; rowLabels: string[]; columnLabels: string[] }) {
  const cells = buildHeatmapCells(data, rowLabels.length, columnLabels.length);
  const columns = columnLabels.length;
  const interaction = useChartInteraction(cells.length, columns);
  const reduced = useReducedMotion();
  const text = (value: number) => valueFormatter?.(value) ?? formatChartValue(value, unit);
  const active = interaction.active;
  const cell = active === null ? null : cells[active];
  const cellWidth = (width - left - right) / Math.max(1, columns);
  const cellHeight = (height - top - bottom) / Math.max(1, rowLabels.length);
  const hourIndexes = columnLabels.length === 24 ? [0, 3, 6, 9, 12, 15, 18, 21] : selectAxisLabelIndexes(columnLabels.length, 8);
  const cellX = (column: number) => left + column * cellWidth;
  const cellY = (row: number) => top + row * cellHeight;
  const animationKey = `${title}:${period}:${cells.map(({ row, column, value }) => `${row}:${column}:${value}`).join("|")}`;

  return <ChartFrame
    rootRef={interaction.rootRef}
    kind="heatmap"
    className={styles.heatmapFrame}
    variant={variant}
    title={title}
    subtitle={subtitle}
    description={description}
    period={period}
    unit={unit}
    summary={summary}
    exactValues={cells.map((item) => ({ label: `${rowLabels[item.row]}, ${columnLabels[item.column]}`, value: text(item.value) }))}
    chrome={variant === "detailed" ? <><span>{period}</span><span>{unit}</span></> : undefined}
    legend={<div className={styles.heatLegend} data-chart-heat-legend><span>Faible → Forte</span><i aria-hidden="true"/></div>}
    axes={(ids) => <svg
      className={`${styles.svg} ${styles.heatmapSvg} ${styles.axesOverlay}`}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
      data-axis-owner={ids.title}
    >
      <g data-chart-axis="hours" className={styles.heatAxes}>
        {hourIndexes.map((index) => <text key={`${columnLabels[index]}:${index}`} x={cellX(index) + cellWidth / 2} y="15" textAnchor="middle">{columnLabels[index]}</text>)}
      </g>
      <g data-chart-axis="rows" className={styles.heatAxes}>
        {rowLabels.map((rowLabel, row) => <text key={rowLabel} x={left - 8} y={cellY(row) + cellHeight / 2} textAnchor="end" dominantBaseline="middle">{rowLabel}</text>)}
      </g>
    </svg>}
    plot={(ids) => <svg
      className={`${styles.svg} ${styles.heatmapSvg}`}
      viewBox={`0 0 ${width} ${height}`}
      role="grid"
      data-chart-kind="heatmap"
      aria-rowcount={rowLabels.length}
      aria-colcount={columns}
      aria-labelledby={`${ids.title} ${ids.description}`}
      aria-describedby={`${ids.details} ${ids.tooltip}`}
      onKeyDown={interaction.onKeyDown}
      onBlur={interaction.onBlur}
      data-reduced-motion={reduced}
    >
      <title id={ids.title}>{title}</title>
      <desc id={ids.description}>{description}. Intensité de faible à élevée, avec une valeur exacte par cellule. {summary}</desc>
      <g key={animationKey} data-chart-animation-key={animationKey}>
      {rowLabels.map((rowLabel, row) => <g role="row" aria-label={rowLabel} aria-rowindex={row + 1} key={rowLabel}>
        {cells.slice(row * columns, (row + 1) * columns).map((item) => {
          const index = row * columns + item.column;
          return <rect
            key={`${item.row}:${item.column}`}
            role="gridcell"
            data-chart-animated="heat-cell"
            className={`${styles.mark} ${styles.heatCell}`}
            style={{ "--intensity": item.intensity, "--chart-index": index % Math.max(1, columns) } as React.CSSProperties}
            x={cellX(item.column) + 2}
            y={cellY(item.row) + 2}
            width={Math.max(1, cellWidth - 4)}
            height={Math.max(1, cellHeight - 4)}
            rx="3"
            tabIndex={active === index || (active === null && index === 0) ? 0 : -1}
            aria-selected={interaction.pinned && active === index}
            aria-rowindex={item.row + 1}
            aria-colindex={item.column + 1}
            aria-label={`${rowLabel}, ${columnLabels[item.column]}, ${text(item.value)}`}
            aria-describedby={ids.tooltip}
            onFocus={() => interaction.send({ type: "focus", index })}
            onPointerEnter={() => interaction.send({ type: "hover", index })}
            onPointerLeave={() => interaction.send({ type: "leave" })}
            onClick={() => interaction.send({ type: "activate", index })}
          />;
        })}
      </g>)}
      </g>
    </svg>}
    tooltip={(ids) => <MetricTooltip
      id={ids.tooltip}
      visible={cell !== null}
      label={cell ? `${rowLabels[cell.row]}, ${columnLabels[cell.column]}` : ""}
      value={cell ? text(cell.value) : undefined}
      x={cell ? (cellX(cell.column) + cellWidth / 2) / width * 100 : 50}
      y={cell ? (cellY(cell.row) + cellHeight / 2) / height * 100 : 50}
    />}
  />;
}
