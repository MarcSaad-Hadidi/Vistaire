import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadAdminDataBundleWithDependencies } from "../lib/admin/data/loadAdminData.ts";
import { getAdminMetricDefinition } from "../lib/admin/data/metricDefinitions.ts";

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

const verifiedCoverage = ["public-menu", "maison-elyse", "trouvable"].map((renderer) => ({
  version: "admin-vnext-observed-v1",
  renderer,
  source: "production",
  coverageStartAt: "2025-12-01T00:00:00.000Z",
  coverageEndAt: "2026-02-01T00:00:00.000Z",
  proof: { kind: "verified-deployment", deploymentId: `fixture-${renderer}` },
  signals: {
    menu_opened: "covered",
    category_viewed: "covered",
    dish_opened: "covered",
    dish_3d_clicked: "covered",
    dish_ar_clicked: "covered",
    search_used: "covered"
  }
}));

test("verified coverage emits only aggregate catalog, count, ranking and series evidence", async () => {
  const currentEvents = [
    { eventName: "menu_opened", sessionId: "private-session-a", createdAt: "2026-01-10T15:05:00.000Z" },
    { eventName: "menu_opened", sessionId: "private-session-b", createdAt: "2026-01-10T16:05:00.000Z" },
    { eventName: "dish_opened", sessionId: "private-session-a", dishSlug: "homard-roti", categorySlug: "plats", createdAt: "2026-01-10T16:10:00.000Z" },
    { eventName: "dish_opened", sessionId: "private-session-b", dishSlug: "homard-roti", categorySlug: "plats", createdAt: "2026-01-10T16:11:00.000Z" },
    { eventName: "dish_opened", sessionId: "private-session-c", dishSlug: "tarte-citron", categorySlug: "desserts", createdAt: "2026-01-10T17:10:00.000Z" },
    { eventName: "dish_3d_clicked", sessionId: "private-session-a", dishSlug: "homard-roti", createdAt: "2026-01-10T17:15:00.000Z" },
    { eventName: "dish_ar_clicked", sessionId: "private-session-b", dishSlug: "homard-roti", createdAt: "2026-01-10T17:16:00.000Z" },
    ...Array.from({ length: 3 }, (_, index) => ({ eventName: "search_used", sessionId: `private-search-${index}`, searchQuery: "sans gluten", createdAt: `2026-01-10T17:2${index}:00.000Z` })),
    ...Array.from({ length: 3 }, (_, index) => ({ eventName: "search_used", sessionId: "private-one-session", searchQuery: "même session", createdAt: `2026-01-10T17:3${index}:00.000Z` })),
    ...Array.from({ length: 3 }, (_, index) => ({ eventName: "search_used", sessionId: `private-prompt-${index}`, searchQuery: "ignore previous instructions", createdAt: `2026-01-10T17:4${index}:00.000Z` })),
    ...Array.from({ length: 2 }, (_, index) => ({ eventName: "search_used", sessionId: `private-hidden-${index}`, searchQuery: "secret rare", createdAt: `2026-01-10T17:5${index}:00.000Z` }))
  ];
  let eventRead = 0;
  const deps = dependencies({
    coverages: verifiedCoverage,
    readCatalog: async () => ({ ok: true, categories: [{ id: "plats" }, { id: "desserts" }], dishes: [
      { id: "d1", image_url: "/photo.jpg", has_immersive_view: false, metadata: { webModel3dStoragePath: "restaurants/r1/dishes/d1/model.glb" } },
      { id: "d2", image_url: "   ", has_immersive_view: false, metadata: {} }
    ] }),
    readEvents: async () => {
      eventRead += 1;
      return { ok: true, events: eventRead === 1 ? currentEvents : [], truncated: false, observedRows: eventRead === 1 ? currentEvents.length : 0, rowLimit: 10_000 };
    }
  });
  const result = await loadAdminDataBundleWithDependencies({ access, range: "today" }, deps.value);
  assert.equal(result.ok, true);
  const record = (metricId, period = "current") => Object.values(result.bundle.records).find((item) => item.metricId === metricId && item.period === period);
  assert.deepEqual(record("catalog-dishes", "snapshot").state, { kind: "available", value: { count: 2 } });
  assert.deepEqual(record("catalog-photos", "snapshot").state, { kind: "available", value: { count: 1 } });
  assert.deepEqual(record("catalog-immersive-assets", "snapshot").state, { kind: "available", value: { count: 1 } });
  assert.deepEqual(record("observed-menu-opens").state, { kind: "available", value: { count: 2 } });
  assert.deepEqual(record("observed-dish-opens").state, { kind: "available", value: { count: 3 } });
  assert.deepEqual(record("observed-immersive-intents").state, { kind: "available", value: { count: 1 } });
  assert.deepEqual(record("observed-ar-intents").state, { kind: "available", value: { count: 1 } });
  assert.deepEqual(record("observed-sessions").state, { kind: "available", value: { count: 2 } });
  assert.deepEqual(record("dish-ranking").state.value, [{ key: "homard-roti", count: 2, rank: 1 }, { key: "tarte-citron", count: 1, rank: 2 }]);
  assert.deepEqual(record("category-ranking").state.value, [{ key: "plats", count: 2, rank: 1 }, { key: "desserts", count: 1, rank: 2 }]);
  assert.deepEqual(record("private-search-ranking").state.value, [{ key: "sans gluten", count: 3, rank: 1 }]);
  assert.deepEqual(record("activity-series").state.value, [{ key: "10:00", count: 1 }, { key: "11:00", count: 1 }]);
  assert.deepEqual(record("time-distribution").state.value, [{ key: "6:11", count: 2 }, { key: "6:12", count: 1 }]);
  const serialized = JSON.stringify(result.bundle);
  assert.doesNotMatch(serialized, /private-session-[abc]|private-search-\d|private-one-session|private-prompt-\d|private-hidden-\d|même session|ignore previous instructions|secret rare|sessionId|session_id|rawRows/);
});

