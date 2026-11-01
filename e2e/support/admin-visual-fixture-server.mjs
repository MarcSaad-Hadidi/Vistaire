import http from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { saugeNoireFixture } from "./sauge-noire-fixture-data.mjs";
import { buildFixtureDishSvg } from "./fixture-dish-images.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ADMIN_VISUAL_QR_TOKEN, buildAdminVisualFixtureTables, filterAdminVisualFixtureRows, paginateAdminVisualFixtureRows } from "./adminVisualFixtureData.ts";
import { getAllDishes } from "../../lib/demoMenuData.ts";

const fixture = buildAdminVisualFixtureTables({ scenario: process.env.VISTAIRE_ADMIN_FIXTURE_SCENARIO === "full-menu" ? "full-menu" : "pixel-reference" });
const tables = {
  restaurants: fixture.restaurants,
  qr_codes: fixture.qr_codes,
  menus: fixture.menus,
  menu_categories: fixture.menu_categories,
  menu_dishes: fixture.menu_dishes,
  analytics_events: process.env.VISTAIRE_ADMIN_FIXTURE_ZERO_3D === "1"
    ? fixture.analytics_events.filter(row => row.event_name !== "dish_3d_clicked")
    : fixture.analytics_events,
  dish_schedules: fixture.dish_schedules,
  menu_change_history: fixture.menu_change_history
};
// Distinct Sauge IDs preserve every existing Maison visual fixture row.
for (const [table, rows] of Object.entries(saugeNoireFixture)) {
  tables[table] = [...(tables[table] ?? []), ...structuredClone(rows)];
}
const baselineTables = structuredClone(tables);
let analyticsReadError = false;
const qrTokenHash = `sha256:${createHash("sha256").update(ADMIN_VISUAL_QR_TOKEN).digest("hex")}`;

const demoImages = new Map(
  getAllDishes().flatMap((dish) =>
    dish.image ? [[dish.slug, fileURLToPath(new URL(`../../public${dish.image}`, import.meta.url))]] : []
  )
);

function storageAsset(url) {
  const prefix = "/storage/v1/object/";
  if (!url.pathname.startsWith(prefix)) return null;
  const remainder = url.pathname.slice(prefix.length);
  const operation = remainder.startsWith("info/")
    ? "info"
    : remainder.startsWith("sign/")
      ? "sign"
      : null;
  if (!operation) return null;
  const assetPath = remainder.slice(operation.length + 1);
  const separator = assetPath.indexOf("/");
  if (separator < 1) return null;
  const bucket = decodeURIComponent(assetPath.slice(0, separator));
  const path = decodeURIComponent(assetPath.slice(separator + 1));
  const row = tables.menu_dishes.find((candidate) => {
    const metadata = candidate.metadata && typeof candidate.metadata === "object" ? candidate.metadata : {};
    return metadata.photoStorageBucket === bucket && metadata.photoStoragePath === path;
  });
  if (!row) return null;
  const slug = path.split("/").at(-1)?.replace(/\.png$/i, "") ?? "";
  const filePath = demoImages.get(slug);
  if (!filePath) {
    if (!saugeNoireFixture.menu_dishes.some((dish) => dish.id === row.id)) return null;
    return { operation, bucket, path, bytes: buildFixtureDishSvg({ dishName: row.name, restaurantName: "Sauge Noire", sourceKey: path }), contentType: "image/svg+xml" };
  }
  return { operation, bucket, path, filePath, contentType: "image/png" };
}

function sendStorageResponse(request, response, asset) {
  const bytes = asset.bytes ?? readFileSync(asset.filePath);
  if (asset.operation === "info") {
    response.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "no-store"
    });
    response.end(JSON.stringify({ id: "fixture-object", name: asset.path, size: bytes.length, mimetype: asset.contentType }));
    return;
  }
  if (request.method === "POST") {
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({ signedURL: `/object/sign/${asset.bucket}/${asset.path}?token=fixture-signed-token` }));
    return;
  }
  response.writeHead(200, {
    "content-type": asset.contentType,
    "content-length": String(bytes.length),
    "cache-control": "private, no-store"
  });
  if (request.method !== "HEAD") response.end(bytes);
  else response.end();
}

function filteredRows(url) {
  const table = url.pathname.split("/").filter(Boolean).pop();
  const rows = [...filterAdminVisualFixtureRows(tables[table] ?? [], url.searchParams)];
  const order = url.searchParams.get("order");
  if (order) { const [key, direction] = order.split("."); rows.sort((a, b) => String(a[key] ?? "").localeCompare(String(b[key] ?? "")) * (direction === "desc" ? -1 : 1)); }
  return rows;
}

function sendJson(response, status, value) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(value));
}

