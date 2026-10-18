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
      return {
        format: "module",
        source: "export default {};",
        shortCircuit: true,
      };
    if (url.endsWith(".tsx"))
      return {
        format: "module",
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            jsx: ts.JsxEmit.ReactJSX,
          },
        }).outputText,
        shortCircuit: true,
      };
    return nextLoad(url, context);
  },
});

function fixture() {
  const observationWindow = {
    range: "30d",
    startInclusive: "2026-10-01T00:00:00Z",
    endExclusive: "2026-10-21T00:00:00Z",
    comparisonStartInclusive: "2026-09-11T00:00:00Z",
    comparisonEndExclusive: "2026-10-01T00:00:00Z",
  };
  const events = Array.from({ length: 24 }, (_, index) => ({
    event_name: index === 0 ? "menu_opened" : "dish_opened",
    dish_slug: index % 2 ? "soupe" : "dessert",
    created_at: "2026-10-02T12:00:00Z",
  }));
  events.push({
    event_name: "dish_3d_clicked",
    created_at: "2026-10-02T13:00:00Z",
    dish_slug: "soupe",
  });
  const analytics = buildAdminAnalyticsState({
    observationWindow,
    events,
    previousEvents: events.map((row) => ({
      ...row,
      created_at: "2026-09-12T12:00:00Z",
    })),
    analyticsScope: {
      restaurantId: "r",
      menuId: "m",
      source: "production",
      metricDefinition: "all-events-v1",
    },
  });
  assert.equal(analytics.kind, "real");
  return {
    menu: {
      dishes: [
        { id: "a", name: "Soupe", category: "Entrées" },
        { id: "b", name: "Dessert", category: "Desserts" },
      ],
    },
    analytics,
    dishStatistics: {
      a: { views: 12, three: 1, ar: 0, previousViews: 0, changeRate: null },
      b: { views: 11, three: 0, ar: 0, previousViews: 11, changeRate: 0 },
    },
  };
}
const get = (datasets, id) => datasets.find((dataset) => dataset.id === id);

test("all five reference datasets bind real values, retain menu-wide UTC time scope and null historical evidence", async () => {
  const { createStudioAnalysisDatasets } =
    await import("../components/admin/studio/StudioAnalysisTables.tsx");
  const data = fixture();
  const all = createStudioAnalysisDatasets(data, "all", "views");
  const scoped = createStudioAnalysisDatasets(data, "Entrées", "views");
  assert.deepEqual(
    all.map((row) => row.id),
    ["dishes", "daily", "hours", "categories", "comparison"],
  );
  assert.equal(get(scoped, "dishes").rows.length, 1);
  assert.equal(get(scoped, "dishes").rows[0].previousMetric, 0);
  assert.equal(get(scoped, "dishes").rows[0].change, null);
  assert.deepEqual(get(scoped, "daily").rows, get(all, "daily").rows);
  assert.deepEqual(get(scoped, "hours").rows, get(all, "hours").rows);
  assert.equal(get(all, "daily").rows.length, 20);
  assert.equal(get(all, "daily").rows[1].views, 23);
  assert.equal(get(all, "daily").rows[1].three, 1);
  assert.equal(
    get(all, "hours").rows.reduce((sum, row) => sum + row.events, 0),
    25,
  );
  assert.deepEqual(
    get(all, "hours").columns.map((column) => column.id),
    ["label", "events"],
  );
  assert.match(get(all, "daily").description, /Menu entier.*UTC/);
  assert.match(get(all, "hours").description, /tous les événements.*UTC/);
  const immersive = createStudioAnalysisDatasets(data, "all", "three");
  assert.equal(get(immersive, "dishes").rows[0].previousMetric, null);
  assert.equal(get(immersive, "comparison").rows[0].previousCount, null);
  assert.equal(get(immersive, "comparison").rows[0].previous, null);
  assert.equal(get(immersive, "daily").rows[1].previousMetric, 1);
});

