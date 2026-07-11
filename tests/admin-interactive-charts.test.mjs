import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildBandGeometry,
  buildDonutSegments,
  buildHeatmapCells,
  buildLineGeometry,
  chartId,
  formatChartDateUtc,
  interactionReducer,
  motionDuration,
} from "../components/admin/charts/index.ts";

test("line geometry keeps zero ranges finite and clamps points to the plot", () => {
  const flat = buildLineGeometry([4, 4, 4], { width: 300, height: 120, padding: 12 });
  assert.equal(flat.points.length, 3);
  assert.ok(flat.points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)));
  assert.deepEqual(flat.points.map(({ y }) => y), [60, 60, 60]);
  const varied = buildLineGeometry([-5, 20], { width: 100, height: 50, padding: 5 });
  assert.deepEqual(varied.points, [{ x: 5, y: 45 }, { x: 95, y: 5 }]);
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
  assert.doesNotMatch(source, /setInterval|requestAnimationFrame\([^)]*requestAnimationFrame/);
});

test("admin metric icons have distinct path signatures", async () => {
  const source = await readFile("components/admin/system/AdminIcons.tsx", "utf8");
  const paths = [...source.matchAll(/export function (\w+Icon)[\s\S]*?<IconFrame[\s\S]*?d="([^"]+)"[\s\S]*?<\/IconFrame>/g)];
  const metricNames = ["MenuOpenIcon", "DishViewsIcon", "SearchIcon", "ImmersiveIcon", "AvailableDishIcon", "EventIcon", "PeriodIcon"];
  const signatures = metricNames.map((name) => paths.find((match) => match[1] === name)?.[2]);
  assert.ok(signatures.every(Boolean));
  assert.equal(new Set(signatures).size, metricNames.length);
});
