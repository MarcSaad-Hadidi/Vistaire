import http from "node:http";
import { rows } from "./sauge-noire-fixture-data.mjs";
import { buildFixtureDishSvg } from "./fixture-dish-images.mjs";

const port = Number(process.env.VISTAIRE_SAUGE_NOIRE_FIXTURE_PORT || 55434);

function createFixturePhotoToken() {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 270
  })).toString("base64url");
  return `e30.${payload}.fixture-signature`;
}

function isFixturePhotoToken(value) {
  if (typeof value !== "string") return false;
  const segments = value.split(".");
  if (segments.length !== 3 || segments[0] !== "e30" || segments[2] !== "fixture-signature") {
    return false;
  }
  try {
    const payload = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8"));
    return Number.isSafeInteger(payload.exp) && payload.exp >= Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function fixtureImageForPath(pathname) {
  const storageMatch = decodeURIComponent(pathname).match(
    /(restaurants\/[^/]+\/photos\/originals\/[^/?]+\.png)/
  );
  if (!storageMatch) return null;
  const sourceKey = storageMatch[1];
  const dish = rows.menu_dishes.find(
    (candidate) => candidate.metadata?.photoStoragePath === sourceKey
  );
  if (!dish) return null;
  const restaurant = rows.restaurants.find(
    (candidate) => candidate.id === dish.restaurant_id
  );
  return buildFixtureDishSvg({
    dishName: dish.name,
    restaurantName: restaurant?.name ?? "Restaurant",
    sourceKey
  });
}

function matches(row, key, expected) {
  const value = row?.[key];
  return expected.startsWith("eq.") ? String(value) === expected.slice(3) : true;
}

function readTable(url) {
  const table = url.pathname.split("/").filter(Boolean).pop();
  const tableRows = rows[table] ?? [];
  const filtered = tableRows.filter((row) =>
    [...url.searchParams.entries()]
      .filter(([key]) => !["select", "order", "limit", "offset"].includes(key))
      .every(([key, value]) => matches(row, key, value))
  );
  const order = url.searchParams.get("order");
  if (order) {
    const [column] = order.split(".");
    filtered.sort((a, b) => String(a?.[column] ?? "").localeCompare(String(b?.[column] ?? "")));
  }
  const limit = Number(url.searchParams.get("limit") ?? filtered.length);
  return filtered.slice(0, Number.isFinite(limit) ? limit : filtered.length);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (url.pathname === "/fixture/health") {
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({ ok: true, fixture: "sauge-noire" }));
    return;
  }
  if (url.pathname.startsWith("/rest/v1/")) {
    response.writeHead(200, { "content-type": "application/json", "content-range": "0-0/*", "cache-control": "no-store" });
    response.end(JSON.stringify(readTable(url)));
    return;
  }
  if (url.pathname.startsWith("/storage/v1/object/info/vistaire-media/")) {
    const image = fixtureImageForPath(url.pathname);
    if (!image) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "fixture_photo_not_found" }));
      return;
    }
    response.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "no-store"
    });
    response.end(JSON.stringify({ id: "fixture-photo", size: image.length }));
    return;
  }
  if (
    request.method === "POST" &&
    url.pathname.startsWith("/storage/v1/object/sign/vistaire-media/")
  ) {
    const signedPath = url.pathname.replace("/storage/v1", "");
    response.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "no-store"
    });
    response.end(
      JSON.stringify({ signedURL: `${signedPath}?token=${createFixturePhotoToken()}` })
    );
    return;
  }
  if (
    request.method === "GET" &&
    url.pathname.startsWith("/storage/v1/object/sign/vistaire-media/") &&
    isFixturePhotoToken(url.searchParams.get("token"))
  ) {
    const image = fixtureImageForPath(url.pathname);
    if (!image) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "fixture_photo_not_found" }));
      return;
    }
    response.writeHead(200, {
      "content-type": "image/svg+xml",
      "content-length": image.length,
      "cache-control": "private, max-age=3600"
    });
    response.end(image);
    return;
  }
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "fixture_not_found" }));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`sauge noire fixture ready on ${port}`);
});
