import http from "node:http";
import { rows } from "./sauge-noire-fixture-data.mjs";

const port = Number(process.env.VISTAIRE_SAUGE_NOIRE_FIXTURE_PORT || 55434);

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
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "fixture_not_found" }));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`sauge noire fixture ready on ${port}`);
});
