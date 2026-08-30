import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildAdminVisualFixtureTables, filterAdminVisualFixtureRows, paginateAdminVisualFixtureRows } from "./adminVisualFixtureData.ts";
import { getAllDishes } from "../../lib/demoMenuData.ts";

const fixture = buildAdminVisualFixtureTables({ scenario: process.env.VISTAIRE_ADMIN_FIXTURE_SCENARIO === "full-menu" ? "full-menu" : "pixel-reference" });
const tables = {
  restaurants: fixture.restaurants,
  qr_codes: fixture.qr_codes,
  menus: fixture.menus,
  menu_categories: fixture.menu_categories,
  menu_dishes: fixture.menu_dishes,
  analytics_events: fixture.analytics_events
};

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
  const row = fixture.menu_dishes.find((candidate) => {
    const metadata = candidate.metadata && typeof candidate.metadata === "object" ? candidate.metadata : {};
    return metadata.photoStorageBucket === bucket && metadata.photoStoragePath === path;
  });
  if (!row) return null;
  const slug = path.split("/").at(-1)?.replace(/\.png$/i, "") ?? "";
  const filePath = demoImages.get(slug);
  if (!filePath) return null;
  return { operation, bucket, path, filePath };
}

function sendStorageResponse(request, response, asset) {
  const bytes = readFileSync(asset.filePath);
  if (asset.operation === "info") {
    response.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "no-store"
    });
    response.end(JSON.stringify({ id: "fixture-object", name: asset.path, size: bytes.length, mimetype: "image/png" }));
    return;
  }
  if (request.method === "POST") {
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({ signedURL: `/object/sign/${asset.bucket}/${asset.path}?token=fixture-signed-token` }));
    return;
  }
  response.writeHead(200, {
    "content-type": "image/png",
    "content-length": String(bytes.length),
    "cache-control": "private, no-store"
  });
  if (request.method !== "HEAD") response.end(bytes);
  else response.end();
}

function filteredRows(url) {
  const table = url.pathname.split("/").filter(Boolean).pop();
  return filterAdminVisualFixtureRows(tables[table] ?? [], url.searchParams);
}

const port = Number(process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE_PORT || 3110);
const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
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
  const rows = filteredRows(url);
  const page = paginateAdminVisualFixtureRows(rows, request.headers.range, { offset: url.searchParams.get("offset"), limit: url.searchParams.get("limit") });
  response.writeHead(200, { "content-type": "application/json", "content-range": page.contentRange, "cache-control": "no-store" });
  response.end(JSON.stringify(page.rows));
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.close(() => process.exit(0)));
}

server.listen(port, "127.0.0.1", () => console.log(`admin visual fixture ready on ${port}`));
