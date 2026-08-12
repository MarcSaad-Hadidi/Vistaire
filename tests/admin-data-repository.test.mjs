import assert from "node:assert/strict";
import test from "node:test";

import { createProductionAdminRepositoryCore } from "../lib/admin/data/repositoryCore.ts";

const scope = { restaurantId: "r1", menuId: "m1", source: "production", timezone: "UTC" };

test("repository emits allowlisted, fully-scoped and deterministically ordered event reads", async () => {
  const requests = [];
  const repository = createProductionAdminRepositoryCore(async (request) => {
    requests.push(request);
    return { rows: [] };
  });
  await repository.readEvents({ scope, window: { from: "2026-01-01T00:00:00.000Z", to: "2026-01-02T00:00:00.000Z" }, maxRows: 100 });
  assert.deepEqual(requests[0], {
    table: "analytics_events",
    columns: "id,restaurant_id,menu_id,session_id,event_name,source,dish_slug,category_slug,search_query,created_at,metadata",
    equals: { restaurant_id: "r1", menu_id: "m1", source: "production" },
    range: { column: "created_at", from: "2026-01-01T00:00:00.000Z", to: "2026-01-02T00:00:00.000Z" },
    order: [{ column: "created_at", ascending: true }, { column: "id", ascending: true }],
    limit: 101
  });
});

test("maxRows+1 proves truncation and strips metadata outside the allowlist", async () => {
  const rows = [0, 1, 2].map((index) => ({
    id: `e${index}`, restaurant_id: "r1", menu_id: "m1", source: "production",
    session_id: `secret-${index}`, event_name: "dish_opened", dish_slug: "rossini",
    created_at: `2026-01-01T0${index}:00:00.000Z`, metadata: { instrumentationVersion: "v1", secret: "no" }
  }));
  const repository = createProductionAdminRepositoryCore(async () => ({ rows }));
  const result = await repository.readEvents({ scope, window: { from: "2026-01-01T00:00:00.000Z", to: "2026-01-02T00:00:00.000Z" }, maxRows: 2 });
  assert.equal(result.ok, true);
  assert.equal(result.truncated, true);
  assert.equal(result.observedRows, 3);
  assert.equal(result.events.length, 2);
  assert.equal(result.events[0].sessionId, "secret-0");
  assert.equal(Object.hasOwn(result.events[0], "session_id"), false);
  assert.deepEqual(result.events[0].metadata, { instrumentationVersion: "v1" });
});

test("cross-scope rows fail closed with a neutral error", async () => {
  const repository = createProductionAdminRepositoryCore(async () => ({ rows: [{
    id: "e1", restaurant_id: "other", menu_id: "m1", source: "production", event_name: "menu_opened",
    created_at: "2026-01-01T01:00:00.000Z"
  }] }));
  assert.deepEqual(
    await repository.readEvents({ scope, window: { from: "2026-01-01T00:00:00.000Z", to: "2026-01-02T00:00:00.000Z" }, maxRows: 2 }),
    { ok: false, code: "scope-integrity", retryable: false }
  );
});

test("menu selection is published-primary and deterministic", async () => {
  const repository = createProductionAdminRepositoryCore(async () => ({ rows: [
    { id: "draft", restaurant_id: "r1", slug: "draft", status: "draft", is_primary: true, settings_json: {}, updated_at: "2026-02-01T00:00:00Z" },
    { id: "published", restaurant_id: "r1", slug: "live", status: "published", is_primary: true, settings_json: {}, updated_at: "2026-01-01T00:00:00Z" }
  ] }));
  assert.equal((await repository.readMenu({ restaurantId: "r1" })).menu.id, "published");
});
