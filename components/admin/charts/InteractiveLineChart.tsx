"use client";

import { CartesianAxes, CARTESIAN_PLOT } from "./CartesianAxes";
import { ChartFrame, MetricTooltip } from "./ChartFrame";
import { buildAreaPath, buildLineGeometry, buildNiceLineDomain, isStableSeries } from "./geometry";
import { formatChartValue } from "./formatters";
import { useChartInteraction, useReducedMotion } from "./useChartInteraction";
import type { AccessibleChartProps, ChartDatum } from "./types";
import styles from "./Charts.module.css";

const plotWidth = CARTESIAN_PLOT.width - CARTESIAN_PLOT.left - CARTESIAN_PLOT.right;
const plotHeight = CARTESIAN_PLOT.height - CARTESIAN_PLOT.top - CARTESIAN_PLOT.bottom;
const plotBottom = CARTESIAN_PLOT.height - CARTESIAN_PLOT.bottom;

export function InteractiveLineChart({
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
  const interaction = useChartInteraction(data.length);
  const reduced = useReducedMotion();
  const values = data.map(({ value }) => value);
  const stable = isStableSeries(values);
  const resolvedSummary = stable ? `${summary} Activité stable sur cette période.` : summary;
  const domain = buildNiceLineDomain(values);
  const rawGeometry = buildLineGeometry(values, { width: plotWidth, height: plotHeight }, domain);
  const points = rawGeometry.points.map((point) => ({ x: point.x + CARTESIAN_PLOT.left, y: point.y + CARTESIAN_PLOT.top }));
  const text = (value: number) => valueFormatter?.(value) ?? formatChartValue(value, unit);
  const axisText = (value: number) => new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 1 }).format(value);
  const activeIndex = interaction.active;
  const active = activeIndex === null ? null : data[activeIndex];
  const activePoint = activeIndex === null ? null : points[activeIndex];
  const linePath = points.length ? `M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")}` : "";
  const animationKey = `${title}:${period}:${data.map(({ label, value }) => `${label}:${value}`).join("|")}`;

  return <ChartFrame
    rootRef={interaction.rootRef}
    kind="line"
    className={styles.cartesianFrame}
    variant={variant}
    title={title}
    subtitle={subtitle}
    description={description}
    period={period}
    unit={unit}
    summary={resolvedSummary}
    exactValues={data.map((datum) => ({ label: datum.label, value: text(datum.value) }))}
    chrome={variant === "detailed" ? <><span>{period}</span><span>{unit}</span></> : undefined}
    axes={(ids) => <svg
      className={`${styles.svg} ${styles.cartesianSvg} ${styles.axesOverlay}`}
      viewBox={`0 0 ${CARTESIAN_PLOT.width} ${CARTESIAN_PLOT.height}`}
      aria-hidden="true"
      focusable="false"
      data-axis-owner={ids.title}
    >
      <CartesianAxes labels={data.map(({ label }) => label)} domain={domain} valueFormatter={axisText} maximumXLabels={7} />
    </svg>}
    plot={(ids) => <svg
      className={`${styles.svg} ${styles.cartesianSvg}`}
      viewBox={`0 0 ${CARTESIAN_PLOT.width} ${CARTESIAN_PLOT.height}`}
      role="group"
      data-chart-kind="line"
      aria-labelledby={`${ids.title} ${ids.description}`}
      aria-describedby={`${ids.details} ${ids.tooltip}`}
      onKeyDown={interaction.onKeyDown}
      onBlur={interaction.onBlur}
      data-reduced-motion={reduced}
    >
      <title id={ids.title}>{title}</title>
      <desc id={ids.description}>{description}. {summary}</desc>
      <defs>
        <linearGradient id={`${ids.title}-area`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--admin-accent,#d2aa67)" stopOpacity="0.32" />
          <stop offset="1" stopColor="var(--admin-accent,#d2aa67)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g key={animationKey} data-chart-animation-key={animationKey}>
        {points.length ? <path data-chart-area data-chart-animated="area" className={styles.area} d={buildAreaPath(points, plotBottom)} fill={`url(#${ids.title}-area)`} /> : null}
        {linePath ? <path data-chart-animated="line" className={styles.line} d={linePath} pathLength="1" /> : null}
      </g>
      <line
        data-chart-crosshair
        data-visible={activePoint !== null}
        className={styles.crosshair}
        x1={activePoint?.x ?? CARTESIAN_PLOT.left}
        x2={activePoint?.x ?? CARTESIAN_PLOT.left}
        y1={CARTESIAN_PLOT.top}
        y2={plotBottom}
      />
      {points.map((point, index) => <g
        key={`${data[index].label}:${index}`}
        className={styles.mark}
        data-chart-point
        data-active={activeIndex === index}
        data-muted={activeIndex !== null && activeIndex !== index}
        style={{ "--chart-index": index } as React.CSSProperties}
        tabIndex={activeIndex === index || (activeIndex === null && index === 0) ? 0 : -1}
        aria-label={`${data[index].label}, ${text(data[index].value)}`}
        aria-describedby={ids.tooltip}
        onFocus={() => interaction.send({ type: "focus", index })}
        onPointerEnter={() => interaction.send({ type: "hover", index })}
        onPointerLeave={() => interaction.send({ type: "leave" })}
        onClick={() => interaction.send({ type: "activate", index })}
      >
        <circle className={styles.pointHit} cx={point.x} cy={point.y} r="20" />
        <circle className={styles.pointVisual} cx={point.x} cy={point.y} r="4.5" />
      </g>)}
    </svg>}
    tooltip={(ids) => <MetricTooltip
      id={ids.tooltip}
      visible={active !== null}
      label={active?.label ?? ""}
      value={active ? text(active.value) : undefined}
      x={activePoint ? activePoint.x / CARTESIAN_PLOT.width * 100 : 50}
      y={activePoint ? activePoint.y / CARTESIAN_PLOT.height * 100 : 50}
    />}
    footer={stable ? <span data-chart-stable>Activité stable sur cette période.</span> : undefined}
  />;
}
