import type { Locale } from "@/lib/i18n";

export type RestaurateurPreviewLocale = Locale;
export type RestaurateurPreviewPeriodId = "24h" | "7d" | "30d";
export type RestaurateurPreviewMetricId =
  | "menuOpens"
  | "dishOpens"
  | "searches"
  | "immersive";

export type LocalizedText = Record<RestaurateurPreviewLocale, string>;
export type MetricValues = Record<RestaurateurPreviewMetricId, number>;
export type MetricSeries = Record<RestaurateurPreviewMetricId, number[]>;

export type PreviewCategory = {
  id: string;
  label: LocalizedText;
};

export type PreviewDish = {
  id: string;
  categoryId: string;
  name: string;
  nameEn: string;
  priceCents: number;
  imageSrc: string;
  available: boolean;
};

export type PreviewCount = { count: number };
export type PreviewDishCount = PreviewCount & { dishId: string };
export type PreviewCategoryCount = PreviewCount & { categoryId: string };
export type PreviewSearchCount = PreviewCount & { term: LocalizedText };
export type PreviewServiceCount = PreviewCount & { id: string; label: LocalizedText };
export type PreviewHeatmapCell = PreviewCount & {
  weekday: number;
  hour: number;
};

export type RestaurateurPreviewPeriod = {
  id: RestaurateurPreviewPeriodId;
  metrics: MetricValues;
  previousMetrics: MetricValues;
  series: MetricSeries;
  previousSeries: MetricSeries;
  seriesLabels: LocalizedText[];
  topDishes: PreviewDishCount[];
  categoryBreakdown: PreviewCategoryCount[];
  searchBreakdown: PreviewSearchCount[];
  serviceBreakdown: PreviewServiceCount[];
  heatmap: PreviewHeatmapCell[];
};

export type RestaurateurPreviewFixture = {
  generatedAt: string;
  restaurant: {
    demo: true;
    name: LocalizedText;
  };
  categories: PreviewCategory[];
  dishes: PreviewDish[];
  periods: Record<RestaurateurPreviewPeriodId, RestaurateurPreviewPeriod>;
};

export type DerivedPreviewPeriod = {
  comparison: Record<RestaurateurPreviewMetricId, number>;
  summary: {
    totalInteractions: number;
    availableCount: number;
    availableRate: number;
    leadingDish: string;
    busiestService: string;
  };
  keyInsights: string[];
};
