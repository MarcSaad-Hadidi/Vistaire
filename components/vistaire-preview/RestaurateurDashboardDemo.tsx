"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { AdminToast } from "@/components/admin/system/AdminPresentationPrimitives";
import adminStyles from "@/components/admin/system/AdminSystem.module.css";
import { RESTAURATEUR_PREVIEW_COPY } from "@/lib/restaurateurPreview/copy";
import { RESTAURATEUR_PREVIEW_FIXTURE } from "@/lib/restaurateurPreview/fixture";
import type { RestaurateurPreviewLocale, RestaurateurPreviewPeriodId } from "@/lib/restaurateurPreview/types";
import { RestaurateurPreviewAvailability } from "./RestaurateurPreviewAvailability";
import { RestaurateurPreviewOverview } from "./RestaurateurPreviewOverview";
import styles from "./VistaireRestaurateurDashboardPreview.module.css";

type DemoTab = "overview" | "availability" | "insights";
const tabs: DemoTab[] = ["overview", "availability", "insights"];
const periods: RestaurateurPreviewPeriodId[] = ["24h", "7d", "30d"];
const FEEDBACK_VISIBLE_MS = 3_000;
const RestaurateurPreviewInsights = dynamic(
  () => import("./RestaurateurPreviewInsights").then((module) => module.RestaurateurPreviewInsights),
  { loading: () => <p role="status">…</p> }
);

export function RestaurateurDashboardDemo({
  initialPeriodId = "24h",
  locale,
  presentation = "preview"
}: {
  initialPeriodId?: RestaurateurPreviewPeriodId;
  locale: RestaurateurPreviewLocale;
  presentation?: "preview" | "pilotage";
}) {
  const fixture = RESTAURATEUR_PREVIEW_FIXTURE;
  const copy = RESTAURATEUR_PREVIEW_COPY[locale];
  const usesPilotageCopy = presentation === "pilotage";
  const dashboardEyebrow = usesPilotageCopy ? "Vistaire · Pilotage" : copy.dashboardEyebrow;
  const dashboardTabsLabel = usesPilotageCopy
    ? locale === "fr"
      ? "Vues du dashboard Vistaire Pilotage"
      : "Vistaire Pilotage dashboard views"
    : copy.tabsLabel;
  const restaurantName = usesPilotageCopy ? "Maison Élyse" : fixture.restaurant.name[locale];
  const [activeTab, setActiveTab] = useState<DemoTab>("overview");
  const [periodId, setPeriodId] = useState<RestaurateurPreviewPeriodId>(initialPeriodId);
  const [availableById, setAvailableById] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(fixture.dishes.map((dish) => [dish.id, dish.available]))
  );
  const [feedback, setFeedback] = useState<{ message: string; sequence: number } | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const feedbackSequence = useRef(0);
  const period = fixture.periods[periodId];
  const availableCount = useMemo(() => Object.values(availableById).filter(Boolean).length, [availableById]);

  useEffect(() => {
    if (!feedback) return;
    const sequence = feedback.sequence;
    const timeoutId = window.setTimeout(() => {
      setFeedback((current) => current?.sequence === sequence ? null : current);
    }, FEEDBACK_VISIBLE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    tabRefs.current[next]?.focus();
  };

  const toggleDish = (dishId: string) => {
    const nextAvailable = !availableById[dishId];
    const dish = fixture.dishes.find((item) => item.id === dishId);
    const dishName = dish ? locale === "fr" ? dish.name : dish.nameEn : dishId;
    setAvailableById((current) => ({ ...current, [dishId]: nextAvailable }));
    feedbackSequence.current += 1;
    setFeedback({
      message: `${copy.simulation} ${dishName} : ${nextAvailable ? copy.available : copy.unavailable}.`,
      sequence: feedbackSequence.current
    });
  };

  return (
    <section
      aria-label={dashboardTabsLabel}
      className={`${adminStyles.adminRoot} ${styles.dashboardDemo}`}
    >
      <header className={styles.demoHeader}>
        <div>
          <p>{dashboardEyebrow}</p>
          <h2>{restaurantName}</h2>
          <span>{copy.dashboardSubtitle}</span>
        </div>
        {activeTab !== "availability" ? <div aria-label={copy.periodsLabel} className={styles.periodSelector} role="group">
          {periods.map((id) => (
            <button
              aria-pressed={periodId === id}
              data-demo-period={id}
              key={id}
              onClick={() => setPeriodId(id)}
              type="button"
            >
              {copy.periods[id]}
            </button>
          ))}
        </div> : null}
      </header>
      <div aria-label={dashboardTabsLabel} className={styles.demoTabs} role="tablist">
        {tabs.map((id, index) => (
          <button
            aria-controls={`demo-panel-${id}`}
            aria-selected={activeTab === id}
            id={`demo-tab-${id}`}
            key={id}
            onClick={() => setActiveTab(id)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
            ref={(node) => { tabRefs.current[index] = node; }}
            role="tab"
            tabIndex={activeTab === id ? 0 : -1}
            type="button"
          >
            {copy.tabs[id]}
          </button>
        ))}
      </div>
      <div
        aria-labelledby={`demo-tab-${activeTab}`}
        className={styles.demoPanel}
        id={`demo-panel-${activeTab}`}
        role="tabpanel"
        tabIndex={0}
      >
        {activeTab === "overview" ? (
          <RestaurateurPreviewOverview availableById={availableById} copy={copy} fixture={fixture} locale={locale} period={period} />
        ) : activeTab === "availability" ? (
          <RestaurateurPreviewAvailability availableById={availableById} copy={copy} fixture={fixture} locale={locale} onToggle={toggleDish} />
        ) : (
          <RestaurateurPreviewInsights availableCount={availableCount} copy={copy} fixture={fixture} locale={locale} period={period} />
        )}
      </div>
      {feedback ? <AdminToast key={feedback.sequence}>{feedback.message}</AdminToast> : null}
    </section>
  );
}
