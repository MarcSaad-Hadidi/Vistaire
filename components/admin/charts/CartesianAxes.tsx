import { buildLinearTicks, selectAxisLabelIndexes, type LineDomain } from "./geometry";
import styles from "./Charts.module.css";

export const CARTESIAN_PLOT = {
  width: 640,
  height: 260,
  left: 52,
  right: 18,
  top: 16,
  bottom: 38,
} as const;

type CartesianAxesProps = {
  labels: string[];
  domain: LineDomain;
  valueFormatter: (value: number) => string;
  maximumXLabels?: number;
};

export function CartesianAxes({ labels, domain, valueFormatter, maximumXLabels = 7 }: CartesianAxesProps) {
  const plotWidth = CARTESIAN_PLOT.width - CARTESIAN_PLOT.left - CARTESIAN_PLOT.right;
  const plotHeight = CARTESIAN_PLOT.height - CARTESIAN_PLOT.top - CARTESIAN_PLOT.bottom;
  const ticks = buildLinearTicks(domain, 4);
  const labelIndexes = selectAxisLabelIndexes(labels.length, maximumXLabels);
  const x = (index: number) => CARTESIAN_PLOT.left + (labels.length < 2 ? plotWidth / 2 : index * plotWidth / (labels.length - 1));
  const y = (value: number) => CARTESIAN_PLOT.top + (domain.max - value) / (domain.max - domain.min) * plotHeight;

  return <g className={styles.cartesianAxes} aria-hidden="true">
    <g data-chart-axis="y">
      {ticks.map((tick) => <g key={tick}>
        <line data-chart-grid x1={CARTESIAN_PLOT.left} x2={CARTESIAN_PLOT.width - CARTESIAN_PLOT.right} y1={y(tick)} y2={y(tick)} />
        <text x={CARTESIAN_PLOT.left - 9} y={y(tick)} textAnchor="end" dominantBaseline="middle">{valueFormatter(tick)}</text>
      </g>)}
    </g>
    <g data-chart-axis="x">
      <line className={styles.axisLine} x1={CARTESIAN_PLOT.left} x2={CARTESIAN_PLOT.width - CARTESIAN_PLOT.right} y1={CARTESIAN_PLOT.height - CARTESIAN_PLOT.bottom} y2={CARTESIAN_PLOT.height - CARTESIAN_PLOT.bottom} />
      {labelIndexes.map((index) => <text key={`${labels[index]}:${index}`} x={x(index)} y={CARTESIAN_PLOT.height - 13} textAnchor={index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle"}>{labels[index]}</text>)}
    </g>
  </g>;
}
