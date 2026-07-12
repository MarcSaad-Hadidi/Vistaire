"use client";

import { CartesianAxes, CARTESIAN_PLOT } from "./CartesianAxes";
import { ChartFrame, MetricTooltip } from "./ChartFrame";
import { normalizeComparisonSeries } from "./data";
import { buildLineDomain, buildLineGeometry, buildMidpointHitRegions } from "./geometry";
import { formatChartValue } from "./formatters";
import { useChartInteraction, useReducedMotion } from "./useChartInteraction";
import type { AccessibleChartProps, ChartSeries } from "./types";
import styles from "./Charts.module.css";

const plotWidth = CARTESIAN_PLOT.width - CARTESIAN_PLOT.left - CARTESIAN_PLOT.right;
const plotHeight = CARTESIAN_PLOT.height - CARTESIAN_PLOT.top - CARTESIAN_PLOT.bottom;
const plotBottom = CARTESIAN_PLOT.height - CARTESIAN_PLOT.bottom;

export function ComparisonLineChart(props: AccessibleChartProps & { series: ChartSeries[] }) {
  const normalized = normalizeComparisonSeries(props.series);
  if (normalized.kind === "misaligned") return <p role="alert">Comparaison indisponible. {normalized.reason}</p>;
  return <AlignedComparison {...props} series={normalized.series} />;
}

