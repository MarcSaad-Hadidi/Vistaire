import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadAdminDataBundleWithDependencies } from "../lib/admin/data/loadAdminData.ts";

const access = { ok: true, sessionKind: "qr", assurance: "live-admin-qr", qrId: "q1", restaurantId: "r1", expiresAt: 1, capabilities: ["dashboard:read"] };
const restaurant = { ok: true, restaurant: { id: "r1", name: "Maison Élyse", slug: "maison-elyse" } };
const menu = { ok: true, menu: { id: "m1", restaurantId: "r1", slug: "menu", status: "published", isPrimary: true, settingsJson: { timezone: "America/Toronto" }, updatedAt: "2026-01-01T00:00:00.000Z" } };
const events = { ok: true, events: [], truncated: false, observedRows: 0, rowLimit: 1000 };

function dependencies(overrides = {}) {
  const calls = [];
  return { calls, value: {
    now: () => { calls.push("now"); return new Date("2026-01-10T18:00:00.000Z"); },
    readRestaurant: async (input) => { calls.push(["restaurant", input]); return restaurant; },
    readMenu: async (input) => { calls.push(["menu", input]); return menu; },
    readCatalog: async (scope) => { calls.push(["catalog", scope]); return { ok: true, categories: [], dishes: [{ id: "d1" }] }; },
    readEvents: async (input) => { calls.push(["events", input.window]); return events; },
    coverages: [],
    ...overrides
  } };
}

test("loader derives restaurant, menu, source and timezone server-side with one clock", async () => {
  const deps = dependencies();
  const result = await loadAdminDataBundleWithDependencies({ access, range: "today" }, deps.value);
  assert.equal(result.ok, true);
  assert.deepEqual(result.presentation, { restaurantName: "Maison Élyse", publicMenuPath: "/menu/maison-elyse" });
  assert.deepEqual(result.bundle.scope, { restaurantId: "r1", menuId: "m1", source: "production", timezone: "America/Toronto" });
  assert.equal(deps.calls.filter((call) => call === "now").length, 1);
  assert.deepEqual(deps.calls[0], ["restaurant", { restaurantId: "r1" }]);
  assert.deepEqual(deps.calls[1], ["menu", { restaurantId: "r1" }]);
  assert.doesNotMatch(JSON.stringify(result), /sessionId|session_id|rawRows/);
});

test("catalog, current and previous failures stay independent", async () => {
  let read = 0;
  const deps = dependencies({ readEvents: async () => { read += 1; if (read === 1) throw new Error("current"); return events; } });
  const result = await loadAdminDataBundleWithDependencies({ access, range: "7d" }, deps.value);
  assert.equal(result.ok, true);
  assert.equal(read, 2);
  const records = Object.values(result.bundle.records);
  assert.equal(records.find((item) => item.metricId === "catalog-dishes").state.kind, "available");
  assert.equal(records.find((item) => item.metricId === "observed-menu-opens" && item.period === "current").state.kind, "error");
});

test("timezone fallback preserves snapshots and marks calendar metrics unavailable", async () => {
  const deps = dependencies({ readMenu: async () => ({ ...menu, menu: { ...menu.menu, settingsJson: {} } }) });
  const result = await loadAdminDataBundleWithDependencies({ access, range: "today" }, deps.value);
  const records = Object.values(result.bundle.records);
  assert.equal(result.timezoneResolution.kind, "fallback");
  assert.equal(records.find((item) => item.metricId === "catalog-dishes").state.kind, "available");
  assert.equal(records.find((item) => item.metricId === "observed-menu-opens").state.reason, "timezone-unconfigured");
});

test("missing menu fails before catalog or analytics reads", async () => {
  let downstream = 0;
  const deps = dependencies({ readMenu: async () => ({ ok: true, menu: null }), readCatalog: async () => { downstream += 1; }, readEvents: async () => { downstream += 1; } });
  assert.deepEqual(await loadAdminDataBundleWithDependencies({ access, range: "today" }, deps.value), { ok: false, error: { code: "configuration", retryable: false } });
  assert.equal(downstream, 0);
});

test("missing or incomplete scoped restaurant presentation fails before downstream reads", async () => {
  for (const value of [null, { id: "r1", name: "", slug: "maison-elyse" }, { id: "r1", name: "Maison Élyse", slug: "" }, { id: "other", name: "Maison Élyse", slug: "maison-elyse" }]) {
    let downstream = 0;
    const deps = dependencies({
      readRestaurant: async () => ({ ok: true, restaurant: value }),
      readMenu: async () => { downstream += 1; return menu; },
      readCatalog: async () => { downstream += 1; },
      readEvents: async () => { downstream += 1; }
    });
    assert.deepEqual(await loadAdminDataBundleWithDependencies({ access, range: "today" }, deps.value), { ok: false, error: { code: "configuration", retryable: false } });
    assert.equal(downstream, 0);
  }
});

test("legacy admin analytics facades remain byte-for-byte unchanged from the frozen base", async () => {
  const frozenHashes = new Map([
    ["lib/admin/dashboardData.ts", "3c53bd7bc2131d4e0927c2ffaa28c630160d9197b97378c21526240d526b3d2c"],
    ["lib/admin/dashboardRange.ts", "fe29abeae76eb1b372b0f40713fe201013214c5fda42a6c287e2aea407e00d98"],
    ["lib/admin/analyticsState.ts", "3310b4f8725b373555c286687787d781ea4e8fb874264b559e7f6bacd891a09d"],
    ["lib/admin/analyticsPresentation.ts", "117dd47425e08ce9262c5c32aaf96569fa1b14e3f94ab70d4167ff9dc0703106"],
  ]);

  for (const [file, expectedHash] of frozenHashes) {
    const source = (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
    assert.equal(createHash("sha256").update(source, "utf8").digest("hex"), expectedHash, file);
  }
});
