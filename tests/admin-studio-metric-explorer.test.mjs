import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";
import { buildAdminAnalyticsState } from "../lib/admin/analyticsState.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".tsx")) {
      for (const extension of [".tsx", ".ts"]) {
        const url = new URL(`${specifier}${extension}`, context.parentURL);
        if (existsSync(url)) return { url: url.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".css"))
      return { format: "module", source: "export default {};", shortCircuit: true };
    if (url.endsWith(".tsx"))
      return {
        format: "module",
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
        }).outputText,
        shortCircuit: true,
      };
    return nextLoad(url, context);
  },
});

function fixture() {
  const observationWindow = {
    range: "7d",
    startInclusive: "2026-10-01T00:00:00Z",
    endExclusive: "2026-10-08T00:00:00Z",
    comparisonStartInclusive: "2026-09-24T00:00:00Z",
    comparisonEndExclusive: "2026-10-01T00:00:00Z",
  };
  const events = Array.from({ length: 30 }, (_, index) => ({
    event_name: index === 0 ? "menu_opened" : "dish_opened",
    dish_slug: index < 18 ? "soupe" : "dessert",
    created_at: "2026-10-02T12:00:00Z",
  }));
  events.push({ event_name: "dish_3d_clicked", dish_slug: "soupe", created_at: "2026-10-02T13:00:00Z" });
  const analytics = buildAdminAnalyticsState({
    observationWindow,
    events,
    previousEvents: events.map((event) => ({ ...event, created_at: "2026-09-25T12:00:00Z" })),
    analyticsScope: { restaurantId: "r", menuId: "m", source: "production", metricDefinition: "all-events-v1" },
  });
  assert.equal(analytics.kind, "real");
  return {
    menu: { dishes: [
      { id: "a", name: "Soupe", category: "Entrées" },
      { id: "b", name: "Dessert", category: "Desserts" },
    ] },
    analytics,
    dishStatistics: {
      a: { views: 17, three: 1, ar: 0, previousViews: 16, changeRate: 1 / 16 },
      b: { views: 11, three: 0, ar: 0, previousViews: 0, changeRate: null },
    },
  };
}

test("explorer uses menu-wide UTC series and real dish rows; sort selection changes order without mutating inputs", async () => {
  const { createStudioMetricExplorerData } = await import("../components/admin/studio/StudioMetricExplorer.tsx");
  const data = fixture();
  const before = structuredClone(data);
  const views = createStudioMetricExplorerData(data, "dishOpened");
  assert.equal(views.total, 29);
  assert.equal(views.previous, 29);
  assert.equal(views.delta, 0);
  assert.equal(views.length, 7);
  assert.equal(views.from, "2026-10-01");
  assert.equal(views.to, "2026-10-07");
  assert.equal(views.previousTo, "2026-09-30");
  assert.deepEqual(views.series, data.analytics.metricSeries.dishOpened);
  assert.deepEqual(views.dishes.map((row) => row.dish.id), ["b", "a"]);
  assert.equal(views.dishes[0].previous, 0);
  assert.equal(views.dishes[0].delta, 11);
  assert.equal(views.dishTotals.current, 28, "Displayed dish totals must not claim to equal the menu total");
  const byVolume = createStudioMetricExplorerData(data, "dishOpened", "current");
  assert.deepEqual(byVolume.dishes.map((row) => row.dish.id), ["a", "b"]);
  const three = createStudioMetricExplorerData(data, "three");
  assert.equal(three.total, 1);
  assert.equal(three.previous, 1, "Menu-wide history is supported independently of dish history");
  assert.ok(three.dishes.every((row) => row.previous === null && row.delta === null));
  assert.equal(three.dishTotals.previous, null);
  assert.equal(three.dishComparisonAvailable, false);
  assert.equal(createStudioMetricExplorerData(data, "menuOpened").dishes.length, 0);
  assert.equal(createStudioMetricExplorerData(data, "searches").dishes.length, 0);
  assert.deepEqual(data, before);
});

test("missing comparison, dish evidence and source data stay unavailable instead of leaking history or inventing zeros", async () => {
  const { createStudioMetricExplorerData } = await import("../components/admin/studio/StudioMetricExplorer.tsx");
  const data = fixture();
  delete data.dishStatistics.a;
  let result = createStudioMetricExplorerData(data, "dishOpened");
  assert.equal(result.dishes.find((row) => row.dish.id === "a").current, null);
  assert.equal(result.dishTotals.current, null);
  data.analytics.panels.dailyComparison = { kind: "insufficient", reason: "incompatible-or-empty-period" };
  result = createStudioMetricExplorerData(data, "dishOpened");
  assert.equal(result.previous, null);
  assert.equal(result.delta, null);
  assert.equal(result.deltaPercent, null);
  assert.deepEqual(result.series.previous, []);
  assert.ok(result.dishes.every((row) => row.previous === null && row.delta === null));
  data.analytics.panels.ranking = { kind: "insufficient", reason: "no-dish-ranking-evidence" };
  assert.deepEqual(createStudioMetricExplorerData(data, "dishOpened").dishes, []);
  data.analytics.panels.currentDaily = { kind: "unavailable", reason: "source-incomplete" };
  assert.equal(createStudioMetricExplorerData(data, "dishOpened"), null);
  data.analytics = { kind: "unavailable", reason: "database" };
  assert.equal(createStudioMetricExplorerData(data, "dishOpened"), null);
});
