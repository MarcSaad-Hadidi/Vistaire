import type { AdminPanelEvidence } from "@/lib/admin/analyticsPresentation";
import { AdminEvidenceState } from "../system/AdminPrimitives";
import styles from "./AdminOverview.module.css";

type Point = { day: string; count: number };

export function AdminActivityChart({ evidence }: { evidence: AdminPanelEvidence<Point[]> }) {
  if (evidence.kind !== "supported") return <AdminEvidenceState kind={evidence.kind} reason={evidence.reason} />;
  const points = evidence.data;
  const max = Math.max(...points.map((point) => point.count), 1);
  const coordinates = points.map((point, index) => ({ ...point, x: points.length === 1 ? 50 : (index / (points.length - 1)) * 100, y: 92 - (point.count / max) * 76 }));
  const line = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  return <div className={styles.chartWrap}><svg className={styles.activityChart} viewBox="0 0 100 100" preserveAspectRatio="none" role="img"><title>Activité du menu</title><desc>Nombre exact d’événements enregistrés par jour sur la période.</desc><defs><linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".24"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs><path d={`M ${coordinates[0]?.x ?? 0} 100 L ${line.replaceAll(" ", " L ")} L ${coordinates.at(-1)?.x ?? 100} 100 Z`} fill="url(#activity-fill)"/><polyline points={line} fill="none" vectorEffect="non-scaling-stroke"/>{coordinates.map((point) => <circle key={point.day} cx={point.x} cy={point.y} r="1.15" />)}</svg><table className={styles.srTable}><caption>Valeurs exactes de l’activité</caption><thead><tr><th>Jour</th><th>Événements</th></tr></thead><tbody>{points.map((point) => <tr key={point.day}><th>{point.day}</th><td>{point.count}</td></tr>)}</tbody></table><div className={styles.axis} aria-hidden="true">{points.map((point) => <span key={point.day}>{new Intl.DateTimeFormat("fr-CA", { weekday: "short", timeZone: "UTC" }).format(new Date(`${point.day}T12:00:00Z`))}</span>)}</div></div>;
}