async function handleRpc(request, response, name) {
  let body;
  try {
    let raw = "";
    for await (const chunk of request) {
      raw += chunk;
      if (raw.length > 32768) return sendJson(response, 413, { message: "Fixture request too large" });
    }
    body = JSON.parse(raw || "{}");
  } catch { return sendJson(response, 400, { message: "Invalid fixture request" }); }
  if (name === "resolve_qr_code_scan_metadata") {
    return sendJson(response, 200, body.p_token_hash === qrTokenHash ? fixture.qr_codes : []);
  }
  if (!["save_admin_dish_schedule", "set_admin_dish_manual_availability", "set_admin_dish_availability"].includes(name)) {
    return sendJson(response, 404, { code: "PGRST202", message: `Could not find the function public.${name}` });
  }
  const qr = tables.qr_codes.find((row) => row.id === body.p_qr_id && row.restaurant_id === body.p_restaurant_id && row.status === "active" && row.target_kind === "admin" && row.target_path === "/admin");
  const menu = tables.menus.find((row) => row.restaurant_id === body.p_restaurant_id && row.status === "published" && row.is_primary);
  const dish = tables.menu_dishes.find((row) => row.id === body.p_dish_id && row.restaurant_id === body.p_restaurant_id && row.menu_id === menu?.id);
  if (!qr || !dish) return sendJson(response, 403, { code: "42501", message: "Admin access or selected dish invalid" });
  const current = tables.dish_schedules.find((row) => row.dish_id === dish.id && row.restaurant_id === dish.restaurant_id);
  const now = new Date().toISOString();
  const history = (kind, before_value, after_value, request_id = null) => tables.menu_change_history.push({ id: randomUUID(), restaurant_id: dish.restaurant_id, dish_id: dish.id, kind, before_value, after_value, request_id, occurred_at: now });
  if (name === "save_admin_dish_schedule") {
    const after = { dishId: dish.id, timezone: body.p_timezone, baseAvailable: body.p_base_available, manualOverride: body.p_manual_override, rules: body.p_rules };
    const replay = tables.menu_change_history.find((row) => row.restaurant_id === dish.restaurant_id && row.request_id === body.p_request_id);
    if (replay) return JSON.stringify(replay.after_value) === JSON.stringify(after) ? sendJson(response, 200, null) : sendJson(response, 409, { code: "40001", message: "Request identifier already used" });
    if ((current?.revision ?? 0) !== body.p_expected_revision || (menu.settings_json?.timezone ?? null) !== body.p_expected_timezone) return sendJson(response, 409, { code: "40001", message: "Schedule or timezone changed" });
    const before = current ? structuredClone(current) : null;
    const next = { dish_id: dish.id, restaurant_id: dish.restaurant_id, base_available: body.p_base_available, manual_override: body.p_manual_override, rules: structuredClone(body.p_rules), revision: (current?.revision ?? 0) + 1, updated_at: now };
    if (current) Object.assign(current, next); else tables.dish_schedules.push(next);
    menu.settings_json = { ...menu.settings_json, timezone: body.p_timezone, availabilityScheduleVersion: 1 };
    history("schedule", before, after, body.p_request_id);
    return sendJson(response, 200, null);
  }
  const previousAvailability = dish.is_available;
  const previousOverride = current?.manual_override ?? null;
  dish.is_available = body.p_available;
  dish.updated_at = now;
  if (current && current.manual_override !== body.p_available) {
    current.manual_override = body.p_available;
    current.revision += 1;
    current.updated_at = now;
  }
  if (previousAvailability !== body.p_available) history("availability", previousAvailability, body.p_available);
  else if (current && previousOverride !== body.p_available) history("availability", { manual_override: previousOverride }, { manual_override: body.p_available });
  const result = { dish_id: dish.id, dish_slug: dish.slug, is_available: dish.is_available, updated_at: now };
  return sendJson(response, 200, request.headers.accept?.includes("application/vnd.pgrst.object+json") ? result : [result]);
}

const port = Number(process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE_PORT || 3110);
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (request.method === "POST" && url.pathname === "/fixture/analytics-read-error") {
    analyticsReadError = url.searchParams.get("enabled") === "1";
    return sendJson(response, 200, { ok: true });
  }
  if (request.method === "POST" && url.pathname === "/fixture/reset-admin-scheduling") {
    for (const [table, rows] of Object.entries(baselineTables)) tables[table] = structuredClone(rows);
    return sendJson(response, 200, { ok: true });
  }
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    await handleRpc(request, response, url.pathname.split("/").at(-1));
    return;
  }
  if (url.pathname.startsWith("/storage/v1/object/")) {
    const asset = storageAsset(url);
    if (!asset) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Not found" }));
      return;
    }
    sendStorageResponse(request, response, asset);
    return;
  }
  // Exercise the deployed pre-v2 analytics schema in every admin browser test.
  // Unknown projected columns must fail like PostgREST, rather than silently
  // returning rows and hiding rollout regressions.
  if (url.pathname === "/rest/v1/analytics_events") {
    if (analyticsReadError) return sendJson(response, 400, { code: "42703", message: "column analytics_events.unavailable_fixture_column does not exist" });
    const selected = (url.searchParams.get("select") ?? "").split(",");
    const missing = ["schema_version", "environment", "sequence"].find(column => selected.includes(column) || url.searchParams.has(column));
    if (missing) return sendJson(response, 400, { code: "42703", message: `column analytics_events.${missing} does not exist` });
  }
  const rows = filteredRows(url);
  const page = paginateAdminVisualFixtureRows(rows, request.headers.range, { offset: url.searchParams.get("offset"), limit: url.searchParams.get("limit") });
  response.writeHead(200, { "content-type": "application/json", "content-range": page.contentRange, "cache-control": "no-store" });
  response.end(JSON.stringify(page.rows));
});
server.listen(port, "127.0.0.1", () => console.log(`admin visual fixture ready on ${server.address().port}`));
