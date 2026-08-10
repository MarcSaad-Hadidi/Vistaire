"use client";

import { ChartFrame, MetricTooltip, type ChartFrameCopy } from "./ChartFrame";
import { normalizeDonutData } from "./data";
import { buildDonutSegments, donutPath, polarPoint } from "./geometry";
import { formatChartValue } from "./formatters";
import { useChartInteraction, useReducedMotion } from "./useChartInteraction";
import type { AccessibleChartProps, ChartDatum } from "./types";
import styles from "./Charts.module.css";

const donutVisuals = [
  { color: "#e0b968" },
  { color: "#b38d4d" },
  { color: "#8b7042" },
  { color: "#67573b" },
  { color: "#4b4438" },
  { color: "#302e2a" },
] as const;

export type InteractiveDonutCopy = { categoryDescription: string };
const DEFAULT_DONUT_COPY: InteractiveDonutCopy = {
  categoryDescription: "Chaque catégorie est identifiée par son libellé et sa valeur exacte.",
};

export function InteractiveDonut({
  data,
  title,
  subtitle,
  description,
  period,
  unit,
  summary,
  variant = "compact",
  valueFormatter,
  numberLocale = "fr-CA",
  frameCopy,
  copy = DEFAULT_DONUT_COPY,
}: AccessibleChartProps & { data: ChartDatum[]; numberLocale?: string; frameCopy?: ChartFrameCopy; copy?: InteractiveDonutCopy }) {
  const normalized = normalizeDonutData(data);
  const detailed = variant === "detailed";
  const outerRadius = detailed ? 88 : 58;
  const innerRadius = detailed ? 54 : 36;
  const center = detailed ? { x: 110, y: 110 } : { x: 70, y: 70 };
  const viewSize = detailed ? 220 : 140;
  const segments = buildDonutSegments(normalized.included.map(({ value }) => value), outerRadius, innerRadius);
  const interaction = useChartInteraction(segments.length);
  const reduced = useReducedMotion();
  const text = (value: number) => valueFormatter?.(value) ?? formatChartValue(value, unit, numberLocale);
  const visibleText = (value: number) => text(value).replace(/\u00a0/g, " ");
  const total = normalized.included.reduce((sum, item) => sum + item.value, 0);
  const percentage = (value: number) => `${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 }).format(total > 0 && value > 0 ? value / total * 100 : 0)} %`;
  const active = interaction.active;
  const segment = active === null ? null : segments[active];
  const datum = segment ? normalized.included[segment.index] : null;
  const anchor = segment ? polarPoint(center.x, center.y, (outerRadius + innerRadius) / 2, (segment.startAngle + segment.endAngle) / 2) : null;
  const exactValues = normalized.included.map((item) => ({
    label: item.label,
    value: detailed ? `${text(item.value)} · ${percentage(item.value)}` : text(item.value),
  }));
  const animationKey = `${title}:${period}:${normalized.included.map(({ label, value }) => `${label}:${value}`).join("|")}`;

  return <ChartFrame
    rootRef={interaction.rootRef}
    kind="donut"
    className={`${styles.donutFrame} ${detailed ? styles.donutDetailed : styles.donutCompact}`}
    variant={variant}
    title={title}
    subtitle={subtitle}
    description={description}
    period={period}
    unit={unit}
    summary={summary}
    copy={frameCopy}
    exactValues={exactValues}
    chrome={detailed ? <><span>{period}</span><span>{unit}</span></> : undefined}
    legend={<ul className={styles.donutLegend} data-chart-legend>{normalized.included.map((item, index) => {
      const visual = donutVisuals[index % donutVisuals.length];
      return <li key={`${item.label}:${index}`}>
      <i aria-hidden="true" style={{ "--legend-color": visual.color } as React.CSSProperties} />
      <span>{item.label}</span>
      {detailed ? <strong>{visibleText(item.value)} <small data-chart-percentage>{percentage(item.value)}</small></strong> : null}
    </li>;
    })}</ul>}
    plot={(ids) => <svg
      className={`${styles.svg} ${styles.donutSvg}`}
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      role="group"
      data-chart-kind="donut"
      aria-labelledby={`${ids.title} ${ids.description}`}
      aria-describedby={`${ids.details} ${ids.tooltip}`}
      onKeyDown={interaction.onKeyDown}
      onBlur={interaction.onBlur}
      data-reduced-motion={reduced}
    >
      <title id={ids.title}>{title}</title>
      <desc id={ids.description}>{description}. {copy.categoryDescription} {summary}</desc>
      <g key={animationKey} data-chart-animation-key={animationKey}>
      {segments.map((item, index) => {
        const segmentDatum = normalized.included[item.index];
        return <path
          key={`${segmentDatum.label}:${item.index}`}
          data-chart-animated="donut-segment"
          className={`${styles.mark} ${styles.donutSegment}`}
          role="button"
          style={{ "--chart-index": index } as React.CSSProperties}
          d={donutPath(item, center.x, center.y)}
          fill={donutVisuals[item.index % donutVisuals.length].color}
          tabIndex={active === index || (active === null && index === 0) ? 0 : -1}
          aria-pressed={interaction.pinned && active === index}
          aria-label={`${segmentDatum.label}, ${text(segmentDatum.value)}, ${percentage(segmentDatum.value)}, catégorie ${index + 1} sur ${segments.length}`}
          aria-describedby={ids.tooltip}
          onFocus={() => interaction.send({ type: "focus", index })}
          onPointerEnter={() => interaction.send({ type: "hover", index })}
          onPointerLeave={() => interaction.send({ type: "leave" })}
          onClick={() => interaction.send({ type: "activate", index })}
        />;
      })}
      </g>
    </svg>}
    tooltip={(ids) => <MetricTooltip
      id={ids.tooltip}
      visible={datum !== null}
      label={datum?.label ?? ""}
      value={datum ? detailed ? `${text(datum.value)} · ${percentage(datum.value)}` : text(datum.value) : undefined}
      x={anchor ? anchor.x / viewSize * 100 : 50}
      y={anchor ? anchor.y / viewSize * 100 : 50}
    />}
  />;
}
