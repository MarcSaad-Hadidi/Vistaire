"use client";
import { ChartFrame, MetricTooltip } from "./ChartFrame";
import { buildLineGeometry } from "./geometry";
import { formatChartValue } from "./formatters";
import { useChartInteraction, useReducedMotion } from "./useChartInteraction";
import type { AccessibleChartProps, ChartDatum } from "./types";
import styles from "./Charts.module.css";

export function InteractiveLineChart({ data, title, description, period, unit, summary, valueFormatter }: AccessibleChartProps & { data: ChartDatum[] }) {
  const interaction = useChartInteraction(data.length); const reduced = useReducedMotion();
  const geometry = buildLineGeometry(data.map(({ value }) => value), { width: 600, height: 220, padding: 24 });
  const text = (value: number) => valueFormatter?.(value) ?? formatChartValue(value, unit);
  const active = interaction.active === null ? null : data[interaction.active];
  return <ChartFrame rootRef={interaction.rootRef} title={title} description={description} period={period} unit={unit} summary={summary} exactValues={data.map(d => ({ label:d.label,value:text(d.value) }))}>{ids => <>
    <svg className={styles.svg} viewBox="0 0 600 220" role="group" aria-labelledby={`${ids.title} ${ids.description}`} aria-describedby={`${ids.details} ${ids.tooltip}`} onKeyDown={interaction.onKeyDown} onBlur={interaction.onBlur} data-reduced-motion={reduced}><title id={ids.title}>{title}</title><desc id={ids.description}>{description}. {summary}</desc>
      <polyline className={styles.line} points={geometry.points.map(p=>`${p.x},${p.y}`).join(" ")}/>{geometry.points.map((point,index)=><circle key={data[index].label} className={styles.mark} data-active={interaction.active===index} data-muted={interaction.active!==null&&interaction.active!==index} cx={point.x} cy={point.y} r="6" fill="var(--admin-accent,#d2aa67)" tabIndex={interaction.active===index||(interaction.active===null&&index===0)?0:-1} aria-label={`${data[index].label}, ${text(data[index].value)}`} aria-describedby={ids.tooltip} onFocus={()=>interaction.send({type:"focus",index})} onPointerEnter={()=>interaction.send({type:"hover",index})} onPointerLeave={()=>interaction.send({type:"leave"})} onClick={()=>interaction.send({type:"activate",index})}/>)}</svg>
    <MetricTooltip id={ids.tooltip} visible={!!active} label={active?.label??""} value={active?text(active.value):""} x={interaction.active===null?50:geometry.points[interaction.active].x/6} y={interaction.active===null?50:geometry.points[interaction.active].y/2.2}/></>}
  </ChartFrame>;
}
