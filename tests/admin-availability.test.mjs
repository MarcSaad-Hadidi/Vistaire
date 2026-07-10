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
      qrId: "qr-a",
      restaurantId: "restaurant-a",
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
      "http://localhost/admin/api/dishes/dish-a/availability?restaurantId=restaurant-b",
      {
        method: "PATCH",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: JSON.stringify({ available: false })
      }
    ),
    Promise.resolve({ dishId: "dish-a" }),
    dependencies
  );
  assert.equal(queryAttack.status, 200);
  assert.equal(queryAttack.headers.get("cache-control"), "no-store");
  assert.deepEqual(updateCalls, [
    {
      restaurantId: "restaurant-a",
      dishId: "dish-a",
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

test("availability route derives scope from admin access and updates only availability metadata", async () => {
  const route = await readFile(
    "app/admin/api/dishes/[dishId]/availability/route.ts",
    "utf8"
  );
  const core = await readFile("lib/admin/availability.ts", "utf8");
  const contract = `${route}\n${core}`;

  assert.match(route, /requireAdminRestaurantAccess\("dish:availability:write"\)/);
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
  const updatePayload = route.match(/\.update\(\{([\s\S]*?)\}\)/)?.[1] ?? "";
  assert.match(updatePayload, /is_available\s*:\s*available/);
  assert.match(updatePayload, /updated_at\s*:/);
  assert.doesNotMatch(updatePayload, /restaurant|name|slug|price|metadata/i);
  const idScope = route.indexOf('.eq("id", dishId)');
  const restaurantScope = route.indexOf(
    '.eq("restaurant_id", restaurantId)'
  );
  assert.ok(idScope >= 0);
  assert.ok(restaurantScope > idScope);
  assert.doesNotMatch(route, /set_admin_dish_availability|\.rpc\(/);
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
  assert.match(revalidation, /`\/menu\/\$\{restaurantSlug\}`/);
  assert.match(revalidation, /`\/menu\/\$\{restaurantSlug\}\/dishes\/\$\{dishSlug\}`/);
  assert.match(control, /router\.refresh\(\)/);
  assert.match(control, /Rendre \$\{dishName\} indisponible/);
  assert.match(control, /Rendre \$\{dishName\} disponible/);
  assert.match(control, /JSON\.stringify\(\{ available: nextAvailable \}\)/);
  assert.doesNotMatch(control, /restaurantId/);
});
