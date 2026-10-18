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