function AlignedComparison({
  series,
  title,
  subtitle,
  description,
  period,
  unit,
  summary,
  variant = "compact",
  valueFormatter,
}: AccessibleChartProps & { series: ChartSeries[] }) {
  const count = series[0].values.length;
  const interaction = useChartInteraction(count);
  const reduced = useReducedMotion();
  const allValues = series.flatMap((item) => item.values.map(({ value }) => value));
  const domain = buildLineDomain(allValues);
  const geometries = series.map((item) => {
    const geometry = buildLineGeometry(item.values.map(({ value }) => value), { width: plotWidth, height: plotHeight }, domain);
    return geometry.points.map((point) => ({ x: point.x + CARTESIAN_PLOT.left, y: point.y + CARTESIAN_PLOT.top }));
  });
  const text = (value: number) => valueFormatter?.(value) ?? formatChartValue(value, unit);
  const axisText = (value: number) => new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 1 }).format(value);
  const active = interaction.active;
  const activeX = active === null ? null : geometries[0][active]?.x ?? null;
  const currentValue = active === null ? null : series[0].values[active].value;
  const previousValue = active === null ? null : series[1].values[active].value;
  const difference = currentValue === null || previousValue === null ? null : currentValue - previousValue;
  const delta = difference === null ? undefined : `Écart ${difference > 0 ? "+" : difference < 0 ? "−" : ""}${text(Math.abs(difference))}`;
  const animationKey = `${title}:${period}:${series.map((item) => `${item.label}:${item.values.map(({ label, detail, value }) => `${label}:${detail ?? ""}:${value}`).join("|")}`).join("/")}`;
  const hitRegions = buildMidpointHitRegions(
    geometries[0].map(({ x }) => x),
    CARTESIAN_PLOT.left,
    CARTESIAN_PLOT.width - CARTESIAN_PLOT.right,
  );

  return <ChartFrame
    rootRef={interaction.rootRef}
    kind="comparison"
    className={styles.cartesianFrame}
    variant={variant}
    title={title}
    subtitle={subtitle}
    description={description}
    period={period}
    unit={unit}
    summary={summary}
    exactValues={series.flatMap((item) => item.values.map((value) => ({ label: value.detail ?? value.label, series: item.label, value: text(value.value) })))}
    chrome={variant === "detailed" ? <><span>{period}</span><span>{unit}</span></> : undefined}
    legend={<ul className={styles.legend} data-chart-legend>{series.map((item, index) => <li key={item.label}>
      <i className={index === 0 ? styles.legendCurrent : styles.legendPrevious} aria-hidden="true" />
      <span>{item.label}</span>
    </li>)}</ul>}
    axes={(ids) => <svg
      className={`${styles.svg} ${styles.cartesianSvg} ${styles.axesOverlay}`}
      viewBox={`0 0 ${CARTESIAN_PLOT.width} ${CARTESIAN_PLOT.height}`}
      aria-hidden="true"
      focusable="false"
      data-axis-owner={ids.title}
    >
      <CartesianAxes labels={series[0].values.map(({ label }) => label)} domain={domain} valueFormatter={axisText} maximumXLabels={5} />
    </svg>}
    plot={(ids) => <svg
      className={`${styles.svg} ${styles.cartesianSvg}`}
      viewBox={`0 0 ${CARTESIAN_PLOT.width} ${CARTESIAN_PLOT.height}`}
      role="group"
      data-chart-kind="comparison"
      aria-labelledby={`${ids.title} ${ids.description}`}
      aria-describedby={`${ids.details} ${ids.tooltip}`}
      onKeyDown={interaction.onKeyDown}
      onBlur={interaction.onBlur}
      data-reduced-motion={reduced}
    >
      <title id={ids.title}>{title}</title>
      <desc id={ids.description}>{description}. {summary}</desc>
      <g key={animationKey} data-chart-animation-key={animationKey}>
      {series.map((item, seriesIndex) => {
        const points = geometries[seriesIndex];
        const path = points.length ? `M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")}` : "";
        return <g key={item.label} data-chart-series={seriesIndex === 0 ? "current" : "previous"}>
          {path ? <path className={`${styles.line} ${seriesIndex === 0 ? styles.lineCurrent : styles.lineSecondary}`} d={path} pathLength="1" /> : null}
          {points.map((point, index) => <circle
            key={`${item.label}:${item.values[index].label}:${index}`}
            className={`${styles.seriesPoint} ${seriesIndex === 0 ? styles.seriesPointCurrent : styles.seriesPointPrevious}`}
            cx={point.x}
            cy={point.y}
            r="3.5"
            data-active={active === index}
            aria-hidden="true"
          />)}
        </g>;
      })}
      </g>
      <line
        data-chart-crosshair
        data-visible={activeX !== null}
        className={styles.crosshair}
        x1={activeX ?? CARTESIAN_PLOT.left}
        x2={activeX ?? CARTESIAN_PLOT.left}
        y1={CARTESIAN_PLOT.top}
        y2={plotBottom}
      />
      {series[0].values.map((datum, index) => {
        const region = hitRegions[index];
        const detail = datum.detail ?? datum.label;
        return <rect
          key={`${datum.label}:${index}`}
          className={`${styles.mark} ${styles.columnHit}`}
          x={region.x}
          y={CARTESIAN_PLOT.top}
          width={region.width}
          height={plotHeight}
          tabIndex={active === index || (active === null && index === 0) ? 0 : -1}
          aria-label={`${detail}, ${series.map((item) => `${item.label}: ${text(item.values[index].value)}`).join(", ")}`}
          aria-describedby={ids.tooltip}
          onFocus={() => interaction.send({ type: "focus", index })}
          onPointerEnter={() => interaction.send({ type: "hover", index })}
          onPointerLeave={() => interaction.send({ type: "leave" })}
          onClick={() => interaction.send({ type: "activate", index })}
        />;
      })}
    </svg>}
    tooltip={(ids) => <MetricTooltip
      id={ids.tooltip}
      visible={active !== null}
      label={active === null ? "" : series[0].values[active].detail ?? series[0].values[active].label}
      values={active === null ? undefined : series.map((item, index) => ({ label: item.label, value: text(item.values[active].value), tone: index === 0 ? "accent" : "muted" }))}
      delta={delta}
      x={activeX === null ? 50 : activeX / CARTESIAN_PLOT.width * 100}
      y={85}
    />}
  />;
}
