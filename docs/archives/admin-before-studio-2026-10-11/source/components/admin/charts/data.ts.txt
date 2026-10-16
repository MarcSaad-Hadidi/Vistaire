import type { ChartDatum, ChartSeries } from "./types";

export function normalizeComparisonSeries(series: ChartSeries[]): { kind: "aligned"; series: ChartSeries[] } | { kind: "misaligned"; reason: string } {
  const labels = series[0]?.values.map(({ label }) => label) ?? [];
  const aligned = series.length >= 2 && series.every((item) => item.values.length === labels.length && item.values.every((value, index) => value.label === labels[index]));
  return aligned ? { kind: "aligned", series } : { kind: "misaligned", reason: "Les séries doivent partager exactement les mêmes repères, dans le même ordre." };
}

export function normalizeDonutData(data: ChartDatum[]) {
  return {
    included: data.filter(({ value }) => Number.isFinite(value) && value >= 0),
    excluded: data.filter(({ value }) => !Number.isFinite(value) || value < 0),
  };
}
