"use client";
import { ChartFrame, MetricTooltip } from "./ChartFrame";
import { buildHeatmapCells, type HeatCellInput } from "./geometry";
import { formatChartValue } from "./formatters";
import { useChartInteraction, useReducedMotion } from "./useChartInteraction";
import type { AccessibleChartProps } from "./types";
import styles from "./Charts.module.css";

export function InteractiveHeatmap({ data, rowLabels, columnLabels, title, description, period, unit, summary, valueFormatter }: AccessibleChartProps & { data: HeatCellInput[]; rowLabels: string[]; columnLabels: string[] }) {
  const cells = buildHeatmapCells(data, rowLabels.length, columnLabels.length), columns = columnLabels.length;
  const interaction = useChartInteraction(cells.length, columns), reduced = useReducedMotion();
  const text = (value: number) => valueFormatter?.(value) ?? formatChartValue(value, unit), active = interaction.active, cell = active === null ? null : cells[active];
  const cellWidth = 560 / Math.max(1, columns), cellHeight = 180 / Math.max(1, rowLabels.length);
  return <ChartFrame rootRef={interaction.rootRef} title={title} description={description} period={period} unit={unit} summary={summary} exactValues={cells.map(item => ({ label: `${rowLabels[item.row]}, ${columnLabels[item.column]}`, value: text(item.value) }))}>{ids => <>
    <svg className={styles.svg} viewBox="0 0 600 220" role="grid" aria-rowcount={rowLabels.length} aria-colcount={columns} aria-labelledby={`${ids.title} ${ids.description}`} aria-describedby={`${ids.details} ${ids.tooltip}`} onKeyDown={interaction.onKeyDown} onBlur={interaction.onBlur} data-reduced-motion={reduced}><title id={ids.title}>{title}</title><desc id={ids.description}>{description}. Intensité faible à forte, chaque cellule expose sa valeur exacte. {summary}</desc>
      {rowLabels.map((rowLabel, row) => <g role="row" aria-label={rowLabel} aria-rowindex={row + 1} key={rowLabel}>{cells.slice(row * columns, (row + 1) * columns).map((item) => { const index = row * columns + item.column; return <rect key={`${item.row}:${item.column}`} role="gridcell" className={`${styles.mark} ${styles.heatCell}`} style={{ "--intensity": item.intensity } as React.CSSProperties} x={24 + item.column * cellWidth + 1} y={20 + item.row * cellHeight + 1} width={Math.max(1, cellWidth - 3)} height={Math.max(1, cellHeight - 3)} rx="3" tabIndex={active === index || (active === null && index === 0) ? 0 : -1} aria-rowindex={item.row + 1} aria-colindex={item.column + 1} aria-label={`${rowLabel}, ${columnLabels[item.column]}, ${text(item.value)}`} aria-describedby={ids.tooltip} onFocus={() => interaction.send({ type: "focus", index })} onPointerEnter={() => interaction.send({ type: "hover", index })} onPointerLeave={() => interaction.send({ type: "leave" })} onClick={() => interaction.send({ type: "activate", index })}/>; })}</g>)}
    </svg><MetricTooltip id={ids.tooltip} visible={!!cell} label={cell ? `${rowLabels[cell.row]}, ${columnLabels[cell.column]}` : ""} value={cell ? text(cell.value) : ""} x={cell ? (24 + (cell.column + .5) * cellWidth) / 6 : 50} y={cell ? (20 + (cell.row + .5) * cellHeight) / 2.2 : 50}/>
  </>}</ChartFrame>;
}
