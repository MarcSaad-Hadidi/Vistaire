import type { AdminPanelEvidence } from "@/lib/admin/analyticsPresentation";
import { InteractiveLineChart } from "../charts/InteractiveLineChart";
import { AdminEvidenceState } from "../system/AdminPrimitives";

type Point = { day: string; count: number };

export function AdminActivityChart({ evidence }: { evidence: AdminPanelEvidence<Point[]> }) {
  if (evidence.kind !== "supported") return <AdminEvidenceState kind={evidence.kind} reason={evidence.reason} />;
  return <InteractiveLineChart
    data={evidence.data.map((point) => ({ label: point.day, value: point.count, series: "Période actuelle" }))}
    title="Activité du menu"
    description="Nombre exact d’événements enregistrés par jour"
    period="Période sélectionnée"
    unit="événements"
    summary="La série suit uniquement la période et le menu sélectionnés."
  />;
}
