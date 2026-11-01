import type { AdminPanelEvidence } from "@/lib/admin/analyticsPresentation";
import { InteractiveHeatmap } from "../charts/InteractiveHeatmap";
import { AdminEvidenceState } from "../system/AdminPrimitives";

type Cell = { weekdayUtc: number; hourUtc: number; count: number };
const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function AdminHeatmap({ evidence }: { evidence: AdminPanelEvidence<Cell[]> }) {
  if (evidence.kind !== "supported") return <AdminEvidenceState kind={evidence.kind} reason={evidence.reason}/>;
  const lookup = new Map(evidence.data.map((cell) => [`${cell.weekdayUtc}:${cell.hourUtc}`, cell.count]));
  const hours = Array.from({ length: 24 }, (_, index) => index);
  return <InteractiveHeatmap
    data={days.flatMap((_, row) => hours.map((hour, column) => ({ row, column, value: lookup.get(`${weekdayOrder[row]}:${hour}`) ?? 0 })))}
    rowLabels={days}
    columnLabels={hours.map((hour) => `${String(hour).padStart(2, "0")} h`)}
    title="Moments d’activité"
    description="Activité exacte par jour et heure, du niveau faible au niveau fort"
    period="Période sélectionnée"
    unit="événements"
    summary="Lecture chronologique du lundi au dimanche, heure par heure."
  />;
}
