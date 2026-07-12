import http from "node:http";
import { buildAdminVisualFixtureTables, filterAdminVisualFixtureRows } from "./adminVisualFixtureData.ts";

const fixture = buildAdminVisualFixtureTables({ scenario: process.env.VISTAIRE_ADMIN_FIXTURE_SCENARIO === "full-menu" ? "full-menu" : "pixel-reference" });
const tables = {
  restaurants: fixture.restaurants,
  menus: fixture.menus,
  menu_categories: fixture.menu_categories,
  menu_dishes: fixture.menu_dishes,
  analytics_events: fixture.analytics_events
};

function filteredRows(request) {
  const url = new URL(request.url, "http://localhost");
  const table = url.pathname.split("/").filter(Boolean).pop();
  return filterAdminVisualFixtureRows(tables[table] ?? [], url.searchParams);
}

const port = Number(process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE_PORT || 3110);
http.createServer((request, response) => {
  const rows = filteredRows(request);
  const rangeMatch = /^(\d+)-(\d+)$/.exec(request.headers.range ?? "");
  const rangeStart = rangeMatch ? Number(rangeMatch[1]) : 0;
  const rangeEnd = rangeMatch ? Number(rangeMatch[2]) : Math.max(0, rows.length - 1);
  const page = rows.slice(rangeStart, rangeEnd + 1);
  const contentRange = rows.length ? `${rangeStart}-${Math.max(rangeStart, rangeStart + page.length - 1)}/${rows.length}` : "*/0";
  response.writeHead(200, { "content-type": "application/json", "content-range": contentRange, "cache-control": "no-store" });
  response.end(JSON.stringify(page));
}).listen(port, "127.0.0.1", () => console.log(`admin visual fixture ready on ${port}`));
