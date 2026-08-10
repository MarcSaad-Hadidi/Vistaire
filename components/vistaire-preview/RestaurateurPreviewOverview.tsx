"use client";

import { useState } from "react";
import { InteractiveDonut } from "@/components/admin/charts/InteractiveDonut";
import { InteractiveLineChart } from "@/components/admin/charts/InteractiveLineChart";
import {
  AvailableDishIcon,
  DishViewsIcon,
  ImmersiveIcon,
  MenuOpenIcon,
  SearchIcon
} from "@/components/admin/system/AdminIcons";
import {
  AdminKpiCard,
  AdminPanel,
  AdminStatusBadge
} from "@/components/admin/system/AdminPresentationPrimitives";
import type { RestaurateurPreviewCopy } from "@/lib/restaurateurPreview/copy";
import { rankRestaurateurPreviewDishes } from "@/lib/restaurateurPreview/insights";
import type {
  RestaurateurPreviewFixture,
  RestaurateurPreviewLocale,
  RestaurateurPreviewMetricId,
  RestaurateurPreviewPeriod
} from "@/lib/restaurateurPreview/types";
import { PublicPreviewDishImage } from "./PublicPreviewDishImage";
import styles from "./VistaireRestaurateurDashboardPreview.module.css";

const metricIds: RestaurateurPreviewMetricId[] = ["menuOpens", "dishOpens", "searches", "immersive"];
const chartMetricIds: RestaurateurPreviewMetricId[] = ["menuOpens", "dishOpens", "searches"];

const icons = {
  menuOpens: <MenuOpenIcon />,
  dishOpens: <DishViewsIcon />,
  searches: <SearchIcon />,
  immersive: <ImmersiveIcon />
};

export function RestaurateurPreviewKpis({
  availableCount,
  copy,
  locale,
  period,
  totalDishes
}: {
  availableCount: number;
  copy: RestaurateurPreviewCopy;
  locale: RestaurateurPreviewLocale;
  period: RestaurateurPreviewPeriod;
  totalDishes: number;
}) {
  const number = new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA");
  return (
    <section aria-label={copy.insightsKpis} className={styles.kpiGrid}>
      {metricIds.map((id) => {
        const rate = ((period.metrics[id] - period.previousMetrics[id]) / Math.max(1, period.previousMetrics[id])) * 100;
        return (
          <AdminKpiCard
            data-demo-kpi={id === "menuOpens" ? "menu-opens" : id === "dishOpens" ? "dish-opens" : id}
            detail={`${rate >= 0 ? "↗" : "↘"} ${Math.abs(Math.round(rate))} % ${copy.trendAgainst}`}
            icon={icons[id]}
            key={id}
            label={copy.metrics[id]}
            value={number.format(period.metrics[id])}
          />
        );
      })}
      <AdminKpiCard
        data-demo-kpi="available"
        detail={`${Math.round((availableCount / totalDishes) * 100)} %`}
        icon={<AvailableDishIcon />}
        label={copy.metrics.available}
        value={`${availableCount} / ${totalDishes}`}
      />
    </section>
  );
}

