import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("dashboard loader exposes the approved nested range contract without demo analytics", async () => {
  const source = await readFile("lib/admin/dashboardData.ts", "utf8");
  assert.match(source, /loadAdminDashboardData\(\s*restaurantId:\s*string,\s*range:\s*AdminDashboardRange/);
  assert.match(source, /location:\s*string \| null/);
  assert.match(source, /cuisineType:\s*string \| null/);
  assert.match(source, /timezone:\s*null/);
  assert.match(source, /publicMenuPath:\s*string/);
  assert.match(source, /menu:\s*\{/);
  assert.doesNotMatch(source, /DemoAdminInsights|getRestaurantInsights/);
  assert.doesNotMatch(source, /AdminAnalyticsState<any>|menuPath:\s*string/);
});

test("dashboard reads explicit fields and scopes selected menu in the database", async () => {
  const reader = await readFile("lib/analytics/serverRows.ts", "utf8");
  const dashboard = await readFile("lib/admin/dashboardData.ts", "utf8");
  const dishRead = dashboard.split("\n").find((line) => line.includes('table: "menu_dishes"')) ?? "";
  const scoped = reader.slice(reader.indexOf("export async function readSupabaseRowsByFilters"));
  assert.match(reader, /readSupabaseRowsByFilters/);
  assert.match(reader, /\.select\(columns\)/);
  assert.match(reader, /for \(const \[column, value\] of Object\.entries\(filters\)\)/);
  assert.match(reader, /query = query\.eq\(column, value\)/);
  assert.ok(scoped.indexOf("query = query.eq(column, value)") < scoped.indexOf(".limit(limit)"));
  assert.match(dishRead, /short_description,description,price_cents,currency,image_url/);
  assert.match(dishRead, /has_immersive_view,metadata,created_at/);
  assert.doesNotMatch(dishRead, /thumbnail_url|model_3d_url|display_order/);
});

test("range parser remains exported for UI-owned page wiring", async () => {
  const range = await readFile("lib/admin/dashboardRange.ts", "utf8");
  assert.match(range, /export function parseAdminDashboardRange/);
  assert.match(range, /value === "today-utc" \|\| value === "7d" \|\| value === "30d"/);
});

test("admin page search params parser exposes range only", async () => {
  const { parseAdminPageSearchParams } = await import("../lib/admin/pageSearchParams.ts");
  assert.equal(parseAdminPageSearchParams({ range: "30d", restaurantId: "attacker" }), "30d");
  assert.equal(parseAdminPageSearchParams({ range: ["30d"] }), "7d");
  assert.equal(parseAdminPageSearchParams({ restaurantId: "attacker" }), "7d");
});

test("dashboard analytics reads both compatible periods and partitions them without synthetic fallback", async () => {
  const source = await readFile("lib/admin/dashboardData.ts", "utf8");
  assert.match(source, /fromIso:\s*window\.comparisonStartInclusive/);
  assert.match(source, /previousEvents/);
  assert.match(source, /currentEvents/);
  assert.doesNotMatch(source, /buildMaisonElyseeDemoEvents/);
});
