"use client";

import { StudioLocaleProvider } from "@/components/admin/studio/studioLocale";
import { useMemo, useState } from "react";
import { AdminStudio, type StudioPage } from "@/components/admin/studio/AdminStudio";
import type { AdminDashboardRange } from "@/lib/admin/dashboardRange";
import { createPublicStudioDemo, PUBLIC_STUDIO_DEMO_RANGES } from "@/lib/restaurateurPreview/studioFixture";
import type { RestaurateurPreviewLocale, RestaurateurPreviewPeriodId } from "@/lib/restaurateurPreview/types";
import styles from "./VistaireRestaurateurDashboardPreview.module.css";

export function RestaurateurDashboardDemo({ initialPeriodId = "24h", locale, presentation = "preview" }: {
  initialPeriodId?: RestaurateurPreviewPeriodId;
  locale: RestaurateurPreviewLocale;
  presentation?: "preview" | "pilotage";
}) {
  const [page, setPage] = useState<StudioPage>("overview");
  const [range, setRange] = useState<AdminDashboardRange>(initialPeriodId === "24h" ? "today-utc" : initialPeriodId);
  const data = useMemo(() => createPublicStudioDemo(range, locale), [range, locale]);
  return (
    <div className={styles.studioDemo} data-public-studio-demo data-presentation={presentation}>
      <StudioLocaleProvider locale={locale}><AdminStudio data={data} range={range} page={page} canWrite={false} demo demoRanges={PUBLIC_STUDIO_DEMO_RANGES} onPageChange={setPage} onRangeChange={setRange} /></StudioLocaleProvider>
    </div>
  );
}

