import type { AdminPanelEvidence } from "@/lib/admin/analyticsPresentation";
import { ComparisonLineChart } from "../charts/ComparisonLineChart";
import { AdminEvidenceState } from "../system/AdminPrimitives";

type Point = { day: string; count: number };
type Series = { current: Point[]; previous: Point[] };
const shortDay = (value: string) => new Intl.DateTimeFormat("fr-CA", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));

export function AdminComparisonChart({ evidence }: { evidence: AdminPanelEvidence<Series> }) {
  if (evidence.kind !== "supported") return <AdminEvidenceState kind={evidence.kind} reason={evidence.reason}/>;
  const alignedPoints = Array.from({ length: Math.max(evidence.data.current.length, evidence.data.previous.length) }, (_, index) => {
    const current = evidence.data.current[index];
    const previous = evidence.data.previous[index];
    return {
      label: `J${index + 1}`,
      detail: `Jour ${index + 1} · actuelle ${current ? shortDay(current.day) : "non disponible"} · précédente ${previous ? shortDay(previous.day) : "non disponible"}`,
    };
  });
  return <ComparisonLineChart
    series={[
      { label: "Période actuelle", values: evidence.data.current.map((point, index) => ({ label: alignedPoints[index].label, detail: alignedPoints[index].detail, value: point.count })) },
      { label: "Période précédente", values: evidence.data.previous.map((point, index) => ({ label: alignedPoints[index].label, detail: alignedPoints[index].detail, value: point.count })) },
    ]}
    title="Comparaison des périodes"
    description="Période actuelle en trait plein et période précédente en tirets"
    period="Périodes de même durée"
    unit="événements"
    summary="Les deux séries utilisent le même restaurant, le même menu et la même définition métrique."
  />;
}
