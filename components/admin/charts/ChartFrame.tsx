"use client";

import { useId, type ReactNode, type RefObject } from "react";
import styles from "./Charts.module.css";
import { chartId } from "./formatters";

export type ExactValue = { label: string; value: string; series?: string };
export type ChartFrameProps = {
  title: string; description: string; period: string; unit: string; summary: string;
  exactValues: ExactValue[]; children: (ids: { title: string; description: string; details: string; tooltip: string }) => ReactNode;
  rootRef?: RefObject<HTMLDivElement | null>; className?: string;
};

export function ChartFrame({ title, description, period, unit, summary, exactValues, children, rootRef, className }: ChartFrameProps) {
  const reactId = useId();
  const base = chartId(title, reactId);
  const ids = { title: `${base}-title`, description: `${base}-description`, details: `${base}-details`, tooltip: `${base}-tooltip` };
  return <div ref={rootRef} className={`${styles.frame} ${className ?? ""}`} aria-describedby={ids.details}>
    <p id={ids.details} className={styles.srOnly}>{description}. {period}. Unité: {unit}. {summary}</p>
    {children(ids)}
    <table className={`${styles.srOnly} ${styles.exactTable}`}><caption>Valeurs exactes — {title}</caption><thead><tr><th>Repère</th><th>Série</th><th>Valeur ({unit})</th></tr></thead><tbody>{exactValues.map((item, index) => <tr key={`${item.series}:${item.label}:${index}`}><th>{item.label}</th><td>{item.series ?? title}</td><td>{item.value}</td></tr>)}</tbody></table>
  </div>;
}

export function MetricTooltip({ id, label, value, x, y, visible }: { id: string; label: string; value: string; x: number; y: number; visible: boolean }) {
  return <output id={id} className={styles.tooltip} data-visible={visible} style={{ "--tooltip-x": `${Math.min(94, Math.max(6, x))}%`, "--tooltip-y": `${Math.min(88, Math.max(8, y))}%` } as React.CSSProperties}>{label}<strong>{value}</strong></output>;
}
