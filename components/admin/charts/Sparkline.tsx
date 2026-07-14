"use client";

import { useId, useState } from "react";
import { buildLineGeometry } from "./geometry";
import styles from "./Charts.module.css";

export function Sparkline({ values, label = "Tendance", interactive = false }: { values: number[]; label?: string; interactive?: boolean }) {
  const [active, setActive] = useState(false);
  const id = `sparkline-${useId()}`;
  const { points } = buildLineGeometry(values, { width: 120, height: 36, padding: 3 });
  const latest = values.at(-1);
  return <span className={styles.sparkline} data-interactive={interactive || undefined} onPointerEnter={() => interactive && setActive(true)} onPointerLeave={() => interactive && setActive(false)}>
    <svg viewBox="0 0 120 36" role="img" aria-label={label} aria-describedby={interactive ? id : undefined} tabIndex={interactive ? 0 : undefined} onFocus={() => interactive && setActive(true)} onBlur={() => interactive && setActive(false)}>
      <polyline data-chart-animated="sparkline" className={styles.sparklineLine} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" pathLength="1" points={points.map((point) => `${point.x},${point.y}`).join(" ")}/>
    </svg>
    {interactive ? <output id={id} className={styles.sparklineTooltip} role="tooltip" data-visible={active}>{label} · dernière valeur {latest ?? "non disponible"}</output> : null}
  </span>;
}
