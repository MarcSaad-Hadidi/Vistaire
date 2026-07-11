import type { AdminPanelEvidence } from "@/lib/admin/analyticsPresentation";
import { AdminEvidenceState } from "../system/AdminPrimitives";
import styles from "./AdminInsights.module.css";

type Point = { day: string; count: number };
type Series = { current: Point[]; previous: Point[] };

function polyline(points: Point[], max: number) { return points.map((point, index) => `${points.length === 1 ? 50 : index / (points.length - 1) * 100},${92 - point.count / max * 76}`).join(" "); }

export function AdminComparisonChart({ evidence }: { evidence: AdminPanelEvidence<Series> }) {
  if (evidence.kind !== "supported") return <AdminEvidenceState kind={evidence.kind} reason={evidence.reason}/>;
  const max = Math.max(...evidence.data.current.map((point) => point.count), ...evidence.data.previous.map((point) => point.count), 1);
  return <div className={styles.comparisonChart}><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img"><title>Comparaison de l’activité</title><desc>Période courante en champagne et période précédente en gris.</desc><polyline className={styles.currentLine} points={polyline(evidence.data.current, max)}/><polyline className={styles.previousLine} points={polyline(evidence.data.previous, max)}/></svg><table className={styles.exactTable}><caption>Valeurs exactes comparées</caption><thead><tr><th>Période</th><th>Jour</th><th>Événements</th></tr></thead><tbody>{evidence.data.current.map((point) => <tr key={`current-${point.day}`}><td>Courante</td><th>{point.day}</th><td>{point.count}</td></tr>)}{evidence.data.previous.map((point) => <tr key={`previous-${point.day}`}><td>Précédente</td><th>{point.day}</th><td>{point.count}</td></tr>)}</tbody></table></div>;
}
