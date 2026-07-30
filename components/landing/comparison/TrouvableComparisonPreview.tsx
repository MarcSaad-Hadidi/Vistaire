"use client";

import type { PdfComparePreviewData } from "@/lib/pdfComparePreviewData";
import { ComparisonPreviewMenu } from "./ComparisonPreviewMenu";

export function TrouvableComparisonPreview({
  preview
}: {
  preview: PdfComparePreviewData;
}) {
  return <ComparisonPreviewMenu preview={preview} theme="trouvable" />;
}
