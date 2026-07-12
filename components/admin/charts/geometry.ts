export type PlotSize = { width: number; height: number; padding?: number };

export type LineDomain = { min: number; max: number };

export function buildLineDomain(values: number[]): LineDomain {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return { min: 0, max: 1 };

  const first = finite[0];
  if (finite.every((value) => value === first)) {
    const padding = Math.max(1, Math.abs(first) * 0.15);
    return { min: first >= 0 ? Math.max(0, first - padding) : first - padding, max: first + padding };
  }

  return {
    min: Math.min(0, ...finite),
    max: Math.max(0, ...finite),
  };
}

export function buildMidpointHitRegions(points: number[], start: number, end: number) {
  return points.map((x, index) => {
    const regionStart = index === 0 ? start : (points[index - 1] + x) / 2;
    const regionEnd = index === points.length - 1 ? end : (x + points[index + 1]) / 2;
    return { x: regionStart, width: Math.max(0, regionEnd - regionStart) };
  });
}

export function buildLineGeometry(values: number[], size: PlotSize, requestedDomain?: LineDomain) {
  const padding = size.padding ?? 0;
  const usableWidth = Math.max(0, size.width - padding * 2);
  const usableHeight = Math.max(0, size.height - padding * 2);
  const fallbackDomain = buildLineDomain(values);
  const domain = requestedDomain && Number.isFinite(requestedDomain.min) && Number.isFinite(requestedDomain.max) && requestedDomain.max > requestedDomain.min
    ? requestedDomain
    : fallbackDomain;
  const min = domain.min;
  const max = domain.max;
  const range = max - min || 1;
  return {
    min, max,
    points: values.map((rawValue, index) => ({
      x: padding + (values.length < 2 ? usableWidth / 2 : index * usableWidth / (values.length - 1)),
      y: padding + (max - Math.min(max, Math.max(min, Number.isFinite(rawValue) ? rawValue : min))) / range * usableHeight,
    })),
  };
}

export function buildLinearTicks(domain: LineDomain, count = 4) {
  const safeCount = Math.max(2, Math.floor(count));
  const step = (domain.max - domain.min) / (safeCount - 1);
  return Array.from({ length: safeCount }, (_, index) => domain.min + step * index);
}

export function selectAxisLabelIndexes(count: number, maximum = 7) {
  if (count <= 0) return [];
  if (count <= maximum) return Array.from({ length: count }, (_, index) => index);
  const step = (count - 1) / Math.max(1, maximum - 1);
  return Array.from(new Set(Array.from({ length: maximum }, (_, index) => Math.round(index * step))));
}

export function buildAreaPath(points: Array<{ x: number; y: number }>, baseline: number) {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `M ${first.x} ${baseline} L ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${last.x} ${baseline} Z`;
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
