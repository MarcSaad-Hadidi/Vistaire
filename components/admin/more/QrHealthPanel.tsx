import { AdminPanel } from "@/components/admin/system/AdminPresentationPrimitives";
import type { AdminMoreQualityModel } from "@/lib/admin/more/contracts";
import { QualityStateRow } from "./QualityStateRow";

export function QrHealthPanel({ model }: { model: AdminMoreQualityModel }) {
  return (
    <AdminPanel title={model.copy.qrTitle}>
      <QualityStateRow label={model.copy.labels.qr} state={model.qr} copy={model.copy} />
      <QualityStateRow label={model.copy.labels.publication} state={model.publication} copy={model.copy} />
    </AdminPanel>
  );
}
