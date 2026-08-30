import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadMenuMutationRevalidation } from "./helpers/public-dish-asset-route-runtime.mjs";

const loadAvailability = () => import("../lib/admin/availability.ts");
const loadRequestBody = () => import("../lib/admin/requestBody.ts");
const loadMutation = () => import("../components/admin/availability/availabilityMutation.ts");
const loadMenuRevalidation = () => loadMenuMutationRevalidation();

function createRestaurantLookup({ data = null, error = null, thrown = null } = {}) {
  const query = {
    select() { return this; },
    eq() { return this; },
    async maybeSingle() {
      if (thrown) throw thrown;
      return { data, error };
    }
  };
  return { from: () => query };
}

test("bounded JSON reader rejects declared and chunked oversized bodies", async () => {
  const { readBoundedJsonBody } = await loadRequestBody();
  const declared = new Request("http://localhost/admin/api/test", {
    method: "POST",
    headers: { "content-length": "2048" },
    body: "{}"
  });
  assert.deepEqual(await readBoundedJsonBody(declared, 1024), {
    ok: false,
    reason: "too-large"
  });

  const encoder = new TextEncoder();
  const chunks = [encoder.encode("{"), new Uint8Array(700), new Uint8Array(700)];
  const chunked = new Request("http://localhost/admin/api/test", {
    method: "POST",
    body: new ReadableStream({
      pull(controller) {
        const chunk = chunks.shift();
        if (chunk) controller.enqueue(chunk);
        else controller.close();
      }
    }),
    duplex: "half"
  });
  assert.deepEqual(await readBoundedJsonBody(chunked, 1024), {
    ok: false,
    reason: "too-large"
  });
});

test("bounded JSON reader parses a valid body within the byte budget", async () => {
  const { readBoundedJsonBody } = await loadRequestBody();
  const request = new Request("http://localhost/admin/api/test", {
    method: "POST",
    body: JSON.stringify({ available: true })
  });
  assert.deepEqual(await readBoundedJsonBody(request, 1024), {
    ok: true,
    value: { available: true }
  });
});

test("availability input accepts exactly one boolean final-state field", async () => {
  const { parseAvailabilityInput } = await loadAvailability();
  assert.deepEqual(parseAvailabilityInput({ available: false }), {
    ok: true,
    available: false
  });
  assert.deepEqual(parseAvailabilityInput({ available: true }), {
    ok: true,
    available: true
  });
  assert.equal(parseAvailabilityInput({ available: "false" }).ok, false);
  assert.equal(parseAvailabilityInput({ available: true, arbitrary: "value" }).ok, false);
  assert.equal(
    parseAvailabilityInput({ available: true, restaurantId: "rest-2" }).ok,
    false
  );
  assert.equal(parseAvailabilityInput(null).ok, false);
  assert.equal(parseAvailabilityInput([]).ok, false);
});

test("availability request handler uses only session scope and cannot target query or body restaurant ids", async () => {
  const { handleAdminAvailabilityRequest } = await loadAvailability();
  const updateCalls = [];
  const dependencies = {
    requireAccess: async () => ({
      ok: true,
      sessionKind: "qr",
      assurance: "live-admin-qr",
      qrId: "11111111-1111-4111-8111-111111111111",
      restaurantId: "22222222-2222-4222-8222-222222222222",
      expiresAt: new Date("2026-07-09T20:00:00.000Z")
    }),
    updateAvailability: async (input) => {
      updateCalls.push(input);
      return {
        ok: true,
        dishId: input.dishId,
        dishSlug: "plat-a",
        available: input.available
      };
    }
  };

  const queryAttack = await handleAdminAvailabilityRequest(
    new Request(
      "http://localhost/admin/api/dishes/33333333-3333-4333-8333-333333333333/availability?restaurantId=restaurant-b",
      {
        method: "PATCH",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: JSON.stringify({ available: false })
      }
    ),
    Promise.resolve({ dishId: "33333333-3333-4333-8333-333333333333" }),
    dependencies
  );
  assert.equal(queryAttack.status, 200);
  assert.equal(queryAttack.headers.get("cache-control"), "no-store");
  assert.deepEqual(updateCalls, [
    {
      qrId: "11111111-1111-4111-8111-111111111111",
      restaurantId: "22222222-2222-4222-8222-222222222222",
      dishId: "33333333-3333-4333-8333-333333333333",
      available: false
    }
  ]);

  const bodyAttack = await handleAdminAvailabilityRequest(
    new Request("http://localhost/admin/api/dishes/dish-b/availability", {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ available: true, restaurantId: "restaurant-b" })
    }),
    Promise.resolve({ dishId: "dish-b" }),
    dependencies
  );
  assert.equal(bodyAttack.status, 400);
  assert.equal(updateCalls.length, 1);
  assert.equal(JSON.stringify(updateCalls).includes("restaurant-b"), false);
});

