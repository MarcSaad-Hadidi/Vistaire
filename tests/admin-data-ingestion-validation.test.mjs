import assert from "node:assert/strict";
import test from "node:test";

import { isAnalyticsRequestSameOrigin, validateAnalyticsContext, validateAnalyticsEvent } from "../lib/analytics/validationCore.mjs";

const base = {
  eventName: "dish_opened", restaurantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  menuId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", sessionId: "session", source: "production",
  dishSlug: "rossini", metadata: { instrumentationVersion: "admin-vnext-observed-v1" }
};

test("production payloads require the canonical instrumentation version", () => {
  assert.equal(validateAnalyticsEvent({ ...base, metadata: {} }).ok, false);
  assert.equal(validateAnalyticsEvent(base).ok, true);
  assert.equal(validateAnalyticsEvent({ ...base, metadata: { instrumentationVersion: "caller-version" } }).ok, false);
});

test("context validation enforces dish and category membership in the same menu", async () => {
  const lookup = {
    restaurantExists: async () => true,
    menuBelongsToRestaurant: async () => true,
    dishBelongsToMenu: async (slug) => slug === "rossini",
    categoryBelongsToMenu: async (slug) => slug === "plats"
  };
  assert.equal(await validateAnalyticsContext(base, lookup), true);
  assert.equal(await validateAnalyticsContext({ ...base, dishSlug: "foreign" }, lookup), false);
  assert.equal(await validateAnalyticsContext({ ...base, eventName: "category_viewed", dishSlug: undefined, categorySlug: "foreign" }, lookup), false);
});

test("same-origin guard rejects cross-site signals before ingestion", () => {
  const expectedOrigin = "https://vistaire.example";
  assert.equal(isAnalyticsRequestSameOrigin({ secFetchSite: "cross-site", origin: null, expectedOrigin }), false);
  assert.equal(isAnalyticsRequestSameOrigin({ secFetchSite: "same-origin", origin: "https://evil.example", expectedOrigin }), false);
  assert.equal(isAnalyticsRequestSameOrigin({ secFetchSite: null, origin: null, expectedOrigin }), true);
  assert.equal(isAnalyticsRequestSameOrigin({ secFetchSite: "same-origin", origin: expectedOrigin, expectedOrigin }), true);
});
