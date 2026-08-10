"use client";

import { useState } from "react";
import { ComparisonLineChart } from "@/components/admin/charts/ComparisonLineChart";
import { InteractiveDonut } from "@/components/admin/charts/InteractiveDonut";
import { InteractiveHeatmap } from "@/components/admin/charts/InteractiveHeatmap";
import { InteractiveLineChart } from "@/components/admin/charts/InteractiveLineChart";
import { AdminPanel } from "@/components/admin/system/AdminPresentationPrimitives";
import type { RestaurateurPreviewCopy } from "@/lib/restaurateurPreview/copy";
import { deriveRestaurateurPreviewPeriod, rankRestaurateurPreviewDishes } from "@/lib/restaurateurPreview/insights";
import type { RestaurateurPreviewFixture, RestaurateurPreviewLocale, RestaurateurPreviewMetricId, RestaurateurPreviewPeriod } from "@/lib/restaurateurPreview/types";
import { RestaurateurPreviewKpis } from "./RestaurateurPreviewOverview";
import styles from "./VistaireRestaurateurDashboardPreview.module.css";

const chartMetricIds: RestaurateurPreviewMetricId[] = ["menuOpens", "dishOpens", "searches"];
const allMetricIds: RestaurateurPreviewMetricId[] = ["menuOpens", "dishOpens", "searches", "immersive"];
const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];

