export type ChartDatum = { label: string; value: number; detail?: string };
export type ChartSeries = { label: string; values: ChartDatum[]; tone?: "accent" | "muted" };
export type ChartVariant = "compact" | "detailed";
export type AccessibleChartProps = {
  title: string;
  subtitle?: string;
  description: string;
  period: string;
  unit: string;
  summary: string;
  variant?: ChartVariant;
  valueFormatter?: (value: number) => string;
};
