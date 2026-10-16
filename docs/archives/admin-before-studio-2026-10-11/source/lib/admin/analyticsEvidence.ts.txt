export type AdminRawMetric = { id: string; value: number; baseline?: number | null };
export type AdminMetric = AdminRawMetric & { changeRate: number | null };

export function addComparisonEvidence(metric: AdminRawMetric): AdminMetric {
  const baseline = metric.baseline ?? null;
  return {
    ...metric,
    changeRate: baseline === null || baseline === 0 ? null : (metric.value - baseline) / baseline
  };
}