export function RestaurateurPreviewInsights({
  availableCount,
  copy,
  fixture,
  locale,
  period
}: {
  availableCount: number;
  copy: RestaurateurPreviewCopy;
  fixture: RestaurateurPreviewFixture;
  locale: RestaurateurPreviewLocale;
  period: RestaurateurPreviewPeriod;
}) {
  const [activeMetric, setActiveMetric] = useState<RestaurateurPreviewMetricId>("menuOpens");
  const numberLocale = locale === "fr" ? "fr-CA" : "en-CA";
  const number = new Intl.NumberFormat(numberLocale);
  const derived = deriveRestaurateurPreviewPeriod(period, fixture, locale, availableCount);
  const frameCopy = {
    unitLabel: copy.unitLabel,
    exactValuesLabel: copy.exactValuesLabel,
    markerLabel: copy.markerLabel,
    seriesLabel: copy.seriesLabel,
    valueLabel: copy.valueLabel
  };
  const donutCopy = {
    categoryDescription: copy.categoryDescription,
    segmentLabel: copy.categorySegment,
    segmentOfLabel: copy.segmentOf
  };
  const dishMap = new Map(fixture.dishes.map((dish) => [dish.id, dish]));
  const categoryMap = new Map(fixture.categories.map((category) => [category.id, category]));
  const heatRows = locale === "fr"
    ? ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const heatColumns = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")} h`);
  const heatLookup = new Map(period.heatmap.map((cell) => [`${cell.weekday}:${cell.hour}`, cell.count]));
  const heatData = heatRows.flatMap((_, row) => heatColumns.map((__, hour) => ({
    row,
    column: hour,
    value: heatLookup.get(`${weekdayOrder[row]}:${hour}`) ?? 0
  })));
  const currentTotalSeries = period.seriesLabels.map((_, index) =>
    allMetricIds.reduce((sum, id) => sum + period.series[id][index], 0)
  );
  const previousTotalSeries = period.seriesLabels.map((_, index) =>
    allMetricIds.reduce((sum, id) => sum + period.previousSeries[id][index], 0)
  );
  const previousTotal = allMetricIds.reduce((sum, id) => sum + period.previousMetrics[id], 0);
  const totalChange = ((derived.summary.totalInteractions - previousTotal) / Math.max(1, previousTotal)) * 100;
  const rankedDishes = rankRestaurateurPreviewDishes(period.topDishes);

  return (
    <>
      <RestaurateurPreviewKpis availableCount={availableCount} copy={copy} locale={locale} period={period} totalDishes={fixture.dishes.length} />
      <div className={styles.insightsPrimaryGrid}>
        <AdminPanel title={copy.activity}>
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
            numberLocale={numberLocale}
            period={copy.periods[period.id]}
            summary={`${number.format(period.metrics[activeMetric])} ${copy.metrics[activeMetric].toLowerCase()}`}
            title={copy.activityTitle}
            unit={copy.interactions}
          />
        </AdminPanel>
        <AdminPanel title={copy.comparison}>
          <ComparisonLineChart
            copy={{ unavailable: copy.unavailableComparison, incompatibleSeries: copy.incompatibleSeries, delta: copy.delta }}
            description={copy.comparisonDescription}
            frameCopy={frameCopy}
            numberLocale={numberLocale}
            period={copy.periods[period.id]}
            series={[
              { label: copy.currentPeriod, values: currentTotalSeries.map((value, index) => ({ label: period.seriesLabels[index][locale], value })) },
              { label: copy.previousPeriod, values: previousTotalSeries.map((value, index) => ({ label: period.seriesLabels[index][locale], value })) }
            ]}
            summary={`${totalChange >= 0 ? "+" : "−"}${Math.abs(Math.round(totalChange))} % ${copy.trendAgainst}`}
            title={copy.comparisonTitle}
            unit={copy.interactions}
          />
        </AdminPanel>
        <AdminPanel>
          <p className={styles.utcNote}>{copy.utcDisclosure}</p>
          <InteractiveHeatmap
            columnLabels={heatColumns}
            copy={{ scaleLabel: copy.heatScale, cellDescription: copy.heatDescription }}
            data={heatData}
            description={copy.heatmap}
            frameCopy={frameCopy}
            numberLocale={numberLocale}
            period={copy.periods[period.id]}
            rowLabels={heatRows}
            summary={`${number.format(derived.summary.totalInteractions)} ${copy.interactions}`}
            title={copy.heatmap}
            unit={copy.interactions}
          />
        </AdminPanel>
      </div>
      <div className={styles.insightsSecondaryGrid}>
        <AdminPanel title={copy.topDishes}>
          <ol className={styles.compactList}>
            {rankedDishes.slice(0, 5).map((item, index) => {
              const dish = dishMap.get(item.dishId)!;
              return <li key={item.dishId}><span>{index + 1}</span><strong>{locale === "fr" ? dish.name : dish.nameEn}</strong><b>{number.format(item.count)}</b></li>;
            })}
          </ol>
        </AdminPanel>
        <AdminPanel title={copy.topSearches}>
          <ol className={styles.compactList}>
            {period.searchBreakdown.map((item, index) => <li key={item.term.fr}><span>{index + 1}</span><strong>{item.term[locale]}</strong><b>{number.format(item.count)}</b></li>)}
          </ol>
        </AdminPanel>
        <AdminPanel>
          <InteractiveDonut
            copy={donutCopy}
            data={period.categoryBreakdown.map((item) => ({ label: categoryMap.get(item.categoryId)!.label[locale], value: item.count }))}
            description={copy.categoryActivity}
            frameCopy={frameCopy}
            numberLocale={numberLocale}
            period={copy.periods[period.id]}
            summary={copy.categoryActivity}
            title={copy.categoryActivity}
            unit={copy.views}
            variant="detailed"
          />
        </AdminPanel>
        <AdminPanel>
          <InteractiveDonut
            copy={donutCopy}
            data={period.serviceBreakdown.map((item) => ({ label: item.label[locale], value: item.count }))}
            description={copy.serviceTimes}
            frameCopy={frameCopy}
            numberLocale={numberLocale}
            period={copy.periods[period.id]}
            summary={copy.serviceTimes}
            title={copy.serviceTimes}
            unit={copy.interactions}
            variant="detailed"
          />
        </AdminPanel>
      </div>
      <div className={styles.insightsBottomGrid}>
        <AdminPanel title={copy.periodSummary}>
          <dl className={styles.summaryGrid}>
            <div><dt>{copy.metrics.menuOpens}</dt><dd>{number.format(period.metrics.menuOpens)}</dd></div>
            <div><dt>{copy.metrics.dishOpens}</dt><dd>{number.format(period.metrics.dishOpens)}</dd></div>
            <div><dt>{copy.metrics.searches}</dt><dd>{number.format(period.metrics.searches)}</dd></div>
            <div><dt>{copy.metrics.immersive}</dt><dd>{number.format(period.metrics.immersive)}</dd></div>
            <div><dt>{copy.metrics.available}</dt><dd>{availableCount} / {fixture.dishes.length}</dd></div>
            <div><dt>{copy.interactions}</dt><dd>{number.format(derived.summary.totalInteractions)}</dd></div>
          </dl>
        </AdminPanel>
        <AdminPanel title={copy.keyInsights}>
          <ul className={styles.insightList}>{derived.keyInsights.map((insight) => <li key={insight}>{insight}</li>)}</ul>
        </AdminPanel>
      </div>
    </>
  );
}