export function RestaurateurPreviewOverview({
  availableById,
  copy,
  fixture,
  locale,
  period
}: {
  availableById: Record<string, boolean>;
  copy: RestaurateurPreviewCopy;
  fixture: RestaurateurPreviewFixture;
  locale: RestaurateurPreviewLocale;
  period: RestaurateurPreviewPeriod;
}) {
  const [activeMetric, setActiveMetric] = useState<RestaurateurPreviewMetricId>("menuOpens");
  const availableCount = Object.values(availableById).filter(Boolean).length;
  const number = new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA");
  const frameCopy = {
    unitLabel: copy.unitLabel,
    exactValuesLabel: copy.exactValuesLabel,
    markerLabel: copy.markerLabel,
    seriesLabel: copy.seriesLabel,
    valueLabel: copy.valueLabel
  };
  const dish = (id: string) => fixture.dishes.find((item) => item.id === id)!;
  const category = (id: string) => fixture.categories.find((item) => item.id === id)!;
  const top = rankRestaurateurPreviewDishes(period.topDishes).slice(0, 5);
  const maxTop = Math.max(...top.map(({ count }) => count), 1);

  return (
    <>
      <RestaurateurPreviewKpis availableCount={availableCount} copy={copy} locale={locale} period={period} totalDishes={fixture.dishes.length} />
      <div className={styles.overviewGrid}>
        <AdminPanel className={styles.activityPanel} title={copy.menuActivity}>
          <div aria-label={copy.metricShown} className={styles.metricSelector} role="group">
            {chartMetricIds.map((id) => (
              <button aria-pressed={activeMetric === id} key={id} onClick={() => setActiveMetric(id)} type="button">
                {copy.metrics[id]}
              </button>
            ))}
          </div>
          <InteractiveLineChart
            copy={{ stableActivity: copy.stableActivity }}
            data={period.series[activeMetric].map((value, index) => ({ label: period.seriesLabels[index][locale], value }))}
            description={copy.activityTitle}
            frameCopy={frameCopy}
            numberLocale={locale === "fr" ? "fr-CA" : "en-CA"}
            period={copy.periods[period.id]}
            summary={`${number.format(period.metrics[activeMetric])} ${copy.metrics[activeMetric].toLowerCase()}`}
            title={copy.metrics[activeMetric]}
            unit={copy.interactions}
            variant="detailed"
          />
        </AdminPanel>
        <AdminPanel className={styles.topPanel} title={copy.topDishes}>
          <ol className={styles.rankList}>
            {top.map((item, index) => {
              const current = dish(item.dishId);
              const name = locale === "fr" ? current.name : current.nameEn;
              return (
                <li key={item.dishId}>
                  <span className={styles.rankNumber}>{index + 1}</span>
                  <PublicPreviewDishImage alt="" src={current.imageSrc} />
                  <span className={styles.rankDetail}>
                    <strong>{name}</strong>
                    <small>{number.format(item.count)} {copy.views}</small>
                    <i aria-hidden="true" style={{ "--bar-size": `${(item.count / maxTop) * 100}%` } as React.CSSProperties} />
                  </span>
                </li>
              );
            })}
          </ol>
        </AdminPanel>
        <AdminPanel className={styles.donutPanel} title={copy.serviceActivity}>
          <InteractiveDonut
            copy={{ categoryDescription: copy.categoryDescription, segmentLabel: copy.categorySegment, segmentOfLabel: copy.segmentOf }}
            data={period.serviceBreakdown.map((item) => ({ label: item.label[locale], value: item.count }))}
            description={copy.serviceActivity}
            frameCopy={frameCopy}
            numberLocale={locale === "fr" ? "fr-CA" : "en-CA"}
            period={copy.periods[period.id]}
            summary={copy.serviceActivity}
            title={copy.serviceActivity}
            unit={copy.interactions}
          />
        </AdminPanel>
        <AdminPanel className={styles.categoryPanel} title={copy.categoryActivity}>
          <ul className={styles.categoryBars}>
            {period.categoryBreakdown.map((item) => {
              const current = category(item.categoryId);
              const share = Math.round((item.count / period.metrics.dishOpens) * 100);
              return (
                <li aria-label={`${current.label[locale]} : ${number.format(item.count)} ${copy.views}, ${share} %`} key={item.categoryId}>
                  <span>{current.label[locale]}</span>
                  <small>{number.format(item.count)} {copy.views}</small>
                  <strong>{share} %</strong>
                  <i aria-hidden="true" style={{ "--bar-size": `${share}%` } as React.CSSProperties} />
                </li>
              );
            })}
          </ul>
        </AdminPanel>
        <AdminPanel className={styles.stripPanel} title={copy.availabilityActivity}>
          <div className={styles.availabilityStrip}>
            {fixture.dishes.slice(0, 5).map((item) => {
              const name = locale === "fr" ? item.name : item.nameEn;
              const isAvailable = availableById[item.id];
              return (
                <article key={item.id}>
                  <PublicPreviewDishImage alt="" src={item.imageSrc} />
                  <span><strong>{name}</strong><AdminStatusBadge tone={isAvailable ? "available" : "unavailable"}>{isAvailable ? copy.available : copy.unavailable}</AdminStatusBadge></span>
                </article>
              );
            })}
          </div>
        </AdminPanel>
      </div>
    </>
  );
}
