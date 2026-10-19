import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("KindUI 0.4 chart surfaces use its published tokens and selectors", async () => {
  const css = await readFile(
    "components/admin/studio/Studio.module.css",
    "utf8",
  );
  for (const token of [
    "--kind-ui-chart-popover:",
    "--kind-ui-chart-popover-foreground:",
    "--kind-ui-chart-border:",
  ])
    assert.ok(css.includes(token), token);
  assert.match(css, /data-kind-ui="chart"/);
  assert.doesNotMatch(css, /\.kind-root/);
});

test("approved trend keeps expansion, controlled legend and explicit date comparison", async () => {
  const source = await readFile(
    "components/admin/studio/StudioCharts.tsx",
    "utf8",
  );
  for (const contract of [
    "showModal()",
    "visibleSeries={visible}",
    "onVisibleSeriesChange={setVisible}",
    "previousDate",
    'type="range"',
  ])
    assert.ok(source.includes(contract), contract);
  assert.match(source, /aria-valuetext/);
  for (const hook of [
    'data-kind-ui="chart-tooltip"',
    "data-studio-tooltip-date={row.date}",
    'data-kind-ui="chart-tooltip-value"',
    'data-studio-tooltip-series="current"',
    'data-studio-tooltip-series="previous"',
  ])
    assert.ok(source.includes(hook), hook);
  assert.doesNotMatch(source, /Math\.random/);
});

test("analysis workspace preserves global time scope and restores supported visual hierarchy", async () => {
  const source = await readFile(
    "components/admin/studio/StudioAnalysisWorkspace.tsx",
    "utf8",
  );
  for (const contract of [
    "hourWeekday.kind",
    "ranking.kind",
    "globalScope",
    "onDishOpen",
    "StudioAnalysisCharts",
    "StudioTrend",
    "aria-pressed={view",
  ])
    assert.ok(source.includes(contract), contract);
  assert.ok(source.includes('hasRanking && view === "charts"'));
  assert.doesNotMatch(source, /role="tablist"/);
  assert.ok(source.includes("<StudioAnalysisTables"));
  assert.ok(source.includes("onExport={onExport}"));
  assert.doesNotMatch(source, /Math\.random|\.fill\(42\)|sessions.*\*\s*0\./);
});

test("category sectors carry palette colors and radar uses separated percentage scale", async () => {
  const source = await readFile(
    "components/admin/studio/StudioAnalysisCharts.tsx",
    "utf8",
  );
  assert.ok(source.includes("fill: color(name)"));
  assert.doesNotMatch(source, /markerSize/);
  assert.ok(source.includes("angle={30}"));
  assert.ok(source.includes("ticks={profileTicks}"));
  assert.ok(source.includes('outerRadius="82%"'));
  const workspace = await readFile(
    "components/admin/studio/StudioAnalysisWorkspace.tsx",
    "utf8",
  );
  assert.ok(workspace.includes("wrapChartLabel"));
  assert.doesNotMatch(workspace, /name\.slice\(0, 16\)/);
});

test("application-owned chart primitives have a direct pinned Recharts dependency", async () => {
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
  assert.equal(manifest.dependencies.recharts, "3.10.1");
  assert.equal(lock.packages[""].dependencies.recharts, "3.10.1");
  assert.equal(lock.packages["node_modules/recharts"].version, "3.10.1");
});

test("analysis temporal charts consume scoped evidence and configured timezone", async () => {
  const workspace = await readFile(
    "components/admin/studio/StudioAnalysisWorkspace.tsx",
    "utf8",
  );
  for (const contract of [
    "selectStudioTemporalMetrics",
    "dishIds:",
    "temporalPresent",
    "timezone={timezone}",
    "temporal.total !== null",
    "StudioNumber value={totals[key]}",
  ])
    assert.ok(workspace.includes(contract), contract);
  const charts = await readFile(
    "components/admin/studio/StudioAnalysisCharts.tsx",
    "utf8",
  );
  assert.ok(charts.includes('"previousThree"'));
  assert.ok(charts.includes('"previousAr"'));
  assert.doesNotMatch(charts, /const comparable = metric === "views"/);
});

test("scatter fixed geometry renders full-sized native symbols without inventing a Z metric", async () => {
  const ts = (await import("typescript")).default;
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const { renderToStaticMarkup } = require("react-dom/server");
  const { createElement } = require("react");
  const { Symbols } = require("recharts");
  const source = await readFile("components/admin/studio/StudioAnalysisCharts.tsx", "utf8");
  const ast = ts.createSourceFile("chart.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const shape = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "StudioScatterPoint");
  assert.ok(shape, "fixed geometry must be owned by the rendered shape");
  const compiled = ts.transpileModule(shape.getText(ast), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  new Function("exports", "require", "Symbols", compiled)(exports, require, Symbols);
  const html = renderToStaticMarkup(createElement(exports.StudioScatterPoint, {
    cx: 65, cy: 0, size: 64, fill: "#60a5fa", stroke: "#fff", strokeWidth: 2,
    payload: { members: [{ id: "a" }, { id: "b" }], views: 65, three: 0 },
  }));
  assert.match(html, /data-studio-scatter-point="true"/);
  assert.match(html, /data-studio-scatter-count="2"/);
  assert.match(html, /data-studio-scatter-views="65"/);
  assert.match(html, /data-studio-scatter-three="0"/);
  assert.match(html, /translate\(65, 0\)/, "real zero coordinate must remain unchanged");
  assert.match(html, /fill="#60a5fa"/);
  const radius = Number(html.match(/d="M([\d.]+),0A/)?.[1]);
  assert.ok(Math.abs(radius - Math.sqrt(450 / Math.PI)) < 0.01, html);
  assert.match(source, /shape=\{StudioScatterPoint\}/);
  assert.match(source, /activeShape=\{StudioScatterPoint\}/);
  assert.doesNotMatch(source, /<ZAxis|markerSize/);
});

test("scatter groups only exact coordinates and preserves all original members", async () => {
  const ts = (await import("typescript")).default;
  const source = await readFile("components/admin/studio/StudioAnalysisCharts.tsx", "utf8");
  const ast = ts.createSourceFile("chart.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const helper = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "groupStudioScatterPoints");
  assert.ok(helper, "exact-coordinate grouping helper exists");
  const compiled = ts.transpileModule(helper.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function("exports", compiled)(exports);
  const dishes = [
    { id: "a", category: "A", views: 10, three: 0 },
    { id: "b", category: "B", views: 10, three: 0 },
    { id: "c", category: "A", views: 10.01, three: 0 },
    { id: "d", category: "A", views: 10, three: 1 },
  ];
  const groups = exports.groupStudioScatterPoints(dishes);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].views, 10);
  assert.equal(groups[0].three, 0);
  assert.equal(groups[0].category, null);
  assert.deepEqual(groups[0].members, dishes.slice(0, 2));
  assert.equal(groups[1].members[0], dishes[2]);
  assert.equal(groups[1].category, "A");
  assert.deepEqual(groups.flatMap((group) => group.members), dishes);
  assert.match(source, /data-studio-scatter-chooser/);
  assert.match(source, /setScatterGroup\(point.payload.key\)/);
});
