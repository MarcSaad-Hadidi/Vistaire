export type ChartDatum = { label: string; value: number; detail?: string };
export type ChartSeries = { label: string; values: ChartDatum[]; tone?: "accent" | "muted" };
export type AccessibleChartProps = { title: string; description: string; period: string; unit: string; summary: string; valueFormatter?: (value: number) => string };
