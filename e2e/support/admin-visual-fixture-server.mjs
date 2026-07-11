import http from "node:http";
import { buildAdminVisualFixtureTables } from "./adminVisualFixtureData.ts";

const fixture = buildAdminVisualFixtureTables();
const { restaurantId, menuId } = fixture;
const categories = fixture.menu_categories.filter((item) => item.restaurant_id === restaurantId);
const dishes = fixture.menu_dishes.filter((item) => item.restaurant_id === restaurantId);

const events = [];
function addPeriod(prefix, year, month, startDay, count) {
  for (let index = 0; index < count; index++) {
    const dish = dishes[index % dishes.length];
    const category = categories.find((item) => item.id === dish.category_id);
    const created_at = new Date(Date.UTC(year, month, startDay + (index % 7), 12 + (index % 10))).toISOString();
    const session_id = `${prefix}-${index}`;
    events.push(
      { id: `${prefix}-m${index}`, restaurant_id: restaurantId, menu_id: menuId, session_id, event_name: "menu_opened", source: "production", created_at },
      { id: `${prefix}-d${index}`, restaurant_id: restaurantId, menu_id: menuId, dish_id: dish.id, dish_slug: dish.slug, category_slug: category.slug, session_id, event_name: "dish_opened", source: "production", created_at }
    );
    if (index % 4 === 0) events.push({ id: `${prefix}-s${index}`, restaurant_id: restaurantId, menu_id: menuId, session_id, event_name: "search_used", search_query: index % 8 === 0 ? "homard bleu" : "risotto cèpes", source: "production", created_at });
    if (index % 5 === 0) events.push({ id: `${prefix}-x${index}`, restaurant_id: restaurantId, menu_id: menuId, dish_id: dish.id, dish_slug: dish.slug, session_id, event_name: "dish_3d_clicked", source: "production", created_at });
  }
}
addPeriod("previous", 2026, 5, 26, 35);
addPeriod("current", 2026, 6, 3, 70);

const tables = {
  restaurants: fixture.restaurants,
  menus: fixture.menus,
  menu_categories: fixture.menu_categories,
  menu_dishes: fixture.menu_dishes,
  analytics_events: [...events, { id: "foreign-event", event_name: "menu_opened", created_at: "2026-07-09T12:00:00Z", ...fixture.foreign }]
};

function filteredRows(request) {
  const url = new URL(request.url, "http://localhost");
  const table = url.pathname.split("/").filter(Boolean).pop();
  let rows = tables[table] ?? [];
  for (const [column, raw] of url.searchParams) {
    const separator = raw.indexOf(".");
    const operator = separator < 0 ? raw : raw.slice(0, separator);
    const value = separator < 0 ? "" : raw.slice(separator + 1);
    if (operator === "eq") rows = rows.filter((row) => String(row[column] ?? "") === value);
    if (operator === "gte") rows = rows.filter((row) => String(row[column] ?? "") >= value);
    if (operator === "lt") rows = rows.filter((row) => String(row[column] ?? "") < value);
  }
  return rows;
}

const port = Number(process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE_PORT || 3110);
http.createServer((request, response) => {
  const rows = filteredRows(request);
  response.writeHead(200, { "content-type": "application/json", "content-range": `0-${Math.max(0, rows.length - 1)}/${rows.length}`, "cache-control": "no-store" });
  response.end(JSON.stringify(rows));
}).listen(port, "127.0.0.1", () => console.log(`admin visual fixture ready on ${port}`));
