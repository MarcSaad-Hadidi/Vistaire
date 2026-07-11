import type { AdminPanelEvidence } from "@/lib/admin/analyticsPresentation";
import { AdminEvidenceState } from "../system/AdminPrimitives";
import styles from "./AdminInsights.module.css";

type Ranked = { slug: string; count: number };
type Search = { term: string; count: number };
type Service = { timezone: "UTC"; windows: { id: string; label: string; count: number }[] };

function Bars({ rows, label }: { rows: { id: string; label: string; count: number }[]; label: string }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  return <><ul className={styles.bars}>{rows.slice(0, 5).map((row) => <li key={row.id}><span>{row.label}</span><i style={{ "--value": `${row.count / max * 100}%` } as React.CSSProperties}/><strong>{row.count}</strong></li>)}</ul><table className={styles.exactTable}><caption>{label}</caption><thead><tr><th>Élément</th><th>Événements</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><th>{row.label}</th><td>{row.count}</td></tr>)}</tbody></table></>;
}

export function AdminRankedBreakdown({ evidence, names, label }: { evidence: AdminPanelEvidence<Ranked[]>; names?: Map<string,string>; label: string }) { if (evidence.kind !== "supported") return <AdminEvidenceState kind={evidence.kind} reason={evidence.reason}/>; return <Bars label={label} rows={evidence.data.map((row) => ({ id: row.slug, label: names?.get(row.slug) ?? row.slug, count: row.count }))}/>; }
export function AdminSearchBreakdown({ evidence }: { evidence: AdminPanelEvidence<Search[]> }) { if (evidence.kind !== "supported") return <AdminEvidenceState kind={evidence.kind} reason={evidence.reason}/>; return <Bars label="Recherches exactes" rows={evidence.data.map((row) => ({ id: row.term, label: row.term, count: row.count }))}/>; }
export function AdminServiceBreakdown({ evidence }: { evidence: AdminPanelEvidence<Service> }) { if (evidence.kind !== "supported") return <AdminEvidenceState kind={evidence.kind} reason={evidence.reason}/>; return <Bars label={`Répartition exacte des services · ${evidence.data.timezone}`} rows={evidence.data.windows.map((row) => ({ id: row.id, label: row.label, count: row.count }))}/>; }
