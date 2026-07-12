import Link from "next/link";
import type { AdminPanelEvidence } from "@/lib/admin/analyticsPresentation";
import type { AdminMenuDish } from "@/lib/admin/menuReadiness";
import { InteractiveDonut } from "../charts/InteractiveDonut";
import { AdminEvidenceState } from "../system/AdminPrimitives";
import { InsightsDishRows, InsightsSearchRows } from "./InsightsRows";
import styles from "./AdminInsights.module.css";

type Ranked = { slug: string; count: number; label?: string };
type Search = { term: string; count: number; previousCount: number; changeRate: number | null; daily: number[] };
type Service = { timezone: "UTC"; windows: { id: string; label: string; count: number }[] };

function ExactTable({ rows, label }: { rows: { label: string; count: number }[]; label: string }) {
  return <table className={styles.exactTable}><caption>{label}</caption><thead><tr><th>Élément</th><th>Interactions</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.label}:${index}`}><th>{row.label}</th><td>{row.count}</td></tr>)}</tbody></table>;
}

export function AdminRankedBreakdown({ evidence, dishes = new Map() }: { evidence: AdminPanelEvidence<Ranked[]>; dishes?: Map<string, AdminMenuDish> }) {
  if (evidence.kind !== "supported") return <AdminEvidenceState kind={evidence.kind} reason={evidence.reason}/>;
  const rows = evidence.data.map((row) => { const dish = dishes.get(row.slug); return { id: row.slug, label: dish?.name ?? row.label ?? "Plat du menu", count: row.count, imageUrl: dish?.imageUrl, thumbnailUrl: dish?.thumbnailUrl }; });
  return <><InsightsDishRows rows={rows.slice(0, 5)}/><ExactTable rows={rows} label="Classement exact de tous les plats"/>{rows.length > 5 ? <Link className={styles.panelAction} href="/admin/availability">Voir tous les plats</Link> : null}</>;
}

export function AdminSearchBreakdown({ evidence }: { evidence: AdminPanelEvidence<Search[]> }) {
  if (evidence.kind !== "supported") return <AdminEvidenceState kind={evidence.kind} reason={evidence.reason}/>;
  return <>
    <InsightsSearchRows rows={evidence.data.slice(0, 5)}/>
    <ExactTable rows={evidence.data.map((row) => ({ label: row.term, count: row.count }))} label="Liste exacte de toutes les recherches"/>
    {evidence.data.length > 5 ? <details className={styles.searchExpansion}>
      <summary className={styles.panelAction}>Voir toutes les recherches</summary>
      <div data-insights-search-extra><InsightsSearchRows rows={evidence.data.slice(5)}/></div>
    </details> : null}
  </>;
}

export function AdminCategoryBreakdown({ evidence }: { evidence: AdminPanelEvidence<Ranked[]> }) {
  if (evidence.kind !== "supported") return <AdminEvidenceState kind={evidence.kind} reason={evidence.reason}/>;
  const sorted = evidence.data.map((row) => ({ label: row.label ?? "Catégorie du menu", value: row.count }));
  const visible = sorted.length <= 5 ? sorted : [...sorted.slice(0, 4), { label: "Autres", value: sorted.slice(4).reduce((sum, row) => sum + row.value, 0) }];
  return <><InteractiveDonut data={visible} title="Répartition par catégorie" description="Part exacte des consultations par catégorie" period="Période analysée" unit="consultations" summary="Les catégories moins fréquentes sont regroupées sous Autres." variant="detailed"/><ExactTable rows={sorted.map(({ label, value }) => ({ label, count: value }))} label="Répartition exacte de toutes les catégories"/></>;
}

export function AdminServiceBreakdown({ evidence }: { evidence: AdminPanelEvidence<Service> }) {
  if (evidence.kind !== "supported") return <AdminEvidenceState kind={evidence.kind} reason={evidence.reason}/>;
  const total = evidence.data.windows.reduce((sum, row) => sum + row.count, 0);
  return <><InteractiveDonut data={evidence.data.windows.map((row) => ({ label: row.label, value: row.count }))} title="Répartition par moment de service" description="Part exacte des interactions par moment de service" period="Période analysée" unit="interactions" summary="Nuit, Matin, Midi, Après-midi et Soirée couvrent les vingt-quatre heures." variant="detailed"/><ul className={styles.serviceExact} aria-label="Détail des moments de service">{evidence.data.windows.map((row) => <li key={row.id}>{row.label} · {Math.round(row.count / Math.max(1, total) * 100)} % · {row.count} interactions</li>)}</ul></>;
}
