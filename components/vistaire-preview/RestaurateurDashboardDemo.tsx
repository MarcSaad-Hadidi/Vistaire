"use client";

import { StudioLocaleProvider } from "@/components/admin/studio/studioLocale";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { StudioPage } from "@/components/admin/studio/AdminStudio";
import type { AdminDashboardRange } from "@/lib/admin/dashboardRange";
import { createPublicStudioDemo, PUBLIC_STUDIO_DEMO_RANGES } from "@/lib/restaurateurPreview/studioFixture";
import type { RestaurateurPreviewLocale, RestaurateurPreviewPeriodId } from "@/lib/restaurateurPreview/types";
import styles from "./VistaireRestaurateurDashboardPreview.module.css";

const AdminStudio = lazy(() => import("@/components/admin/studio/AdminStudio").then(module => ({ default: module.AdminStudio })));

export function RestaurateurDashboardDemo({ initialPeriodId = "24h", locale, presentation = "preview" }: {
  initialPeriodId?: RestaurateurPreviewPeriodId;
  locale: RestaurateurPreviewLocale;
  presentation?: "preview" | "pilotage";
}) {
  const root = useRef<HTMLDivElement>(null);
  const [nearby, setNearby] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNearby(true);
        observer.disconnect();
      }
    }, { rootMargin: "600px" });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const [page, setPage] = useState<StudioPage>("overview");
  const [range, setRange] = useState<AdminDashboardRange>(initialPeriodId === "24h" ? "today-utc" : initialPeriodId);
  const data = useMemo(() => createPublicStudioDemo(range, locale), [range, locale]);
  return (
    <div ref={root} className={styles.studioDemo} data-public-studio-demo data-presentation={presentation}>
      <Suspense fallback={null}>
        {nearby && <StudioLocaleProvider locale={locale}><AdminStudio data={data} range={range} page={page} canWrite={false} demo demoRanges={PUBLIC_STUDIO_DEMO_RANGES} onPageChange={setPage} onRangeChange={setRange} /></StudioLocaleProvider>}
      </Suspense>
    </div>
  );
}
