import type { AdminPanelEvidence } from "@/lib/admin/analyticsPresentation";
import { AdminEvidenceState } from "../system/AdminPrimitives";
import styles from "./AdminOverview.module.css";

export function AdminTopDishes({ evidence, dishes }: { evidence: AdminPanelEvidence<{ slug: string; count: number }[]>; dishes: Map<string, { name: string; image: string | null }> }) {
  if (evidence.kind !== "supported") return <AdminEvidenceState kind={evidence.kind} reason={evidence.reason} />;
  const max = Math.max(...evidence.data.map((item) => item.count), 1);
  return <ol className={styles.ranking}>{evidence.data.slice(0, 5).map((item, index) => { const dish=dishes.get(item.slug); return <li key={item.slug}><span className={styles.rank}>{index + 1}</span><span className={styles.rankPhoto}>{dish?.image?<Image alt="" src={dish.image} fill sizes="56px"/>:null}</span><div><strong>{dish?.name ?? item.slug}</strong><span>{item.count} consultation{item.count > 1 ? "s" : ""}</span><i style={{ "--value": `${(item.count / max) * 100}%` } as React.CSSProperties}/></div></li>})}</ol>;
}
import Image from "next/image";