test("availability route invokes the atomic RPC with access-derived QR and restaurant scope", async () => {
  const route = await readFile(
    "app/(fr)/admin/api/dishes/[dishId]/availability/route.ts",
    "utf8"
  );
  const core = await readFile("lib/admin/availability.ts", "utf8");
  const contract = `${route}\n${core}`;

  assert.match(route, /requireAdminRestaurantAccess\("dish:availability:write"\)/);
  assert.match(core, /qrId:\s*access\.qrId/);
  assert.match(core, /restaurantId:\s*access\.restaurantId/);
  assert.match(route, /dishId/);
  assert.match(contract, /application\/json/);
  assert.match(contract, /1_?024|1024/);
  assert.match(contract, /Sec-Fetch-Site/i);
  assert.match(contract, /Origin/);
  assert.match(contract, /readBoundedJsonBody/);
  assert.doesNotMatch(contract, /request\.text\(\)/);
  assert.match(contract, /cache-control["']?\s*:\s*["']no-store["']/i);
  assert.doesNotMatch(route, /body\.restaurantId|input\.restaurantId/);
  assert.match(route, /\.rpc\("set_admin_dish_availability",\s*\{/);
  assert.match(route, /p_qr_id:\s*qrId/);
  assert.match(route, /p_restaurant_id:\s*restaurantId/);
  assert.match(route, /p_dish_id:\s*dishId/);
  assert.match(route, /p_available:\s*available/);
  assert.doesNotMatch(route, /\.from\("menu_dishes"\)\s*\.update/);
  assert.doesNotMatch(route, /selectAdminDashboardMenu/);
});

test("availability media type accepts JSON parameters but rejects JSON lookalikes", async () => {
  const { handleAdminAvailabilityRequest } = await loadAvailability();
  const dependencies = {
    requireAccess: async () => ({ ok: false }),
    updateAvailability: async () => ({ ok: false, status: 503 })
  };
  for (const contentType of ["application/json", "application/json; charset=utf-8", "Application/JSON ; Charset=UTF-8"]) {
    const response = await handleAdminAvailabilityRequest(
      new Request("http://localhost/admin/api/dishes/33333333-3333-4333-8333-333333333333/availability", {
        method: "PATCH",
        headers: { "content-type": contentType, origin: "http://localhost" },
        body: "{}"
      }),
      Promise.resolve({ dishId: "33333333-3333-4333-8333-333333333333" }),
      dependencies
    );
    assert.equal(response.status, 401, contentType);
  }
  for (const contentType of ["application/jsonp", "application/json-evil", "text/application/json"]) {
    const response = await handleAdminAvailabilityRequest(
      new Request("http://localhost/admin/api/dishes/33333333-3333-4333-8333-333333333333/availability", {
        method: "PATCH",
        headers: { "content-type": contentType, origin: "http://localhost" },
        body: "{}"
      }),
      Promise.resolve({ dishId: "33333333-3333-4333-8333-333333333333" }),
      dependencies
    );
    assert.equal(response.status, 415, contentType);
  }
});

test("post-commit revalidation failures return an explicit retry signal without replacing RPC success", async () => {
  const { preserveAvailabilityResultAfterRevalidation } = await loadAvailability();
  const signals = [];
  const committed = { ok: true, dishId: "dish", dishSlug: "plat", available: false };
  const retrySignal = {
    kind: "menu-revalidation-retry-required",
    restaurantId: "restaurant",
    dishId: "dish",
    token: "must-not-escape",
    nested: { secret: "must-not-escape" }
  };
  const result = await preserveAvailabilityResultAfterRevalidation(
    committed,
    async () => { throw new Error("cache unavailable"); },
    {
      retrySignal,
      signalRetry: (signal) => signals.push(signal)
    }
  );
  assert.deepEqual(result, { ...committed, revalidation: "retry-required" });
  assert.deepEqual(signals, [{
    kind: "menu-revalidation-retry-required",
    restaurantId: "restaurant",
    dishId: "dish"
  }]);
  assert.doesNotMatch(JSON.stringify(signals), /must-not-escape|secret|token/i);
});

test("a retry sink exception never turns committed availability into a rejection", async () => {
  const { preserveAvailabilityResultAfterRevalidation } = await loadAvailability();
  const committed = { ok: true, dishId: "dish", dishSlug: "plat", available: false };
  const result = await preserveAvailabilityResultAfterRevalidation(
    committed,
    async () => ({ ok: false }),
    {
      retrySignal: {
        kind: "menu-revalidation-retry-required",
        restaurantId: "restaurant",
        dishId: "dish"
      },
      signalRetry: () => { throw new Error("observability unavailable"); }
    }
  );
  assert.deepEqual(result, { ...committed, revalidation: "retry-required" });
});

test("production fallback emits one structured allowlisted retry log", async () => {
  const { revalidateOwnerMenuMutationPaths } = await loadMenuRevalidation();
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (message) => logs.push(message);
  try {
    const result = await revalidateOwnerMenuMutationPaths(
      {
        client: createRestaurantLookup({ error: { message: "contains-secret-token" } }),
        restaurantId: "restaurant-a",
        dishId: "dish-a"
      },
      {
        revalidateMenuCache: async () => ({
          ok: true,
          invalidatedTags: ["restaurant"],
          failedTags: []
        }),
        invalidateAssetMetadata: () => 1,
        revalidatePath: () => {}
      }
    );

    assert.equal(result.retryRequired, true);
    assert.equal(logs.length, 1);
    assert.deepEqual(JSON.parse(logs[0]), {
      kind: "menu-revalidation-retry-required",
      restaurantId: "restaurant-a",
      dishId: "dish-a"
    });
    assert.doesNotMatch(logs[0], /contains-secret-token|token=/i);
  } finally {
    console.error = originalConsoleError;
  }
});

test("owner retry sink exceptions are contained after a committed mutation", async () => {
  const { revalidateOwnerMenuMutationPaths } = await loadMenuRevalidation();
  const result = await revalidateOwnerMenuMutationPaths(
    {
      client: createRestaurantLookup({ error: { message: "lookup failed" } }),
      restaurantId: "restaurant-a",
      dishId: "dish-a"
    },
    {
      revalidateMenuCache: async () => ({
        ok: true,
        invalidatedTags: ["restaurant"],
        failedTags: []
      }),
      invalidateAssetMetadata: () => 1,
      revalidatePath: () => {},
      signalRetry: () => { throw new Error("observability unavailable"); }
    }
  );
  assert.equal(result.retryRequired, true);
  assert.deepEqual(result.failures, ["restaurant-lookup"]);
});

test("asynchronous owner retry sink rejections are contained after commit", async () => {
  const { revalidateOwnerMenuMutationPaths } = await loadMenuRevalidation();
  const result = await revalidateOwnerMenuMutationPaths(
    {
      client: createRestaurantLookup({ error: { message: "lookup failed" } }),
      restaurantId: "restaurant-a",
      dishId: "dish-a"
    },
    {
      revalidateMenuCache: async () => ({
        ok: true,
        invalidatedTags: ["restaurant"],
        failedTags: []
      }),
      invalidateAssetMetadata: () => 1,
      revalidatePath: () => {},
      signalRetry: async () => { throw new Error("async observability unavailable"); }
    }
  );
  assert.equal(result.retryRequired, true);
  assert.deepEqual(result.failures, ["restaurant-lookup"]);
});

test("owner mutation awaits an explicit retry sink before returning", async () => {
  const { revalidateOwnerMenuMutationPaths } = await loadMenuRevalidation();
  let releaseSink;
  const sinkGate = new Promise((resolve) => { releaseSink = resolve; });
  const signals = [];
  let settled = false;
  const pending = revalidateOwnerMenuMutationPaths(
    {
      client: createRestaurantLookup({ error: { message: "lookup failed" } }),
      restaurantId: "restaurant-a",
      dishId: "dish-a"
    },
    {
      revalidateMenuCache: async () => ({
        ok: true,
        invalidatedTags: ["restaurant"],
        failedTags: []
      }),
      invalidateAssetMetadata: () => 1,
      revalidatePath: () => {},
      signalRetry: async (signal) => {
        await sinkGate;
        signals.push(signal);
      }
    }
  ).then((result) => {
    settled = true;
    return result;
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false, "post-commit result must wait until the sink settles");
  releaseSink();
  const result = await pending;
  assert.equal(result.retryRequired, true);
  assert.deepEqual(signals, [{
    kind: "menu-revalidation-retry-required",
    restaurantId: "restaurant-a",
    dishId: "dish-a"
  }]);
});

test("owner mutation invalidates restaurant cache and dish asset metadata even when slug lookup fails", async () => {
  const { revalidateOwnerMenuMutationPaths } = await loadMenuRevalidation();
  const menuInvalidations = [];
  const assetInvalidations = [];
  const paths = [];
  const retrySignals = [];
  const result = await revalidateOwnerMenuMutationPaths(
    {
      client: createRestaurantLookup({ error: { message: "lookup unavailable" } }),
      restaurantId: "restaurant-a",
      dishId: "dish-a",
      dishSlug: "plat-a"
    },
    {
      revalidateMenuCache: async (scope) => {
        menuInvalidations.push(scope);
        return { ok: true, invalidatedTags: ["restaurant"], failedTags: [] };
      },
      invalidateAssetMetadata: (scope) => {
        assetInvalidations.push(scope);
        return 1;
      },
      revalidatePath: (path) => paths.push(path),
      signalRetry: (signal) => retrySignals.push(signal)
    }
  );

  assert.deepEqual(menuInvalidations, [{ restaurantId: "restaurant-a" }]);
  assert.deepEqual(assetInvalidations, [{ restaurantId: "restaurant-a", dishId: "dish-a" }]);
  assert.deepEqual(paths, []);
  assert.deepEqual(retrySignals, [{
    kind: "menu-revalidation-retry-required",
    restaurantId: "restaurant-a",
    dishId: "dish-a"
  }]);
  assert.deepEqual(result, {
    ok: false,
    retryRequired: true,
    restaurantSlug: null,
    invalidatedAssetMetadataEntries: 1,
    invalidatedPaths: [],
    failures: ["restaurant-lookup"]
  });
});

test("owner mutation performs observable restaurant and exact slug invalidation before path refresh", async () => {
  const { revalidateOwnerMenuMutationPaths } = await loadMenuRevalidation();
  const events = [];
  const result = await revalidateOwnerMenuMutationPaths(
    {
      client: createRestaurantLookup({ data: { slug: "Bistro A", name: "Ignored" } }),
      restaurantId: "restaurant-a",
      dishId: "dish-a",
      dishSlug: "Plat Signature"
    },
    {
      revalidateMenuCache: async (scope) => {
        events.push(["cache", scope]);
        return { ok: true, invalidatedTags: ["tag"], failedTags: [] };
      },
      invalidateAssetMetadata: (scope) => {
        events.push(["asset", scope]);
        return 2;
      },
      revalidatePath: (path) => events.push(["path", path])
    }
  );

  assert.deepEqual(events, [
    ["asset", { restaurantId: "restaurant-a", dishId: "dish-a" }],
    ["cache", { restaurantId: "restaurant-a" }],
    ["cache", { slug: "bistro-a", restaurantId: "restaurant-a" }],
    ["path", "/menu/bistro-a"],
    ["path", "/menu/bistro-a/dishes/plat-signature"]
  ]);
  assert.deepEqual(result, {
    ok: true,
    retryRequired: false,
    restaurantSlug: "bistro-a",
    invalidatedAssetMetadataEntries: 2,
    invalidatedPaths: [
      "/menu/bistro-a",
      "/menu/bistro-a/dishes/plat-signature"
    ],
    failures: []
  });
});

test("missing availability RPC fails closed as a controlled 503 without fallback", async () => {
  const { handleAdminAvailabilityRequest } = await loadAvailability();
  const response = await handleAdminAvailabilityRequest(
    new Request("http://localhost/admin/api/dishes/33333333-3333-4333-8333-333333333333/availability", {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ available: false })
    }),
    Promise.resolve({ dishId: "33333333-3333-4333-8333-333333333333" }),
    {
      requireAccess: async () => ({
        ok: true,
        sessionKind: "qr",
        assurance: "live-admin-qr",
        qrId: "11111111-1111-4111-8111-111111111111",
        restaurantId: "22222222-2222-4222-8222-222222222222",
        expiresAt: 1,
        capabilities: ["dashboard:read", "dish:availability:write"]
      }),
      updateAvailability: async () => ({ ok: false, status: 503 })
    }
  );
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("successful availability changes revalidate admin and public menu paths", async () => {
  const revalidation = await readFile("lib/owner/menuMutationRevalidation.ts", "utf8");
  const route = await readFile("app/(fr)/admin/api/dishes/[dishId]/availability/route.ts", "utf8");
  const control = await readFile("components/admin/AdminDishAvailabilityControl.tsx", "utf8");
  const mutation = await readFile("components/admin/availability/availabilityMutation.ts", "utf8");
  const list = await readFile("components/admin/availability/AdminAvailabilityList.tsx", "utf8");
  const clientContract = `${control}\n${mutation}\n${list}`;
  assert.match(route, /revalidatePath\(["']\/admin["']\)/);
  assert.match(route, /resolvePublicMutationIdentity/);
  assert.match(route, /invalidateCommittedPublicMutation/);
  assert.match(route, /preserveAvailabilityResultAfterRevalidation/);
  assert.match(revalidation, /`\/menu\/\$\{restaurantSlug\}`/);
  assert.match(revalidation, /`\/menu\/\$\{restaurantSlug\}\/dishes\/\$\{dishSlug\}`/);
  assert.match(clientContract, /router\.refresh\(\)/);
  assert.match(control, /Rendre \$\{dishName\} indisponible/);
  assert.match(control, /Rendre \$\{dishName\} disponible/);
  assert.match(clientContract, /JSON\.stringify\(\{ available: nextAvailable \}\)/);
  assert.match(clientContract, /sequence/);
  assert.match(clientContract, /requestId/);
  assert.match(clientContract, /setAvailable\(nextAvailable\)[\s\S]*?fetcher/);
  assert.match(clientContract, /setAvailable\(input\.available\)/);
  assert.match(clientContract, /AdminToast/);
  assert.doesNotMatch(clientContract, /restaurantId/);
});

test("focused availability page exposes only search and final-state filters", async () => {
  const page = await readFile("components/admin/availability/AdminAvailabilityPage.tsx", "utf8");
  const list = await readFile("components/admin/availability/AdminAvailabilityList.tsx", "utf8");
  const contract = `${page}\n${list}`;

  assert.match(contract, /Rechercher un plat/);
  assert.match(contract, /Tous/);
  assert.match(contract, /Disponibles/);
  assert.match(contract, /Indisponibles/);
  assert.doesNotMatch(contract, /Prix manquant|Description manquante|Photo manquante|3D\/AR/);
  assert.doesNotMatch(contract, /Modifier|Exporter|readiness|Prêt/);
});

test("availability route preserves server scope and shared restaurant shell", async () => {
  const route = await readFile("app/(fr)/admin/availability/page.tsx", "utf8");
  const page = await readFile("components/admin/availability/AdminAvailabilityPage.tsx", "utf8");

  assert.match(route, /requireAdminRestaurantAccess\("dashboard:read"\)/);
  assert.match(route, /loadAdminDashboardData\(access\.restaurantId/);
  assert.match(page, /AdminShell/);
  assert.match(page, /active="availability"/);
  assert.doesNotMatch(`${route}\n${page}`, /restaurantId\s*[:=]\s*[{"']/);
});

test("availability list renders measured rows, imagery, status and toggle feedback", async () => {
  const list = await readFile("components/admin/availability/AdminAvailabilityList.tsx", "utf8");
  const thumbnail = await readFile("components/admin/AdminDishThumbnail.tsx", "utf8");
  const css = await readFile("components/admin/availability/AdminAvailability.module.css", "utf8");
  const control = await readFile("components/admin/AdminDishAvailabilityControl.tsx", "utf8");

  assert.match(list, /thumbnailUrl|imageUrl/);
  assert.match(list, /priority=\{index\s*===\s*0\}/);
  assert.match(thumbnail, /priority\?\s*:\s*boolean/);
  assert.match(list, /AdminStatusBadge/);
  assert.match(control, /AdminToggle/);
  assert.match(list, /AdminToast/);
  assert.match(css, /grid-template-columns:\s*22px 54px minmax\(115px,1fr\)/);
  assert.match(css, /min-height:\s*66px/);
  assert.match(css, /\.row\s+:global\(\[data-admin-dish-thumbnail\]\)[^}]*height:\s*48px/s);
  assert.doesNotMatch(css, /margin-top:\s*-/);
  assert.match(list, /SearchIcon/);
  assert.match(list, /MenuOpenIcon/);
  assert.match(list, /filterCount/);
  assert.match(css, /@media \(max-width:\s*700px\)/);
  assert.match(css, /overflow-x:\s*clip/);
});

test("availability mutation is optimistic, sends no restaurant id, refreshes, and reports success", async () => {
  const { createAvailabilityMutation } = await loadMutation();
  const states = [];
  const feedback = [];
  let refreshed = 0;
  const mutation = createAvailabilityMutation({
    fetcher: async (_url, init) => {
      assert.deepEqual(JSON.parse(init.body), { available: false });
      assert.equal(init.body.includes("restaurantId"), false);
      return { ok: true, json: async () => ({ ok: true, available: false }) };
    },
    setAvailable: (value) => states.push(value),
    setFeedback: (value) => feedback.push(value),
    refresh: () => { refreshed += 1; }
  });
  assert.equal(await mutation.run({ dishId: "dish-1", dishName: "Turbot", available: true }), "success");
  assert.deepEqual(states, [false]);
  assert.equal(feedback.at(-1).message, "Turbot est indisponible.");
  assert.equal(refreshed, 1);
});

test("availability mutation rolls back errors and suppresses synchronous double activation", async () => {
  const { createAvailabilityMutation } = await loadMutation();
  let release;
  let calls = 0;
  const states = [];
  const feedback = [];
  const mutation = createAvailabilityMutation({
    fetcher: async () => { calls += 1; return new Promise((resolve) => { release = resolve; }); },
    setAvailable: (value) => states.push(value),
    setFeedback: (value) => feedback.push(value),
    refresh: () => assert.fail("failed mutations must not refresh")
  });
  const first = mutation.run({ dishId: "dish-1", dishName: "Turbot", available: true });
  assert.equal(await mutation.run({ dishId: "dish-1", dishName: "Turbot", available: true }), "ignored");
  assert.equal(calls, 1);
  release({ ok: false, json: async () => ({ ok: false, error: "Service indisponible" }) });
  assert.equal(await first, "error");
  assert.deepEqual(states, [false, true]);
  assert.deepEqual(feedback.at(-1), { tone: "error", message: "Service indisponible" });
});

test("stale availability responses cannot refresh or replace durable feedback", async () => {
  const { createAvailabilityMutation } = await loadMutation();
  let release;
  const feedback = [];
  let refreshed = 0;
  const mutation = createAvailabilityMutation({
    fetcher: async () => new Promise((resolve) => { release = resolve; }),
    setAvailable: () => {},
    setFeedback: (value) => feedback.push(value),
    refresh: () => { refreshed += 1; }
  });
  const pending = mutation.run({ dishId: "dish-1", dishName: "Turbot", available: true });
  mutation.invalidate();
  release({ ok: true, json: async () => ({ ok: true, available: false }) });
  assert.equal(await pending, "stale");
  assert.equal(refreshed, 0);
  assert.deepEqual(feedback, [{ tone: null, message: null }]);
});

test("availability overrides are discarded when a refreshed server payload becomes authoritative", async () => {
  const { resolveAvailabilityForSource } = await loadMutation();
  const firstPayload = [{ id: "dish-1", available: true }];
  const committedPayload = [{ id: "dish-1", available: false }];
  const concurrentPayload = [{ id: "dish-1", available: true }];
  const optimistic = { base: true, value: false };
  assert.equal(resolveAvailabilityForSource(true, firstPayload, firstPayload, optimistic), false);
  assert.equal(resolveAvailabilityForSource(false, committedPayload, firstPayload, optimistic), false);
  assert.equal(resolveAvailabilityForSource(true, concurrentPayload, firstPayload, optimistic), true);
});

test("availability control cleanup invalidates an in-flight response before side effects", async () => {
  const control = await readFile("components/admin/AdminDishAvailabilityControl.tsx", "utf8");
  assert.match(control, /useEffect\(\(\) => \(\) => mutation\.invalidate\(\), \[mutation\]\)/);

  const { createAvailabilityMutation } = await loadMutation();
  let release;
  const committed = [];
  const feedback = [];
  let refreshed = 0;
  const mutation = createAvailabilityMutation({
    fetcher: async () => new Promise((resolve) => { release = resolve; }),
    setAvailable: () => {},
    setFeedback: (value) => feedback.push(value),
    committed: (value) => committed.push(value),
    refresh: () => { refreshed += 1; }
  });
  const pending = mutation.run({ dishId: "dish-1", dishName: "Turbot", available: true });
  mutation.invalidate();
  release({ ok: true, json: async () => ({ ok: true, available: false }) });
  assert.equal(await pending, "stale");
  assert.deepEqual(committed, []);
  assert.deepEqual(feedback, [{ tone: null, message: null }]);
  assert.equal(refreshed, 0);
});
