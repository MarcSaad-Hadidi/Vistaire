import { AdminPanel } from "@/components/admin/system/AdminPresentationPrimitives";
import type { AdminMoreQualityModel } from "@/lib/admin/more/contracts";
import { QualityStateRow } from "./QualityStateRow";

export function ContentReadinessPanel({ model }: { model: AdminMoreQualityModel }) {
  return (
    <AdminPanel title={model.copy.contentTitle}>
      <QualityStateRow label={model.copy.labels.photos} state={model.photos} copy={model.copy} />
      <QualityStateRow label={model.copy.labels.descriptions} state={model.descriptions} copy={model.copy} />
      <QualityStateRow label={model.copy.labels.allergens} state={model.allergens} copy={model.copy} />
      <QualityStateRow label={model.copy.labels.translations} state={model.translations} copy={model.copy} />
      <QualityStateRow label={model.copy.labels.immersiveAssets} state={model.immersiveAssets} copy={model.copy} />
    </AdminPanel>
  );
}
