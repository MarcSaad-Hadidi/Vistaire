import http from "node:http";
import { buildAdminVisualFixtureTables, filterAdminVisualFixtureRows, paginateAdminVisualFixtureRows } from "./adminVisualFixtureData.ts";

const fixture = buildAdminVisualFixtureTables({ scenario: process.env.VISTAIRE_ADMIN_FIXTURE_SCENARIO === "full-menu" ? "full-menu" : "pixel-reference" });
const tables = {
  restaurants: fixture.restaurants,
  qr_codes: fixture.qr_codes,
  menus: fixture.menus,
  menu_categories: fixture.menu_categories,
  menu_dishes: fixture.menu_dishes,
  analytics_events: fixture.analytics_events
};

function filteredRows(url) {
  const table = url.pathname.split("/").filter(Boolean).pop();
  return filterAdminVisualFixtureRows(tables[table] ?? [], url.searchParams);
}

const port = Number(process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE_PORT || 3110);
http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  const rows = filteredRows(url);
  const page = paginateAdminVisualFixtureRows(rows, request.headers.range, { offset: url.searchParams.get("offset"), limit: url.searchParams.get("limit") });
  response.writeHead(200, { "content-type": "application/json", "content-range": page.contentRange, "cache-control": "no-store" });
  response.end(JSON.stringify(page.rows));
}).listen(port, "127.0.0.1", () => console.log(`admin visual fixture ready on ${port}`));
