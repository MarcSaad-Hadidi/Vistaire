"use client";
import { ChartFrame, MetricTooltip } from "./ChartFrame";
import { normalizeDonutData } from "./data";
import { buildDonutSegments, donutPath, polarPoint } from "./geometry";
import { formatChartValue } from "./formatters";
import { useChartInteraction, useReducedMotion } from "./useChartInteraction";
import type { AccessibleChartProps, ChartDatum } from "./types";
import styles from "./Charts.module.css";
const colors = ["#d2aa67", "#8e867b", "#6f8f77", "#b97862", "#7f7196", "#b99a84"];
const shapes = ["plein", "hachures diagonales", "points", "hachures croisées", "lignes horizontales", "anneaux"];

export function InteractiveDonut({ data, title, description, period, unit, summary, valueFormatter }: AccessibleChartProps & { data: ChartDatum[] }) {
  const normalized = normalizeDonutData(data), segments = buildDonutSegments(normalized.included.map(({ value }) => value), 92, 56);
  const interaction = useChartInteraction(segments.length), reduced = useReducedMotion(), text = (value: number) => valueFormatter?.(value) ?? formatChartValue(value, unit);
  const active = interaction.active, segment = active === null ? null : segments[active], datum = segment ? normalized.included[segment.index] : null;
  const exactValues = [...normalized.included.map(item => ({ label: item.label, series: "Inclus", value: text(item.value) })), ...normalized.excluded.map(item => ({ label: item.label, series: "Exclu du donut (valeur non positive)", value: text(item.value) }))];
  return <ChartFrame rootRef={interaction.rootRef} title={title} description={description} period={period} unit={unit} summary={summary} exactValues={exactValues}>{ids => <>
    <svg className={styles.svg} viewBox="0 0 240 220" role="group" aria-labelledby={`${ids.title} ${ids.description}`} aria-describedby={`${ids.details} ${ids.tooltip}`} onKeyDown={interaction.onKeyDown} onBlur={interaction.onBlur} data-reduced-motion={reduced}><title id={ids.title}>{title}</title><desc id={ids.description}>{description}. Motifs distincts en plus des couleurs. Les valeurs non positives sont exclues et signalées dans le tableau exact. {summary}</desc>
      <defs>{colors.map((color, index) => <pattern id={`${ids.title}-pattern-${index}`} key={color} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform={index === 1 ? "rotate(45)" : undefined}><rect width="8" height="8" fill={color}/>{index > 0 && <path d={index === 2 ? "M2 2h1v1H2zM6 6h1v1H6z" : index === 3 ? "M0 0 8 8M8 0 0 8" : index === 4 ? "M0 2h8M0 6h8" : index === 5 ? "M4 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6" : "M0 0v8"} stroke="#171411" strokeWidth="1.2" fill="none"/>}</pattern>)}</defs>
      {segments.map((item, index) => <path key={item.index} className={`${styles.mark} ${styles.donutSegment}`} d={donutPath(item, 120, 110)} fill={`url(#${ids.title}-pattern-${index % colors.length})`} tabIndex={active === index || (active === null && index === 0) ? 0 : -1} aria-label={`${normalized.included[item.index].label}, motif ${shapes[index % shapes.length]}, ${text(item.value)}`} aria-describedby={ids.tooltip} onFocus={() => interaction.send({ type: "focus", index })} onPointerEnter={() => interaction.send({ type: "hover", index })} onPointerLeave={() => interaction.send({ type: "leave" })} onClick={() => interaction.send({ type: "activate", index })}/>)}
    </svg><MetricTooltip id={ids.tooltip} visible={!!datum} label={datum?.label ?? ""} value={datum ? text(datum.value) : ""} x={segment ? polarPoint(120, 110, 75, (segment.startAngle + segment.endAngle) / 2).x / 2.4 : 50} y={segment ? polarPoint(120, 110, 75, (segment.startAngle + segment.endAngle) / 2).y / 2.2 : 50}/>
    <ul className={styles.legend}>{normalized.included.map((item, index) => <li key={item.label}><i style={{ "--legend-color": colors[index % colors.length] } as React.CSSProperties}/>{item.label}: {text(item.value)} — {shapes[index % shapes.length]}</li>)}</ul>
    {normalized.excluded.length ? <p className={styles.exclusionNote}>{normalized.excluded.length} valeur(s) non positive(s) exclue(s) du donut; détails dans le tableau exact.</p> : null}
  </>}</ChartFrame>;
}
