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
  const source = await readFile("lib/analytics/insights.ts", "utf8");

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
