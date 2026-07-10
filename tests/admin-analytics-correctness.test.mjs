import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("partial analytics retain the real insight payload", async () => {
  const { buildAdminAnalyticsState } = await import("../lib/admin/analyticsState.ts");
  const insights = { generatedFor: "Trouvable", summary: [{ id: "menu-opens", value: "3" }] };

  const state = buildAdminAnalyticsState({
    source: "partial",
    note: "Données réelles — échantillon encore limité.",
    insights
  });

  assert.equal(state.kind, "partial");
  assert.deepEqual(state.insights, insights);
  assert.match(state.message, /Données réelles/i);
});

test("analytics recognize the current Vistaire aggregate column names", async () => {
  const source = await readFile("lib/analytics/insightsCore.mjs", "utf8");

  for (const column of [
    "menu_opened_count",
    "dish_opened_count",
    "search_used_count",
    "filter_used_count",
    "category_viewed_count",
    "dish_3d_clicked_count",
    "dish_ar_clicked_count",
    "immersive_interaction_count",
    "unique_sessions"
  ]) {
    assert.match(source, new RegExp(`['\"]${column}['\"]`));
  }
});

test("analytics use one explicit 30-day window instead of server-local current-day fallbacks", async () => {
  const source = await readFile("lib/analytics/insights.ts", "utf8");
  const reader = await readFile("lib/analytics/serverRows.ts", "utf8");

  assert.match(source, /ANALYTICS_WINDOW_DAYS\s*=\s*30/);
  assert.match(source, /America\/Toronto/);
  assert.doesNotMatch(source, /filterRowsForCurrentDay/);
  assert.match(reader, /created_at/);
  assert.match(reader, /\.order\(.*created_at/);
  assert.match(reader, /\.range\(/);
});

test("a real analytics result is built from general activity even without a top dish", async () => {
  const source = await readFile("lib/analytics/insights.ts", "utf8");

  assert.doesNotMatch(source, /if\s*\(topDishes\.length\s*===\s*0\)\s*return\s+null/);
  assert.match(source, /Pas encore assez de données/);
});

test("dashboard selects one restaurant menu before reading categories and dishes", async () => {
  const source = await readFile("lib/admin/dashboardData.ts", "utf8");

  assert.match(source, /selectAdminDashboardMenu/);
  assert.match(source, /readSupabaseRowsByColumn\(\s*["']menus["'],\s*["']restaurant_id["'],\s*restaurantId/);
  assert.match(source, /\.filter\([\s\S]*?menu_id[\s\S]*?selectedMenu\.id/);
});

test("a zero in the 30-day window never falls back to all-time search rows", async () => {
  const { buildPeriodAnalytics } = await import("../lib/analytics/insightsCore.mjs");
  const period = buildPeriodAnalytics({
    dailyRows: [{ menu_opened_count: 1, search_used_count: 0 }],
    eventRows: [],
    // These are legacy all-time rows and deliberately have no input slot.
  });

  assert.equal(period.metrics.searches, 0);
  assert.deepEqual(period.searchRows, []);
});

test("period metrics retain zero values and use current aggregate columns", async () => {
  const { buildPeriodAnalytics } = await import("../lib/analytics/insightsCore.mjs");
  const period = buildPeriodAnalytics({
    dailyRows: [{
      menu_opened_count: 2,
      dish_opened_count: 278,
      search_used_count: 0,
      immersive_interaction_count: 169,
      unique_sessions: 7
    }],
    eventRows: []
  });

  assert.equal(period.metrics.dishViews, 278);
  assert.equal(period.metrics.searches, 0);
  assert.equal(period.metrics.immersive, 169);
});

test("analytics source health marks read errors and truncation partial", async () => {
  const { resolveAnalyticsSourceHealth } = await import("../lib/analytics/insightsCore.mjs");

  assert.equal(resolveAnalyticsSourceHealth({ hasActivity: true, eventReadOk: false, eventTruncated: false, dailyReadOk: true }), "partial");
  assert.equal(resolveAnalyticsSourceHealth({ hasActivity: true, eventReadOk: true, eventTruncated: true, dailyReadOk: true }), "partial");
  assert.equal(resolveAnalyticsSourceHealth({ hasActivity: false, eventReadOk: true, eventTruncated: false, dailyReadOk: true }), "empty");
  assert.equal(resolveAnalyticsSourceHealth({ hasActivity: true, eventReadOk: true, eventTruncated: false, dailyReadOk: true }), "real");
});

test("search insights are ordered by observed count before display", async () => {
  const { sortSearchRowsByCount } = await import("../lib/analytics/insightsCore.mjs");
  const rows = [
    { search_query: "early", search_count: 1 },
    { search_query: "popular", search_count: 4 },
    { search_query: "middle", search_count: 2 }
  ];

  assert.deepEqual(
    sortSearchRowsByCount(rows).map((row) => row.search_query),
    ["popular", "middle", "early"]
  );
});
