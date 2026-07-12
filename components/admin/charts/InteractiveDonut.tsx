"use client";

import { ChartFrame, MetricTooltip } from "./ChartFrame";
import { normalizeDonutData } from "./data";
import { buildDonutSegments, donutPath, polarPoint } from "./geometry";
import { formatChartValue } from "./formatters";
import { useChartInteraction, useReducedMotion } from "./useChartInteraction";
import type { AccessibleChartProps, ChartDatum } from "./types";
import styles from "./Charts.module.css";

const donutVisuals = [
  { color: "#d2aa67", path: "", swatch: "none" },
  { color: "#8e867b", path: "M0 0v8M4 0v8", swatch: "repeating-linear-gradient(90deg, transparent 0 2px, #171411 2px 3px)" },
  { color: "#6f8f77", path: "M0 2h8M0 6h8", swatch: "repeating-linear-gradient(0deg, transparent 0 2px, #171411 2px 3px)" },
  { color: "#b97862", path: "M0 0 8 8M8 0 0 8", swatch: "repeating-linear-gradient(45deg, transparent 0 2px, #171411 2px 3px)" },
  { color: "#7f7196", path: "M2 2h1v1H2zM6 6h1v1H6z", swatch: "radial-gradient(circle at center, #171411 0 1px, transparent 1.5px)" },
  { color: "#b99a84", path: "M4 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6", swatch: "radial-gradient(circle at center, transparent 0 2px, #171411 2.5px 3px, transparent 3.5px)" },
] as const;

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
}: AccessibleChartProps & { data: ChartDatum[] }) {
  const normalized = normalizeDonutData(data);
  const detailed = variant === "detailed";
  const outerRadius = detailed ? 88 : 58;
  const innerRadius = detailed ? 54 : 36;
  const center = detailed ? { x: 110, y: 110 } : { x: 70, y: 70 };
  const viewSize = detailed ? 220 : 140;
  const segments = buildDonutSegments(normalized.included.map(({ value }) => value), outerRadius, innerRadius);
  const interaction = useChartInteraction(segments.length);
  const reduced = useReducedMotion();
  const text = (value: number) => valueFormatter?.(value) ?? formatChartValue(value, unit);
  const total = normalized.included.reduce((sum, item) => sum + item.value, 0);
  const percentage = (value: number) => `${new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 1 }).format(total > 0 && value > 0 ? value / total * 100 : 0)} %`;
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
    exactValues={exactValues}
    chrome={detailed ? <><span>{period}</span><span>{unit}</span></> : undefined}
    legend={<ul className={styles.donutLegend} data-chart-legend>{normalized.included.map((item, index) => {
      const visual = donutVisuals[index % donutVisuals.length];
      return <li key={`${item.label}:${index}`}>
      <i aria-hidden="true" style={{ "--legend-color": visual.color, "--legend-detail": visual.swatch } as React.CSSProperties} />
      <span>{item.label}</span>
      {detailed ? <strong>{text(item.value)} <small data-chart-percentage>{percentage(item.value)}</small></strong> : null}
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
      <desc id={ids.description}>{description}. Chaque catégorie est identifiée par son libellé et sa valeur exacte. {summary}</desc>
      <defs>{donutVisuals.map((visual, index) => <pattern id={`${ids.title}-fill-${index}`} key={visual.color} width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill={visual.color} />
        {visual.path ? <path d={visual.path} stroke="#171411" strokeWidth="1.15" fill="none" /> : null}
      </pattern>)}</defs>
      <g key={animationKey} data-chart-animation-key={animationKey}>
      {segments.map((item, index) => {
        const segmentDatum = normalized.included[item.index];
        return <path
          key={`${segmentDatum.label}:${item.index}`}
          className={`${styles.mark} ${styles.donutSegment}`}
          style={{ "--chart-index": index } as React.CSSProperties}
          d={donutPath(item, center.x, center.y)}
          fill={`url(#${ids.title}-fill-${item.index % donutVisuals.length})`}
          tabIndex={active === index || (active === null && index === 0) ? 0 : -1}
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
