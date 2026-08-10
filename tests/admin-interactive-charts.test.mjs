import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildBandGeometry,
  buildDonutSegments,
  donutPath,
  buildHeatmapCells,
  buildLineDomain,
  buildLineGeometry,
  buildMidpointHitRegions,
  buildNiceLineDomain,
  isStableSeries,
  chartId,
  formatChartDateUtc,
  interactionReducer,
  motionDuration,
  normalizeComparisonSeries,
  normalizeDonutData,
} from "../components/admin/charts/index.ts";

test("donut paths use hydration-stable bounded coordinates", () => {
  const segments = buildDonutSegments([1932, 1292, 333, 185], 88, 54);
  for (const segment of segments) {
    const path = donutPath(segment, 110, 110);
    assert.doesNotMatch(path, /\.\d{7,}/, "SVG coordinates should be normalized before server rendering");
  }
});

test("line geometry pads flat domains and clamps points to the plot", () => {
  const flat = buildLineGeometry([4, 4, 4], { width: 300, height: 120, padding: 12 });
  assert.equal(flat.points.length, 3);
  assert.ok(flat.points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)));
  assert.deepEqual(flat.points.map(({ y }) => y), [60, 60, 60]);
  assert.ok(flat.min < 4, "flat domains need breathing room below the value");
  assert.ok(flat.max > 4, "flat domains need breathing room above the value");
  const varied = buildLineGeometry([-5, 20], { width: 100, height: 50, padding: 5 });
  assert.deepEqual(varied.points, [{ x: 5, y: 45 }, { x: 95, y: 5 }]);
});

test("flat nonnegative line domains never pad below zero", () => {
  assert.deepEqual(buildLineDomain([0, 0]), { min: 0, max: 1 });
  assert.deepEqual(buildLineDomain([0.25, 0.25]), { min: 0, max: 1.25 });
});

test("stable activity is identified without inventing variation", () => {
  assert.equal(isStableSeries([4, 4, 4]), true);
  assert.equal(isStableSeries([0, 0]), true);
  assert.equal(isStableSeries([4]), false, "one observation is not a stable trend");
  assert.equal(isStableSeries([4, 5, 4]), false);
  assert.equal(isStableSeries([4, Number.NaN, 4]), false);
});

test("varied chart domains use round readable grid ticks", () => {
  assert.deepEqual(buildNiceLineDomain([0, 272]), { min: 0, max: 300 });
  assert.deepEqual(buildNiceLineDomain([90, 1256]), { min: 0, max: 1500 });
});

test("comparison midpoint hit regions meet without overlapping", () => {
  const regions = buildMidpointHitRegions([52, 194.5, 337, 479.5, 622], 52, 622);
  assert.equal(regions[0].x, 52);
  assert.equal(regions.at(-1).x + regions.at(-1).width, 622);
  for (let index = 1; index < regions.length; index += 1) {
    const previousEnd = regions[index - 1].x + regions[index - 1].width;
    assert.equal(previousEnd, regions[index].x);
  }
});

test("band geometry uses a bounded gap and non-negative bars", () => {
  const bands = buildBandGeometry([0, 10, 5], { width: 120, height: 60, padding: 6, gap: 4 });
  assert.equal(bands.length, 3);
  assert.equal(bands[0].height, 0);
  assert.equal(bands[1].y, 6);
  assert.ok(bands.every((band) => band.width > 0 && band.x >= 6 && band.x + band.width <= 114));
});

test("donut segments normalize positive values and cover one turn", () => {
  const segments = buildDonutSegments([2, -1, 3], 50, 20);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].ratio, 0.4);
  assert.equal(segments[1].ratio, 0.6);
  assert.ok(Math.abs(segments.at(-1).endAngle - Math.PI * 1.5) < 1e-9);
  assert.deepEqual(buildDonutSegments([0, -2], 50, 20), []);
});

test("heatmap fills a stable row-major matrix without mutating UTC coordinates", () => {
  const cells = buildHeatmapCells([{ row: 1, column: 2, value: 5 }], 3, 4);
  assert.equal(cells.length, 12);
  assert.deepEqual(cells[6], { row: 1, column: 2, value: 5, intensity: 1 });
  assert.deepEqual(cells[0], { row: 0, column: 0, value: 0, intensity: 0 });
});

