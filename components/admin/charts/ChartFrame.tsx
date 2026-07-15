"use client";

import { useId, type CSSProperties, type ReactNode, type RefObject } from "react";
import { chartId } from "./formatters";
import type { ChartVariant } from "./types";
import styles from "./Charts.module.css";

export type ExactValue = { label: string; value: string; series?: string };
export type ChartFrameIds = { title: string; description: string; details: string; tooltip: string };
export type ChartSlot = ReactNode | ((ids: ChartFrameIds) => ReactNode);

export type ChartFrameProps = {
  title: string;
  subtitle?: string;
  description: string;
  period: string;
  unit: string;
  summary: string;
  exactValues: ExactValue[];
  variant?: ChartVariant;
  kind?: string;
  legend?: ChartSlot;
  chrome?: ChartSlot;
  plot?: ChartSlot;
  axes?: ChartSlot;
  tooltip?: ChartSlot;
  footer?: ChartSlot;
  children?: (ids: ChartFrameIds) => ReactNode;
  rootRef?: RefObject<HTMLDivElement | null>;
  className?: string;
};

const renderSlot = (slot: ChartSlot | undefined, ids: ChartFrameIds) => typeof slot === "function" ? slot(ids) : slot;

export function ChartFrame({
  title,
  subtitle,
  description,
  period,
  unit,
  summary,
  exactValues,
  variant = "compact",
  kind,
  legend,
  chrome,
  plot,
  axes,
  tooltip,
  footer,
  children,
  rootRef,
  className,
}: ChartFrameProps) {
  const reactId = useId();
  const base = chartId(title, reactId);
  const ids = { title: `${base}-title`, description: `${base}-description`, details: `${base}-details`, tooltip: `${base}-tooltip` };

  return <div
    ref={rootRef}
    className={`${styles.frame} ${variant === "detailed" ? styles.frameDetailed : styles.frameCompact} ${className ?? ""}`}
    data-chart-frame
    data-chart-kind={kind}
    data-variant={variant}
    aria-describedby={ids.details}
  >
    <header className={styles.frameHeader}>
      <div className={styles.frameHeading}>
        <h3 className={styles.frameTitle}>{title}</h3>
        {subtitle ? <p className={styles.frameSubtitle}>{subtitle}</p> : null}
      </div>
      {chrome ? <div className={styles.chartChrome} data-chart-chrome>{renderSlot(chrome, ids)}</div> : null}
    </header>
    <p id={ids.details} className={styles.srOnly}>{description}. {period}. Unité: {unit}. {summary}</p>
    {legend ? <div className={styles.legendSlot}>{renderSlot(legend, ids)}</div> : null}
    <div className={styles.plotStack} data-chart-plot-stack>
      {renderSlot(axes, ids)}
      {renderSlot(plot, ids) ?? children?.(ids)}
      {renderSlot(tooltip, ids)}
    </div>
    {footer ? <footer className={styles.chartFooter}>{renderSlot(footer, ids)}</footer> : null}
    <div className={`${styles.srOnly} ${styles.exactTable}`}><table>
      <caption>Valeurs exactes — {title}</caption>
      <thead><tr><th>Repère</th><th>Série</th><th>Valeur ({unit})</th></tr></thead>
      <tbody>{exactValues.map((item, index) => <tr key={`${item.series}:${item.label}:${index}`}><th>{item.label}</th><td>{item.series ?? title}</td><td>{item.value}</td></tr>)}</tbody>
    </table></div>
  </div>;
}

export type MetricTooltipValue = { label?: string; value: string; tone?: "accent" | "muted" };

export function MetricTooltip({ id, label, value, values, delta, x, y, visible }: {
  id: string;
  label: string;
  value?: string;
  values?: MetricTooltipValue[];
  delta?: string;
  x: number;
  y: number;
  visible: boolean;
}) {
  return <output
    id={id}
    className={styles.tooltip}
    data-visible={visible}
    data-horizontal={x < 34 ? "start" : x > 66 ? "end" : "center"}
    data-vertical={y < 40 ? "below" : "above"}
    aria-hidden={!visible}
    aria-live="polite"
    style={{ "--tooltip-x": `${Math.min(94, Math.max(6, x))}%`, "--tooltip-y": `${Math.min(88, Math.max(8, y))}%` } as CSSProperties}
  >
    <span className={styles.tooltipLabel}>{label}</span>
    {value ? <strong>{value}</strong> : null}
    {values?.map((item, index) => <span className={styles.tooltipValue} data-tone={item.tone} key={`${item.label}:${index}`}>
      {item.label ? <small>{item.label}</small> : null}<strong>{item.value}</strong>
    </span>)}
    {delta ? <span className={styles.tooltipDelta} data-chart-delta>{delta}</span> : null}
  </output>;
}
