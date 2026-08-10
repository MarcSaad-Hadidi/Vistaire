"use client";

import { ComparisonLineChart } from "@/components/admin/charts/ComparisonLineChart";
import { InteractiveDonut } from "@/components/admin/charts/InteractiveDonut";
import { InteractiveHeatmap } from "@/components/admin/charts/InteractiveHeatmap";
import { InteractiveLineChart } from "@/components/admin/charts/InteractiveLineChart";
import { AdminPanel } from "@/components/admin/system/AdminPresentationPrimitives";
import type { RestaurateurPreviewCopy } from "@/lib/restaurateurPreview/copy";
import { deriveRestaurateurPreviewPeriod } from "@/lib/restaurateurPreview/insights";
import type { RestaurateurPreviewFixture, RestaurateurPreviewLocale, RestaurateurPreviewPeriod } from "@/lib/restaurateurPreview/types";
import { RestaurateurPreviewKpis } from "./RestaurateurPreviewOverview";
import styles from "./VistaireRestaurateurDashboardPreview.module.css";

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
  const heatRows = locale === "fr" ? ["Midi", "Soirée"] : ["Lunch", "Evening"];
  const heatColumns = locale === "fr" ? ["Lun", "Mar", "Mer", "Jeu", "Ven"] : ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const heatData = heatRows.flatMap((_, row) => heatColumns.map((__, column) => ({
    row,
    column,
    value: period.heatmap[column * 2 + row]?.count ?? 0
  })));

  return (
    <>
      <RestaurateurPreviewKpis availableCount={availableCount} copy={copy} locale={locale} period={period} totalDishes={fixture.dishes.length} />
      <div className={styles.insightsPrimaryGrid}>
        <AdminPanel title={copy.activity}>
          <InteractiveLineChart
            copy={{ stableActivity: copy.stableActivity }}
            data={period.series.menuOpens.map((value, index) => ({ label: period.seriesLabels[index][locale], value }))}
            description={copy.activityTitle}
            frameCopy={frameCopy}
            numberLocale={numberLocale}
            period={copy.periods[period.id]}
            summary={`${number.format(period.metrics.menuOpens)} ${copy.metrics.menuOpens.toLowerCase()}`}
            title={copy.activityTitle}
            unit={copy.interactions}
          />
        </AdminPanel>
        <AdminPanel title={copy.comparison}>
          <ComparisonLineChart
            copy={{ unavailable: copy.unavailableComparison, incompatibleSeries: copy.incompatibleSeries, delta: copy.delta }}
            description={copy.comparisonTitle}
            frameCopy={frameCopy}
            numberLocale={numberLocale}
            period={copy.periods[period.id]}
            series={[
              { label: copy.currentPeriod, values: period.series.menuOpens.map((value, index) => ({ label: period.seriesLabels[index][locale], value })) },
              { label: copy.previousPeriod, values: period.previousSeries.menuOpens.map((value, index) => ({ label: period.seriesLabels[index][locale], value })) }
            ]}
            summary={`${Math.round(derived.comparison.menuOpens)} % ${copy.trendAgainst}`}
            title={copy.comparisonTitle}
            unit={copy.interactions}
          />
        </AdminPanel>
        <AdminPanel>
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
            {[...period.topDishes].sort((a, b) => b.count - a.count).slice(0, 5).map((item, index) => {
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
