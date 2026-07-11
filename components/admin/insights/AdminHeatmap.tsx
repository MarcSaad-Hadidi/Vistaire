import type { AdminPanelEvidence } from "@/lib/admin/analyticsPresentation";
import { InteractiveHeatmap } from "../charts/InteractiveHeatmap";
import { AdminEvidenceState } from "../system/AdminPrimitives";

type Cell = { weekdayUtc: number; hourUtc: number; count: number };
const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export function AdminHeatmap({ evidence }: { evidence: AdminPanelEvidence<Cell[]> }) {
  if (evidence.kind !== "supported") return <AdminEvidenceState kind={evidence.kind} reason={evidence.reason}/>;
  const lookup = new Map(evidence.data.map((cell) => [`${cell.weekdayUtc}:${cell.hourUtc}`, cell.count]));
  const hours = Array.from({ length: 16 }, (_, index) => index + 8);
  return <InteractiveHeatmap
    data={days.flatMap((_, row) => hours.map((hour, column) => ({ row, column, value: lookup.get(`${row}:${hour}`) ?? 0 })))}
    rowLabels={days}
    columnLabels={hours.map((hour) => `${String(hour).padStart(2, "0")} h`)}
    title="Moments d’activité"
    description="Activité exacte par jour et heure, du niveau faible au niveau fort"
    period="Période sélectionnée · UTC"
    unit="événements"
    summary="Les heures sont affichées en UTC car le fuseau du restaurant n’est pas configuré."
  />;
}