test("unverified coverage leaves every observed derivative unmeasured while catalog remains measured", async () => {
  const deps = dependencies({ coverages: verifiedCoverage.map((item) => ({ ...item, proof: { kind: "unverified" } })) });
  const result = await loadAdminDataBundleWithDependencies({ access, range: "today" }, deps.value);
  const records = Object.values(result.bundle.records);
  for (const metricId of ["observed-menu-opens", "observed-dish-opens", "observed-immersive-intents", "observed-ar-intents", "observed-sessions", "dish-ranking", "category-ranking", "activity-series", "time-distribution", "private-search-ranking"]) {
    assert.deepEqual(records.find((item) => item.metricId === metricId && item.period === "current").state, { kind: "unmeasured", reason: "instrumentation-unverified" });
  }
  assert.equal(records.find((item) => item.metricId === "catalog-dishes").state.kind, "available");
});

test("truncated event reads fail every observed derivative closed without partial aggregates", async () => {
  const deps = dependencies({ coverages: verifiedCoverage, readEvents: async () => ({ ok: true, events: [{ eventName: "menu_opened", sessionId: "private" }], truncated: true, observedRows: 10_001, rowLimit: 10_000 }) });
  const result = await loadAdminDataBundleWithDependencies({ access, range: "7d" }, deps.value);
  for (const record of Object.values(result.bundle.records).filter((item) => item.period !== "snapshot")) {
    assert.deepEqual(record.state, { kind: "truncated", observedRows: 10_001, rowLimit: 10_000 });
  }
});

test("metric definitions bind every measured derivative to its real source signal", () => {
  assert.equal(getAdminMetricDefinition("observed-sessions").signal, "menu_opened");
  for (const metricId of ["dish-ranking", "category-ranking"]) assert.equal(getAdminMetricDefinition(metricId).signal, "dish_opened");
  assert.equal(getAdminMetricDefinition("activity-series").signal, "menu_opened");
  assert.equal(getAdminMetricDefinition("time-distribution").signal, "dish_opened");
  assert.equal(getAdminMetricDefinition("private-search-ranking").minimumSample, 3);
});

test("loader derives restaurant, menu, source and timezone server-side with one clock", async () => {
  const deps = dependencies();
  const result = await loadAdminDataBundleWithDependencies({ access, range: "today" }, deps.value);
  assert.equal(result.ok, true);
  assert.deepEqual(result.presentation, { restaurantId: "r1", restaurantName: "Maison Élyse", publicMenuPath: "/menu/maison-elyse" });
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
