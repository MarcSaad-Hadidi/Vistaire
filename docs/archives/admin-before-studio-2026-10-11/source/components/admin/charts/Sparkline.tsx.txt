"use client";

import { useId, useRef } from "react";
import { buildLineGeometry } from "./geometry";
import { useChartInteraction } from "./useChartInteraction";
import styles from "./Charts.module.css";

export type SparklineCopy = { latestValue: string; unavailable: string };
const DEFAULT_SPARKLINE_COPY: SparklineCopy = {
  latestValue: "dernière valeur",
  unavailable: "non disponible",
};

export function Sparkline({ values, label = "Tendance", interactive = false, copy = DEFAULT_SPARKLINE_COPY }: { values: number[]; label?: string; interactive?: boolean; copy?: SparklineCopy }) {
  const { active, pinned, rootRef, send, onKeyDown, onBlur } = useChartInteraction<HTMLSpanElement>(interactive ? 1 : 0);
  const suppressTouchClickUntil = useRef(0);
  const id = `sparkline-${useId()}`;
  const { points } = buildLineGeometry(values, { width: 120, height: 36, padding: 3 });
  const latest = values.at(-1);
  return <span ref={rootRef} className={styles.sparkline} data-interactive={interactive || undefined} onPointerEnter={(event) => interactive && event.pointerType !== "touch" && Date.now() > suppressTouchClickUntil.current && send({ type: "hover", index: 0 })} onPointerLeave={(event) => interactive && event.pointerType !== "touch" && Date.now() > suppressTouchClickUntil.current && send({ type: "leave" })}>
    <svg viewBox="0 0 120 36" role={interactive ? "button" : "img"} aria-label={label} aria-describedby={interactive ? id : undefined} aria-pressed={interactive ? pinned : undefined} tabIndex={interactive ? 0 : undefined} onFocus={() => interactive && Date.now() > suppressTouchClickUntil.current && send({ type: "focus", index: 0 })} onBlur={onBlur} onPointerDown={(event) => {
      if (!interactive || event.pointerType !== "touch") return;
      event.preventDefault();
      suppressTouchClickUntil.current = Date.now() + 500;
      send({ type: "activate", index: 0 });
    }} onClick={() => {
      if (!interactive || Date.now() <= suppressTouchClickUntil.current) return;
      send({ type: "activate", index: 0 });
    }} onKeyDown={onKeyDown}>
      <polyline data-chart-animated="sparkline" className={styles.sparklineLine} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" pathLength="1" points={points.map((point) => `${point.x},${point.y}`).join(" ")}/>
    </svg>
    {interactive ? <output id={id} className={styles.sparklineTooltip} role="tooltip" data-visible={active !== null}>{label} · {copy.latestValue} {latest ?? copy.unavailable}</output> : null}
  </span>;
}
