export type PlotSize = { width: number; height: number; padding?: number };

export function buildLineGeometry(values: number[], size: PlotSize) {
  const padding = size.padding ?? 0;
  const usableWidth = Math.max(0, size.width - padding * 2);
  const usableHeight = Math.max(0, size.height - padding * 2);
  const finite = values.map((value) => Number.isFinite(value) ? value : 0);
  const min = Math.min(...finite, 0);
  const max = Math.max(...finite, 0);
  const flat = finite.length > 0 && finite.every((value) => value === finite[0]);
  const range = max - min || 1;
  return {
    min, max,
    points: finite.map((value, index) => ({
      x: padding + (finite.length < 2 ? usableWidth / 2 : index * usableWidth / (finite.length - 1)),
      y: flat ? padding + usableHeight / 2 : padding + (max - value) / range * usableHeight,
    })),
  };
}

export function buildBandGeometry(values: number[], options: PlotSize & { gap?: number }) {
  const padding = options.padding ?? 0;
  const usableWidth = Math.max(0, options.width - padding * 2);
  const usableHeight = Math.max(0, options.height - padding * 2);
  const gap = Math.min(Math.max(0, options.gap ?? 4), values.length ? usableWidth / values.length / 2 : 0);
  const width = values.length ? Math.max(0, (usableWidth - gap * (values.length - 1)) / values.length) : 0;
  const max = Math.max(0, ...values.filter(Number.isFinite));
  return values.map((raw, index) => {
    const value = Math.max(0, Number.isFinite(raw) ? raw : 0);
    const height = max ? value / max * usableHeight : 0;
    return { x: padding + index * (width + gap), y: padding + usableHeight - height, width, height };
  });
}

export function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}

export function buildDonutSegments(values: number[], outerRadius: number, innerRadius: number) {
  const positive = values.map((value, index) => ({ value, index })).filter(({ value }) => Number.isFinite(value) && value > 0);
  const total = positive.reduce((sum, item) => sum + item.value, 0);
  let angle = -Math.PI / 2;
  return positive.map(({ value, index }) => {
    const startAngle = angle;
    const ratio = value / total;
    const endAngle = angle += ratio * Math.PI * 2;
    return { index, value, ratio, startAngle, endAngle, outerRadius, innerRadius };
  });
}

export function donutPath(segment: ReturnType<typeof buildDonutSegments>[number], cx: number, cy: number) {
  const { startAngle, endAngle, outerRadius, innerRadius } = segment;
  const end = endAngle - startAngle >= Math.PI * 2 ? endAngle - 1e-6 : endAngle;
  const large = end - startAngle > Math.PI ? 1 : 0;
  const a = polarPoint(cx, cy, outerRadius, startAngle), b = polarPoint(cx, cy, outerRadius, end);
  const c = polarPoint(cx, cy, innerRadius, end), d = polarPoint(cx, cy, innerRadius, startAngle);
  return `M ${a.x} ${a.y} A ${outerRadius} ${outerRadius} 0 ${large} 1 ${b.x} ${b.y} L ${c.x} ${c.y} A ${innerRadius} ${innerRadius} 0 ${large} 0 ${d.x} ${d.y} Z`;
}

export type HeatCellInput = { row: number; column: number; value: number };
export function buildHeatmapCells(input: HeatCellInput[], rows: number, columns: number) {
  const lookup = new Map(input.map((cell) => [`${cell.row}:${cell.column}`, Math.max(0, Number.isFinite(cell.value) ? cell.value : 0)]));
  const max = Math.max(0, ...lookup.values());
  return Array.from({ length: Math.max(0, rows * columns) }, (_, index) => {
    const row = Math.floor(index / columns), column = index % columns;
    const value = lookup.get(`${row}:${column}`) ?? 0;
    return { row, column, value, intensity: max ? value / max : 0 };
  });
}
