"use client";

import { useState } from "react";
import { AdminDishThumbnail } from "../AdminDishThumbnail";
import { Sparkline } from "../charts/Sparkline";
import styles from "./AdminInsights.module.css";

type DishRow = { id: string; label: string; count: number; imageUrl?: string | null; thumbnailUrl?: string | null };
type SearchRow = { term: string; count: number; previousCount: number; changeRate: number | null; daily: number[] };
const change = (rate: number | null) => rate === null ? "Nouvelle tendance" : `${rate >= 0 ? "+" : ""}${Math.round(rate * 100)} %`;

export function InsightsDishRows({ rows }: { rows: DishRow[] }) {
  const [active, setActive] = useState<string | null>(null);
  const maximum = Math.max(1, ...rows.map((row) => row.count));
  return <ol className={styles.dishRows}>{rows.map((row, index) => <li key={row.id} data-insights-dish-row>
    <button type="button" onClick={() => setActive(active === row.id ? null : row.id)} onBlur={() => setActive(null)} aria-describedby={`dish-tip-${row.id}`}>
      <span className={styles.rank}>{index + 1}</span><AdminDishThumbnail name={row.label} imageUrl={row.imageUrl} thumbnailUrl={row.thumbnailUrl} compact sizes="42px"/><span className={styles.rowMain}><strong>{row.label}</strong><i data-chart-animated="insights-rank-bar" style={{ "--value": `${row.count / maximum * 100}%` } as React.CSSProperties}/></span><b>{row.count}</b>
    </button>
    <output id={`dish-tip-${row.id}`} className={styles.rowTooltip} data-visible={active === row.id}>{row.label} · {row.count} consultations · rang {index + 1}</output>
  </li>)}</ol>;
}

export function InsightsSearchRows({ rows }: { rows: SearchRow[] }) {
  return <ol className={styles.searchRows}>{rows.map((row) => <li key={row.term} data-insights-search-row>
    <span className={styles.searchTerm}>{row.term}</span><Sparkline values={row.daily} label={`Tendance de ${row.term}`} interactive/><strong>{row.count}</strong><small className={styles.searchChange}>{change(row.changeRate)}</small>
  </li>)}</ol>;
}
