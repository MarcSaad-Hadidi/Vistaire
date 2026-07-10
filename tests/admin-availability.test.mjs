import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const loadAvailability = () => import("../lib/admin/availability.ts");
const loadRequestBody = () => import("../lib/admin/requestBody.ts");

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
    "app/admin/api/dishes/[dishId]/availability/route.ts",
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

test("post-commit revalidation failures are logged and never replace RPC success", async () => {
  const { preserveAvailabilityResultAfterRevalidation } = await loadAvailability();
  const logged = [];
  const committed = { ok: true, dishId: "dish", dishSlug: "plat", available: false };
  const result = await preserveAvailabilityResultAfterRevalidation(
    committed,
    async () => { throw new Error("cache unavailable"); },
    (message) => logged.push(message)
  );
  assert.equal(result, committed);
  assert.deepEqual(logged, ["Admin availability revalidation failed after commit."]);
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
  const route = await readFile(
    "app/admin/api/dishes/[dishId]/availability/route.ts",
    "utf8"
  );
  const control = await readFile("components/admin/AdminDishAvailabilityControl.tsx", "utf8");

  assert.match(route, /revalidatePath\(["']\/admin["']\)/);
  assert.match(route, /revalidateOwnerMenuMutationPaths/);
  assert.match(route, /preserveAvailabilityResultAfterRevalidation/);
  assert.match(revalidation, /`\/menu\/\$\{restaurantSlug\}`/);
  assert.match(revalidation, /`\/menu\/\$\{restaurantSlug\}\/dishes\/\$\{dishSlug\}`/);
  assert.match(control, /router\.refresh\(\)/);
  assert.match(control, /Rendre \$\{dishName\} indisponible/);
  assert.match(control, /Rendre \$\{dishName\} disponible/);
  assert.match(control, /JSON\.stringify\(\{ available: nextAvailable \}\)/);
  assert.match(control, /requestSequence/);
  assert.match(control, /latestRequest/);
  assert.match(control, /setAvailable\(nextAvailable\)[\s\S]*?fetch\(/);
  assert.match(control, /setAvailable\(previousAvailable\)/);
  assert.match(control, /aria-live=["']assertive["']/);
  assert.doesNotMatch(control, /restaurantId/);
});
