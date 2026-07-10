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
});

test("dashboard reads explicit fields and scopes selected menu in the database", async () => {
  const reader = await readFile("lib/analytics/serverRows.ts", "utf8");
  const scoped = reader.slice(reader.indexOf("export async function readSupabaseRowsByFilters"));
  assert.match(reader, /readSupabaseRowsByFilters/);
  assert.match(reader, /\.select\(columns\)/);
  assert.match(reader, /for \(const \[column, value\] of Object\.entries\(filters\)\)/);
  assert.match(reader, /query = query\.eq\(column, value\)/);
  assert.ok(scoped.indexOf("query = query.eq(column, value)") < scoped.indexOf(".limit(limit)"));
});
