import type { AdminPanelEvidence } from "@/lib/admin/analyticsPresentation";
import { ComparisonLineChart } from "../charts/ComparisonLineChart";
import { AdminEvidenceState } from "../system/AdminPrimitives";

type Point = { day: string; count: number };
type Series = { current: Point[]; previous: Point[] };

export function AdminComparisonChart({ evidence }: { evidence: AdminPanelEvidence<Series> }) {
  if (evidence.kind !== "supported") return <AdminEvidenceState kind={evidence.kind} reason={evidence.reason}/>;
  const alignedLabels = evidence.data.current.map((point, index) => `${point.day} · réf. ${evidence.data.previous[index]?.day ?? "—"}`);
  return <ComparisonLineChart
    series={[
      { label: "Période actuelle", values: evidence.data.current.map((point, index) => ({ label: alignedLabels[index], value: point.count })) },
      { label: "Période précédente", values: evidence.data.previous.map((point, index) => ({ label: alignedLabels[index], value: point.count })) },
    ]}
    title="Comparaison de l’activité"
    description="Période actuelle en trait plein et période précédente en tirets"
    period="Périodes de même durée"
    unit="événements"
    summary="Les deux séries utilisent le même restaurant, le même menu et la même définition métrique."
  />;
}