test("chart ids are deterministic, safe and instance-scoped", () => {
  assert.equal(chartId("Résumé service", "A:7"), "resume-service-a-7");
  assert.notEqual(chartId("Activité", "one"), chartId("Activité", "two"));
});

test("date formatter is explicitly UTC and stable across day boundaries", () => {
  assert.equal(formatChartDateUtc("2026-07-11T00:30:00+14:00", "fr-CA"), "10 juill");
});

test("interaction reducer supports roving keys, pinning, escape and outside dismissal", () => {
  let state = { active: null, pinned: false };
  state = interactionReducer(state, { type: "key", key: "ArrowRight", count: 4 });
  assert.deepEqual(state, { active: 0, pinned: false });
  state = interactionReducer(state, { type: "key", key: "End", count: 4 });
  assert.equal(state.active, 3);
  state = interactionReducer(state, { type: "activate", index: 3 });
  assert.equal(state.pinned, true);
  state = interactionReducer(state, { type: "activate", index: 3 });
  assert.deepEqual(state, { active: null, pinned: false });
  state = interactionReducer({ active: 2, pinned: true }, { type: "outside" });
  assert.deepEqual(state, { active: null, pinned: false });
  state = interactionReducer({ active: 1, pinned: true }, { type: "key", key: "Escape", count: 4 });
  assert.deepEqual(state, { active: null, pinned: false });
});

test("heatmap keyboard navigation moves by columns and closes on blur or Tab", () => {
  const grid = { active: 33, pinned: false };
  assert.deepEqual(interactionReducer(grid, { type: "key", key: "ArrowUp", count: 112, columns: 16 }), { active: 17, pinned: false });
  assert.deepEqual(interactionReducer(grid, { type: "key", key: "ArrowDown", count: 112, columns: 16 }), { active: 49, pinned: false });
  assert.deepEqual(interactionReducer({ active: 5, pinned: true }, { type: "blur" }), { active: null, pinned: false });
  assert.deepEqual(interactionReducer({ active: 5, pinned: true }, { type: "key", key: "Tab", count: 112 }), { active: null, pinned: false });
});

test("comparison rejects label mismatch instead of inventing or hiding values", () => {
  const aligned = normalizeComparisonSeries([
    { label: "Actuelle", values: [{ label: "Lun", value: 3 }, { label: "Mar", value: 4 }] },
    { label: "Précédente", values: [{ label: "Lun", value: 2 }, { label: "Mar", value: 5 }] },
  ]);
  assert.equal(aligned.kind, "aligned");
  const mismatch = normalizeComparisonSeries([
    { label: "Actuelle", values: [{ label: "Lun", value: 3 }] },
    { label: "Précédente", values: [{ label: "Lun", value: 2 }, { label: "Mar", value: 5 }] },
  ]);
  assert.deepEqual(mismatch, { kind: "misaligned", reason: "Les séries doivent partager exactement les mêmes repères, dans le même ordre." });
});

test("donut normalization retains finite zero values for exact data without drawing an arc", () => {
  assert.deepEqual(normalizeDonutData([{ label: "Midi", value: 4 }, { label: "Soir", value: 0 }, { label: "Invalide", value: -2 }]), {
    included: [{ label: "Midi", value: 4 }, { label: "Soir", value: 0 }], excluded: [{ label: "Invalide", value: -2 }],
  });
  assert.deepEqual(buildDonutSegments([4, 0], 50, 20).map(({ index }) => index), [0]);
});

test("reduced motion turns chart animation contracts instant", () => {
  assert.equal(motionDuration(true, 320), 0);
  assert.equal(motionDuration(false, 120), 180);
  assert.equal(motionDuration(false, 900), 420);
});

