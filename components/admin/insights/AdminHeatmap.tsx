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
  const matrix = days.flatMap((_, weekdayUtc) => hours.map((hourUtc) => ({ weekdayUtc, hourUtc, count: lookup.get(`${weekdayUtc}:${hourUtc}`) ?? 0 })));
  return <div className={styles.heatmapWrap}><div className={styles.hourLabels} aria-hidden="true">{hours.map((hour) => <span key={hour}>{hour % 2 === 0 ? hour : ""}</span>)}</div><div className={styles.dayLabels} aria-hidden="true">{days.map((day) => <span key={day}>{day}</span>)}</div><div className={styles.heatmap} aria-hidden="true">{matrix.map((cell) => <i key={`${cell.weekdayUtc}:${cell.hourUtc}`} style={{ "--heat": cell.count / max } as React.CSSProperties}/>)}</div><table className={styles.exactTable}><caption>Activité exacte par heure et jour, en UTC</caption><thead><tr><th>Jour</th><th>Heure UTC</th><th>Événements</th></tr></thead><tbody>{matrix.map((cell) => <tr key={`${cell.weekdayUtc}:${cell.hourUtc}`}><th>{days[cell.weekdayUtc]}</th><td>{cell.hourUtc}:00</td><td>{cell.count}</td></tr>)}</tbody></table></div>;
}
