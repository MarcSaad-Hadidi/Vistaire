import { AdminPanel } from "@/components/admin/system/AdminPresentationPrimitives";
import type { AdminMoreQualityModel } from "@/lib/admin/more/contracts";
import { QualityStateRow } from "./QualityStateRow";

export function ExperienceEvidencePanel({ model }: { model: AdminMoreQualityModel }) {
  return (
    <AdminPanel title={model.copy.experienceTitle}>
      <QualityStateRow label={model.copy.labels.mobilePerformance} state={model.mobilePerformance} copy={model.copy} />
      <QualityStateRow label={model.copy.labels.immersiveSuccess} state={model.immersiveSuccess} copy={model.copy} />
      <QualityStateRow label={model.copy.labels.assetErrors} state={model.assetErrors} copy={model.copy} />
    </AdminPanel>
  );
}
