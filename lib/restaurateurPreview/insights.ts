import type {
  DerivedPreviewPeriod,
  RestaurateurPreviewFixture,
  RestaurateurPreviewLocale,
  RestaurateurPreviewMetricId,
  RestaurateurPreviewPeriod
} from "./types";

const metricIds: RestaurateurPreviewMetricId[] = [
  "menuOpens",
  "dishOpens",
  "searches",
  "immersive"
];

const percentageChange = (current: number, previous: number) =>
  previous === 0 ? 0 : ((current - previous) / previous) * 100;

export function deriveRestaurateurPreviewPeriod(
  period: RestaurateurPreviewPeriod,
  fixture: RestaurateurPreviewFixture,
  locale: RestaurateurPreviewLocale,
  availableCount = fixture.dishes.filter((dish) => dish.available).length
): DerivedPreviewPeriod {
  const number = new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA");
  const comparison = Object.fromEntries(
    metricIds.map((id) => [id, percentageChange(period.metrics[id], period.previousMetrics[id])])
  ) as Record<RestaurateurPreviewMetricId, number>;
  const ranked = period.topDishes;
  const leadingDishEntry = fixture.dishes.find((dish) => dish.id === ranked[0]?.dishId);
  const leadingDish = leadingDishEntry
    ? locale === "fr" ? leadingDishEntry.name : leadingDishEntry.nameEn
    : "—";
  const busiestServiceEntry = [...period.serviceBreakdown].sort((a, b) => b.count - a.count)[0];
  const busiestService = busiestServiceEntry?.label[locale] ?? "—";
  const totalInteractions = metricIds.reduce((sum, id) => sum + period.metrics[id], 0);
  const availableRate = Math.round((availableCount / Math.max(1, fixture.dishes.length)) * 100);
  const menuChange = Math.round(Math.abs(comparison.menuOpens));
  const menuDirection = comparison.menuOpens >= 0;

  const keyInsights = locale === "fr"
    ? [
        `Les ouvertures du menu ont ${menuDirection ? "progressé" : "reculé"} de ${menuChange} % par rapport à la période précédente.`,
        `${leadingDish} est le plat le plus consulté avec ${number.format(ranked[0]?.count ?? 0)} consultations.`,
        `${busiestService} concentre le plus d’activité avec ${number.format(busiestServiceEntry?.count ?? 0)} interactions.`,
        `${availableCount} plats sur ${fixture.dishes.length} sont disponibles dans cette simulation.`
      ]
    : [
        `Menu opens ${menuDirection ? "increased" : "decreased"} by ${menuChange}% compared with the previous period.`,
        `${leadingDish} is the most viewed dish with ${number.format(ranked[0]?.count ?? 0)} views.`,
        `${busiestService} has the most activity with ${number.format(busiestServiceEntry?.count ?? 0)} interactions.`,
        `${availableCount} of ${fixture.dishes.length} dishes are available in this simulation.`
      ];

  return {
    comparison,
    summary: {
      totalInteractions,
      availableCount,
      availableRate,
      leadingDish,
      busiestService
    },
    keyInsights
  };
}