test("interactive islands expose complete semantics and bounded responsive SVG contracts", async () => {
  const files = await Promise.all([
    "ChartFrame.tsx", "InteractiveLineChart.tsx", "ComparisonLineChart.tsx",
    "InteractiveBars.tsx", "InteractiveDonut.tsx", "InteractiveHeatmap.tsx", "useChartInteraction.ts", "Charts.module.css",
  ].map((name) => readFile(`components/admin/charts/${name}`, "utf8")));
  const source = files.join("\n");
  for (const token of ["aria-describedby", "<title", "<desc", "summary", "unit", "period", "exactTable"]) assert.match(source, new RegExp(token));
  assert.match(source, /viewBox=/);
  assert.doesNotMatch(source, /preserveAspectRatio=["']none/);
  assert.match(source, /Escape/);
  assert.match(source, /ArrowLeft|ArrowRight/);
  assert.match(source, /Home/);
  assert.match(source, /End/);
  assert.match(source, /Enter/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /aria-describedby=.*tooltip/);
  assert.match(source, /onBlur=/);
  assert.match(source, /role="row"/);
  assert.match(source, /aria-rowcount/);
  assert.match(source, /aria-colcount/);
  assert.match(source, /aria-rowindex/);
  assert.match(source, /aria-colindex/);
  assert.doesNotMatch(source, /setInterval|requestAnimationFrame\([^)]*requestAnimationFrame/);
});

test("interactive KPI sparklines reuse the complete chart interaction contract", async () => {
  const source = await readFile("components/admin/charts/Sparkline.tsx", "utf8");
  assert.match(source, /useChartInteraction<HTMLSpanElement>\(interactive \? 1 : 0\)/);
  assert.match(source, /onKeyDown=\{onKeyDown\}/);
  assert.match(source, /send\(\{ type: "activate", index: 0 \}\)/);
  assert.match(source, /active !== null/);
});

test("chart frame composes axes, plot and tooltip in one positioned plot stack", async () => {
  const source = await readFile("components/admin/charts/ChartFrame.tsx", "utf8");
  for (const token of [
    '"compact"', '"detailed"', "subtitle", "legend", "chrome", "plot", "axes", "tooltip", "footer",
    "exactTable", "summary",
  ]) assert.match(source, new RegExp(token));
  assert.match(source, /data-variant=/);
  assert.match(source, /styles\.frameTitle/);
  assert.match(source, /styles\.frameSubtitle/);
  assert.match(source, /styles\.plotStack/);
  assert.match(source, /data-chart-plot-stack/);
  assert.match(source, /renderSlot\(axes, ids\)[\s\S]*renderSlot\(plot, ids\)[\s\S]*renderSlot\(tooltip, ids\)/);
  assert.doesNotMatch(source, /styles\.axesSlot/);
});

test("chart tooltips switch edge alignment before their content can escape the plot", async () => {
  const frame = await readFile("components/admin/charts/ChartFrame.tsx", "utf8");
  assert.match(frame, /x < 34 \? "start" : x > 66 \? "end"/);
});

test("line and comparison charts share readable Cartesian axes and grid", async () => {
  const [line, comparison, axes, frame] = await Promise.all([
    readFile("components/admin/charts/InteractiveLineChart.tsx", "utf8"),
    readFile("components/admin/charts/ComparisonLineChart.tsx", "utf8"),
    readFile("components/admin/charts/CartesianAxes.tsx", "utf8").catch(() => ""),
    readFile("components/admin/charts/ChartFrame.tsx", "utf8"),
  ]);
  assert.match(line, /CartesianAxes/);
  assert.match(comparison, /CartesianAxes/);
  assert.match(line, /axes=\{\(ids\)/);
  assert.match(comparison, /axes=\{\(ids\)/);
  assert.match(axes, /data-chart-axis="x"/);
  assert.match(axes, /data-chart-axis="y"/);
  assert.match(axes, /data-chart-grid/);
  assert.match(axes, /<text/);
  assert.match(line, /data-chart-area/);
  assert.match(line, /data-chart-crosshair/);
  assert.match(line, /data-chart-point/);
  assert.match(comparison, /delta=\{delta\}/);
  assert.match(comparison, /value\.detail\s*\?\?\s*value\.label/);
  assert.match(comparison, /datum\.detail\s*\?\?\s*datum\.label/);
  assert.match(comparison, /series\[0\]\.values\[active\]\.detail\s*\?\?/);
  assert.match(comparison, /CartesianAxes labels=\{series\[0\]\.values\.map\(\(\{ label \}\) => label\)\}/);
  assert.match(frame, /data-chart-delta/);
});

test("heatmap exposes row and hour axes plus a visible low-to-high scale", async () => {
  const source = await readFile("components/admin/charts/InteractiveHeatmap.tsx", "utf8");
  assert.match(source, /data-chart-axis="hours"/);
  assert.match(source, /data-chart-axis="rows"/);
  assert.match(source, /data-chart-heat-legend/);
  assert.match(source, /scaleLabel: "Faible → Forte"/);
  assert.match(source, /<span>\{copy\.scaleLabel\}<\/span>/);
  assert.doesNotMatch(source, /Élevée/);
  assert.doesNotMatch(source, /UTC/);
});

test("donut density modes keep exact values without exposing implementation jargon", async () => {
  const source = await readFile("components/admin/charts/InteractiveDonut.tsx", "utf8");
  assert.match(source, /variant\s*=\s*"compact"/);
  assert.match(source, /variant === "detailed"/);
  assert.match(source, /data-chart-percentage/);
  assert.match(source, /styles\.donutCompact/);
  assert.match(source, /styles\.donutDetailed/);
  assert.match(source, /donutVisuals/);
  assert.match(source, /fill=\{donutVisuals\[item\.index % donutVisuals\.length\]\.color\}/);
  assert.doesNotMatch(source, /<pattern|repeating-linear-gradient|radial-gradient/);
  assert.match(source, /normalized\.included\.map/);
  assert.doesNotMatch(source, /plein|hachures|points|valeurs? exclues?|exclu du donut/i);
});

test("chart motion stays progressive, bounded and fully disabled when reduced", async () => {
  const [css, line, comparison, heatmap, donut] = await Promise.all([
    readFile("components/admin/charts/Charts.module.css", "utf8"),
    readFile("components/admin/charts/InteractiveLineChart.tsx", "utf8"),
    readFile("components/admin/charts/ComparisonLineChart.tsx", "utf8"),
    readFile("components/admin/charts/InteractiveHeatmap.tsx", "utf8"),
    readFile("components/admin/charts/InteractiveDonut.tsx", "utf8"),
  ]);
  assert.match(css, /animation-delay:calc\(var\(--chart-index/);
  assert.match(css, /180ms|220ms|280ms|320ms|360ms|420ms/);
  assert.doesNotMatch(css, /infinite/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)[\s\S]*animation:none!important[\s\S]*transition:none!important/);
  assert.match(css, /\.area\s*\{[^}]*opacity:\s*0\.9/s);
  for (const source of [line, comparison, heatmap, donut]) assert.match(source, /data-chart-animation-key/);
});

test("heatmap contract supports a semantic 24 by 7 grid with 168 cells", async () => {
  const source = await readFile("components/admin/charts/InteractiveHeatmap.tsx", "utf8");
  assert.equal(buildHeatmapCells([], 7, 24).length, 168);
  assert.match(source, /useChartInteraction\(cells\.length, columns\)/);
  assert.match(source, /rowLabels\.map/);
  assert.match(source, /role="row"/);
  assert.match(source, /role="gridcell"/);
});

test("admin metric icons have distinct path signatures", async () => {
  const source = await readFile("components/admin/system/AdminIcons.tsx", "utf8");
  const paths = [...source.matchAll(/export function (\w+Icon)[\s\S]*?<IconFrame[\s\S]*?d="([^"]+)"[\s\S]*?<\/IconFrame>/g)];
  const metricNames = ["MenuOpenIcon", "DishViewsIcon", "SearchIcon", "ImmersiveIcon", "AvailableDishIcon", "EventIcon", "PeriodIcon"];
  const signatures = metricNames.map((name) => paths.find((match) => match[1] === name)?.[2]);
  assert.ok(signatures.every(Boolean));
  assert.equal(new Set(signatures).size, metricNames.length);
});

test("admin KPI and chart frame expose optional localized copy with unchanged French defaults", async () => {
  const [primitives, frame] = await Promise.all([
    readFile("components/admin/system/AdminPrimitives.tsx", "utf8"),
    readFile("components/admin/charts/ChartFrame.tsx", "utf8"),
  ]);

  assert.match(primitives, /definitionAriaLabel\?: string/);
  assert.match(primitives, /definitionAriaLabel\s*\?\?\s*`Définition de \$\{label\}`/);

  for (const field of ["unitLabel", "exactValuesLabel", "markerLabel", "seriesLabel", "valueLabel"]) {
    assert.match(frame, new RegExp(`${field}: string`));
  }
  assert.match(frame, /copy\?: ChartFrameCopy/);
  assert.match(frame, /unitLabel: "Unité"/);
  assert.match(frame, /exactValuesLabel: "Valeurs exactes"/);
  assert.match(frame, /markerLabel: "Repère"/);
  assert.match(frame, /seriesLabel: "Série"/);
  assert.match(frame, /valueLabel: "Valeur"/);
  for (const field of ["unitLabel", "exactValuesLabel", "markerLabel", "seriesLabel", "valueLabel"]) {
    assert.match(frame, new RegExp(`copy\\.${field}`));
  }
});

test("line and donut charts accept localized copy and number locales while defaulting to French", async () => {
  const [line, donut] = await Promise.all([
    readFile("components/admin/charts/InteractiveLineChart.tsx", "utf8"),
    readFile("components/admin/charts/InteractiveDonut.tsx", "utf8"),
  ]);

  for (const source of [line, donut]) {
    assert.match(source, /numberLocale\?: string/);
    assert.match(source, /numberLocale = "fr-CA"/);
    assert.match(source, /frameCopy\?: ChartFrameCopy/);
  }
  assert.match(line, /stableActivity: string/);
  assert.match(line, /stableActivity: "Activité stable sur cette période\."/);
  assert.match(line, /copy\.stableActivity/);
  assert.match(line, /formatChartValue\(value, unit, numberLocale\)/);
  assert.match(line, /copy=\{frameCopy\}/);
  assert.match(donut, /categoryDescription: string/);
  assert.match(donut, /categoryDescription: "Chaque catégorie est identifiée par son libellé et sa valeur exacte\."/);
  assert.match(donut, /copy\.categoryDescription/);
  assert.match(donut, /Intl\.NumberFormat\(numberLocale/);
  assert.match(donut, /copy=\{frameCopy\}/);
});

test("heatmap and comparison charts localize their semantic copy without changing French defaults", async () => {
  const [heatmap, comparison] = await Promise.all([
    readFile("components/admin/charts/InteractiveHeatmap.tsx", "utf8"),
    readFile("components/admin/charts/ComparisonLineChart.tsx", "utf8"),
  ]);

  for (const source of [heatmap, comparison]) {
    assert.match(source, /numberLocale\?: string/);
    assert.match(source, /numberLocale = "fr-CA"/);
    assert.match(source, /frameCopy\?: ChartFrameCopy/);
  }
  assert.match(heatmap, /scaleLabel: string/);
  assert.match(heatmap, /cellDescription: string/);
  assert.match(heatmap, /scaleLabel: "Faible → Forte"/);
  assert.match(heatmap, /cellDescription: "Intensité de faible à élevée, avec une valeur exacte par cellule\."/);
  assert.match(heatmap, /copy\.scaleLabel/);
  assert.match(heatmap, /copy\.cellDescription/);
  assert.match(heatmap, /formatChartValue\(value, unit, numberLocale\)/);
  assert.match(comparison, /unavailable: string/);
  assert.match(comparison, /incompatibleSeries: string/);
  assert.match(comparison, /delta: string/);
  assert.match(comparison, /unavailable: "Comparaison indisponible\."/);
  assert.match(comparison, /incompatibleSeries: "Les séries doivent partager exactement les mêmes repères, dans le même ordre\."/);
  assert.match(comparison, /delta: "Écart"/);
  assert.match(comparison, /copy\.unavailable/);
  assert.match(comparison, /copy\.incompatibleSeries/);
  assert.match(comparison, /copy\.delta/);
  assert.match(comparison, /Intl\.NumberFormat\(numberLocale/);
});

test("interactive sparklines localize unavailable values and keep the French default", async () => {
  const source = await readFile("components/admin/charts/Sparkline.tsx", "utf8");
  assert.match(source, /copy\?: SparklineCopy/);
  assert.match(source, /latestValue: string/);
  assert.match(source, /unavailable: string/);
  assert.match(source, /latestValue: "dernière valeur"/);
  assert.match(source, /unavailable: "non disponible"/);
  assert.match(source, /copy\.latestValue/);
  assert.match(source, /copy\.unavailable/);
});
