"use client";

import type { PdfComparePreviewData } from "@/lib/pdfComparePreviewData";
import { ComparisonPreviewMenu } from "./ComparisonPreviewMenu";

export function SaugeNoireComparisonPreview({
  preview
}: {
  preview: PdfComparePreviewData;
}) {
  return <ComparisonPreviewMenu preview={preview} theme="sauge-noire" />;
}
