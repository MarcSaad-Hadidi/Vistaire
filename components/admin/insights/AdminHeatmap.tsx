import type { AdminPanelEvidence } from "@/lib/admin/analyticsPresentation";
import { AdminEvidenceState } from "../system/AdminPrimitives";
import styles from "./AdminInsights.module.css";

type Cell = { weekdayUtc: number; hourUtc: number; count: number };
const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export function AdminHeatmap({ evidence }: { evidence: AdminPanelEvidence<Cell[]> }) {
  if (evidence.kind !== "supported") return <AdminEvidenceState kind={evidence.kind} reason={evidence.reason}/>;
  const lookup = new Map(evidence.data.map((cell) => [`${cell.weekdayUtc}:${cell.hourUtc}`, cell.count]));
  const max = Math.max(...evidence.data.map((cell) => cell.count), 1);
  const hours = Array.from({ length: 16 }, (_, index) => index + 8);
  return <div className={styles.heatmapWrap}><div className={styles.heatmap} aria-hidden="true">{hours.flatMap((hour) => days.map((_, weekday) => { const count = lookup.get(`${weekday}:${hour}`) ?? 0; return <i key={`${weekday}:${hour}`} style={{ "--heat": count / max } as React.CSSProperties}/>;}))}</div><table className={styles.exactTable}><caption>Activité exacte par heure et jour, en UTC</caption><thead><tr><th>Jour</th><th>Heure UTC</th><th>Événements</th></tr></thead><tbody>{evidence.data.map((cell) => <tr key={`${cell.weekdayUtc}:${cell.hourUtc}`}><th>{days[cell.weekdayUtc]}</th><td>{cell.hourUtc}:00</td><td>{cell.count}</td></tr>)}</tbody></table></div>;
}
