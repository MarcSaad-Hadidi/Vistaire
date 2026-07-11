import type { AdminPanelEvidence } from "@/lib/admin/analyticsPresentation";
import { AdminEvidenceState } from "../system/AdminPrimitives";
import styles from "./AdminOverview.module.css";

export function AdminTopDishes({ evidence, names }: { evidence: AdminPanelEvidence<{ slug: string; count: number }[]>; names: Map<string, string> }) {
  if (evidence.kind !== "supported") return <AdminEvidenceState kind={evidence.kind} reason={evidence.reason} />;
  const max = Math.max(...evidence.data.map((item) => item.count), 1);
  return <ol className={styles.ranking}>{evidence.data.slice(0, 4).map((item, index) => <li key={item.slug}><span className={styles.rank}>{index + 1}</span><div><strong>{names.get(item.slug) ?? item.slug}</strong><span>{item.count} consultation{item.count > 1 ? "s" : ""}</span><i style={{ "--value": `${(item.count / max) * 100}%` } as React.CSSProperties}/></div></li>)}</ol>;
}
