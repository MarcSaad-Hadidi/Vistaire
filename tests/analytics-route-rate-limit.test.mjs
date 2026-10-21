import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { validateAnalyticsEvent } from "../lib/analytics/validationCore.mjs";

const restaurant = "11111111-1111-1111-1111-111111111111";
const otherRestaurant = "22222222-2222-2222-2222-222222222222";
const invalidRestaurant = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const menu = "33333333-3333-3333-3333-333333333333";
const sessionId = (index) => `44444444-4444-4444-8444-${String(index).padStart(12, "0")}`;

function routeHarness() {
  let now = 0;
  let scanned = 0;
  const maps = [];
  class ObservedMap extends Map {
    constructor(...args) {
      super(...args);
      maps.push(this);
    }
    *[Symbol.iterator]() {
      for (const entry of super[Symbol.iterator]()) {
        scanned++;
        yield entry;
      }
    }
  }
  const route = { exports: {} };
  const dependencies = {
    "next/server": {
      NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) }
    },
    "@/lib/admin/requestBody": {
      readBoundedJsonBody: async (request) => ({ ok: true, value: request.payload })
    },
    "@/lib/analytics/context": {
      validateAnalyticsEventContext: async (payload) => payload.restaurantId === invalidRestaurant
        ? { ok: false, status: 400, error: "Invalid context" }
        : { ok: true }
    },
    "@/lib/analytics/eventStore": {
      insertAnalyticsEvent: async () => ({ ok: true, persisted: true })
    },
    "@/lib/analytics/validation": {
      validateAnalyticsEvent,
      isConfiguredDemoAnalyticsPayload: () => false
    }
  };
  const source = readFileSync(new URL("../app/api/analytics/events/route.ts", import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, {
    module: route,
    exports: route.exports,
    Map: ObservedMap,
    Date: { now: () => now },
    process: { env: {} },
    require: (name) => {
      assert.ok(dependencies[name], `Unexpected dependency ${name}`);
      return dependencies[name];
    }
  });
  return {
    post: (session, restaurantId = restaurant) => route.exports.POST({
      headers: new Headers({ "content-type": "application/json" }),
      payload: {
        eventName: "menu_opened",
        restaurantId,
        menuId: menu,
        source: "production",
        sessionId: session
      }
    }),
    advance: (milliseconds) => { now += milliseconds; },
    entries: () => maps.reduce((sum, map) => sum + map.size, 0),
    scanned: () => scanned
  };
}

test("invalid relational contexts never consume rate capacity or another tenant session budget", async () => {
  const route = routeHarness();
  const session = sessionId(1);
  for (let i = 0; i < 125; i++) {
    assert.equal((await route.post(session, invalidRestaurant)).status, 400);
  }
  assert.equal(route.entries(), 0);
  for (let i = 0; i < 120; i++) {
    assert.equal((await route.post(session)).status, 200);
  }
  assert.equal((await route.post(session)).status, 429);
  assert.equal((await route.post(session, otherRestaurant)).status, 200);
});

test("capacity pressure admits new valid sessions with bounded memory and no full-map scans", async () => {
  const route = routeHarness();
  for (let i = 0; i < 5100; i++) {
    assert.equal((await route.post(sessionId(i))).status, 200, `valid session ${i}`);
  }
  assert.ok(route.entries() <= 5000);
  assert.ok(route.scanned() <= 5100, "request work must not scan the whole rate map");
  const recent = sessionId(5099);
  for (let i = 1; i < 120; i++) {
    assert.equal((await route.post(recent)).status, 200);
  }
  assert.equal((await route.post(recent)).status, 429);
  route.advance(60000);
  assert.equal((await route.post(recent)).status, 200);
  assert.ok(route.entries() <= 5000);
});
