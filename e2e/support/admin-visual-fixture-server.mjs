import http from "node:http";

const restaurantId = "11111111-1111-1111-1111-111111111111";
const menuId = "menu-maison-elysee";
const categoryData = [
  ["cat-entrees", "Entrées", "entrees"],
  ["cat-signatures", "Plats signatures", "plats-signatures"],
  ["cat-principaux", "Plats principaux", "plats-principaux"],
  ["cat-desserts", "Desserts", "desserts"]
];
const categories = categoryData.map(([id, name, slug], index) => ({ id, name, slug, display_order: index + 1, restaurant_id: restaurantId, menu_id: menuId }));
const dishData = [
  ["ravioles", "cat-entrees", "Ravioles de chèvre frais", "ravioles-romarin", 3400, true],
  ["tartare", "cat-entrees", "Tartare de saumon", "tartare-saumon", 4200, true],
  ["veloute", "cat-entrees", "Velouté de saison", "veloute-saison", 2800, true],
  ["homard", "cat-signatures", "Homard bleu", "homard-bisque", 10400, true],
  ["canette", "cat-signatures", "Canette rôtie", "canette-figues", 9600, false],
  ["boeuf", "cat-signatures", "Bœuf du Québec", "boeuf-quebec", 8800, true],
  ["risotto", "cat-principaux", "Risotto aux cèpes", "risotto-cepes", 5400, true],
  ["sole", "cat-principaux", "Sole meunière", "sole-meuniere", 7200, true],
  ["agneau", "cat-principaux", "Agneau braisé", "agneau-braise", 6800, false],
  ["chocolat", "cat-desserts", "Chocolat grand cru", "chocolat-grand-cru", 2200, true],
  ["pavlova", "cat-desserts", "Pavlova aux fruits", "pavlova-fruits", 2100, true],
  ["fromages", "cat-desserts", "Fromages du Québec", "fromages-quebec", 2400, true]
];
if (dishData.length < 12) throw new Error("The full-menu fixture must contain at least 12 dishes");
const dishImages = [
  "ravioles-chevre-miel-monteregie.png", "tartare-saumon-label-rouge.png", "bar-de-ligne-artichaut-citron.png",
  "homard-bleu-bisque-fenouil.png", "canette-rotie-figues-epices.png", "pave-boeuf-mature-bordelaise.png",
  "risotto-cepes-parmesan.png", "maison-elyse-n1.png", "negroni-vieilli-fut.png",
  "souffle-chocolat-grand-cru.png", "tarte-citron-basilic-pourpre.png", "elixir-bergamote-earl-grey.png"
];
const dishes = dishData.map(([key, category_id, name, slug, price_cents, is_available], index) => ({
  id: `dish-${key}`, category_id, name, slug, price_cents, is_available,
  image_url: `/images/demo/dishes/${dishImages[index]}`, restaurant_id: restaurantId, menu_id: menuId,
  currency: "CAD", short_description: "", description: "", is_signature: index >= 3 && index <= 5,
  is_recommended: index < 4, has_immersive_view: index % 4 === 0, metadata: {}, created_at: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00Z`
}));

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

const foreign = { restaurant_id: "foreign-restaurant", menu_id: "foreign-menu", source: "demo" };
const tables = {
  restaurants: [{ id: restaurantId, name: "Maison Élysée", slug: "maison-elysee", city: "Montréal", cuisine_type: "Cuisine française contemporaine" }, { id: foreign.restaurant_id, name: "Foreign" }],
  menus: [{ id: menuId, restaurant_id: restaurantId, status: "published", is_primary: true, updated_at: "2026-07-10T10:24:00Z" }, { id: foreign.menu_id, restaurant_id: foreign.restaurant_id, status: "published" }],
  menu_categories: [...categories, { id: "foreign-category", name: "Foreign", slug: "foreign", ...foreign }],
  menu_dishes: [...dishes, { id: "foreign-dish", name: "Foreign", slug: "foreign", category_id: "foreign-category", is_available: true, ...foreign }],
  analytics_events: [...events, { id: "foreign-event", event_name: "menu_opened", created_at: "2026-07-09T12:00:00Z", ...foreign }]
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