test("unsupported evidence never leaks stale rows or becomes a fabricated zero", async () => {
  const { createStudioAnalysisDatasets } =
    await import("../components/admin/studio/StudioAnalysisTables.tsx");
  const data = fixture();
  data.analytics.panels.dailyComparison = {
    kind: "insufficient",
    reason: "incompatible-or-empty-period",
  };
  data.dishStatistics.b.previousViews = null;
  let result = createStudioAnalysisDatasets(data, "all", "views");
  assert.ok(
    get(result, "daily").rows.every((row) => row.previousMetric === null),
  );
  assert.ok(
    get(result, "comparison").rows.every(
      (row) => row.previousCount === null && row.previous === null,
    ),
  );
  data.analytics.panels.ranking = {
    kind: "insufficient",
    reason: "no-dish-ranking-evidence",
  };
  result = createStudioAnalysisDatasets(data, "all", "views");
  for (const id of ["dishes", "categories", "comparison"]) {
    assert.deepEqual(get(result, id).rows, []);
    assert.match(get(result, id).emptyReason, /insuffisant/i);
  }
  assert.equal(get(result, "daily").rows.length, 20);
  assert.ok(get(result, "hours").rows.length > 0);
  data.analytics = { kind: "unavailable", reason: "database" };
  result = createStudioAnalysisDatasets(data, "all", "views");
  assert.ok(result.every((dataset) => dataset.rows.length === 0));
});

test("temporal evidence scopes daily/hourly metrics to category IDs in configured timezone and retains 3D/AR history", async () => {
  const { createStudioAnalysisDatasets } =
    await import("../components/admin/studio/StudioAnalysisTables.tsx");
  const { buildStudioTemporalAnalytics } =
    await import("../lib/admin/studioTemporalData.ts");
  const data = fixture();
  const event = (dish_id, event_name, created_at) => ({
    dish_id,
    event_name,
    created_at,
    schema_version: 2,
  });
  data.temporalAnalytics = buildStudioTemporalAnalytics({
    dishes: data.menu.dishes,
    window: data.analytics.observationWindow,
    timezone: "America/Montreal",
    sourceComplete: true,
    current: [
      event("a", "dish_3d_clicked", "2026-10-02T01:00:00Z"),
      event("b", "dish_3d_clicked", "2026-10-02T02:00:00Z"),
      event("a", "dish_ar_clicked", "2026-10-02T01:00:00Z"),
    ],
    previous: [
      event("a", "dish_3d_clicked", "2026-09-12T01:00:00Z"),
      event("a", "dish_ar_clicked", "2026-09-12T01:00:00Z"),
    ],
  });
  data.dishStatistics.a.previousThree = 1;
  data.dishStatistics.a.previousAr = 1;
  let rows = createStudioAnalysisDatasets(data, "Entrées", "three");
  assert.equal(
    get(rows, "daily").rows.reduce((n, r) => n + r.three, 0),
    1,
  );
  assert.equal(
    get(rows, "daily").rows.find((r) => r.id === "2026-10-01").three,
    1,
  );
  assert.equal(
    get(rows, "hours").rows.reduce((n, r) => n + r.events, 0),
    1,
  );
  assert.match(get(rows, "hours").description, /America\/Montreal/);
  assert.equal(get(rows, "dishes").rows[0].previousMetric, 1);
  assert.equal(get(rows, "comparison").rows[0].previousCount, 1);
  rows = createStudioAnalysisDatasets(data, "Entrées", "ar");
  assert.equal(get(rows, "dishes").rows[0].previousMetric, 1);
  // Local date counts can differ around DST; missing prior buckets stay unknown.
  data.temporalAnalytics.previous.dates =
    data.temporalAnalytics.previous.dates.slice(0, 1);
  rows = createStudioAnalysisDatasets(data, "Entrées", "ar");
  assert.equal(get(rows, "daily").rows[1].previousMetric, null);
  assert.equal(get(rows, "daily").rows[1].previousDate, null);
  data.temporalAnalytics.previous = null;
  rows = createStudioAnalysisDatasets(data, "Entrées", "three");
  assert.ok(
    get(rows, "daily").rows.every((row) => row.previousMetric === null),
  );
  data.temporalAnalytics = { kind: "unavailable", reason: "incomplete-source" };
  rows = createStudioAnalysisDatasets(data, "Entrées", "three");
  assert.deepEqual(get(rows, "daily").rows, []);
  assert.deepEqual(get(rows, "hours").rows, []);
});
