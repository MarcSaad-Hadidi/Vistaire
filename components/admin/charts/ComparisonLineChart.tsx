"use client";
import { ChartFrame, MetricTooltip } from "./ChartFrame";
import { normalizeComparisonSeries } from "./data";
import { formatChartValue } from "./formatters";
import { useChartInteraction, useReducedMotion } from "./useChartInteraction";
import type { AccessibleChartProps, ChartSeries } from "./types";
import styles from "./Charts.module.css";

export function ComparisonLineChart(props: AccessibleChartProps & { series: ChartSeries[] }) {
  const normalized = normalizeComparisonSeries(props.series);
  if (normalized.kind === "misaligned") return <p role="alert">Comparaison indisponible. {normalized.reason}</p>;
  return <AlignedComparison {...props} series={normalized.series}/>;
}

function AlignedComparison({ series, title, description, period, unit, summary, valueFormatter }: AccessibleChartProps & { series: ChartSeries[] }) {
  const count = series[0].values.length, interaction = useChartInteraction(count), reduced = useReducedMotion();
  const all = series.flatMap(item => item.values.map(({ value }) => value)), min = Math.min(0, ...all), max = Math.max(0, ...all), range = max - min || 1;
  const point = (value: number, index: number) => ({ x: 24 + (count < 2 ? 276 : index * 552 / (count - 1)), y: 24 + (max - value) / range * 172 });
  const text = (value: number) => valueFormatter?.(value) ?? formatChartValue(value, unit), active = interaction.active;
  return <ChartFrame rootRef={interaction.rootRef} title={title} description={description} period={period} unit={unit} summary={summary} exactValues={series.flatMap(item => item.values.map(value => ({ label: value.label, series: item.label, value: text(value.value) })))}>{ids => <>
    <svg className={styles.svg} viewBox="0 0 600 220" role="group" aria-labelledby={`${ids.title} ${ids.description}`} aria-describedby={`${ids.details} ${ids.tooltip}`} onKeyDown={interaction.onKeyDown} onBlur={interaction.onBlur} data-reduced-motion={reduced}><title id={ids.title}>{title}</title><desc id={ids.description}>{description}. {summary}</desc>
      {series.map((item, seriesIndex) => <polyline key={item.label} className={`${styles.line} ${seriesIndex ? styles.lineSecondary : ""}`} points={item.values.map((value, index) => { const p = point(value.value, index); return `${p.x},${p.y}`; }).join(" ")}/>)}
      {series[0].values.map((datum, index) => { const p = point(datum.value, index); return <circle key={datum.label} className={styles.mark} cx={p.x} cy={p.y} r="7" fill="transparent" stroke="transparent" tabIndex={active === index || (active === null && index === 0) ? 0 : -1} aria-label={series.map(item => `${item.label}: ${text(item.values[index].value)}`).join(", ")} aria-describedby={ids.tooltip} onFocus={() => interaction.send({ type: "focus", index })} onPointerEnter={() => interaction.send({ type: "hover", index })} onPointerLeave={() => interaction.send({ type: "leave" })} onClick={() => interaction.send({ type: "activate", index })}/>; })}
    </svg><MetricTooltip id={ids.tooltip} visible={active !== null} label={active === null ? "" : series[0].values[active].label} value={active === null ? "" : series.map(item => `${item.label}: ${text(item.values[active].value)}`).join(" · ")} x={active === null ? 50 : point(0, active).x / 6} y={15}/>
    <ul className={styles.legend}>{series.map((item, index) => <li key={item.label}><i style={{ "--legend-color": index ? "#8e867b" : "var(--admin-accent,#d2aa67)" } as React.CSSProperties}/>{item.label}{index ? " — tirets" : " — trait plein"}</li>)}</ul>
  </>}</ChartFrame>;
}
