import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const loadAvailability = () => import("../lib/admin/availability.ts");

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
  const rpcCalls = [];
  const dependencies = {
    requireAccess: async () => ({
      ok: true,
      qrId: "qr-a",
      restaurantId: "restaurant-a",
      expiresAt: new Date("2026-07-09T20:00:00.000Z")
    }),
    callAvailabilityRpc: async (input) => {
      rpcCalls.push(input);
      return { ok: true, dishId: input.dishId, available: input.available };
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
  assert.deepEqual(rpcCalls, [
    {
      qrId: "qr-a",
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
  assert.equal(rpcCalls.length, 1);
  assert.equal(JSON.stringify(rpcCalls).includes("restaurant-b"), false);
});

test("availability route derives scope from admin access and calls only the atomic RPC", async () => {
  const route = await readFile(
    "app/admin/api/dishes/[dishId]/availability/route.ts",
    "utf8"
  );

  assert.match(route, /requireAdminRestaurantAccess\("dish:availability:write"\)/);
  assert.match(route, /set_admin_dish_availability/);
  assert.match(route, /access\.qrId/);
  assert.match(route, /access\.restaurantId/);
  assert.match(route, /dishId/);
  assert.match(route, /application\/json/);
  assert.match(route, /1_?024|1024/);
  assert.match(route, /Sec-Fetch-Site/i);
  assert.match(route, /Origin/);
  assert.doesNotMatch(route, /body\.restaurantId|input\.restaurantId/);
  assert.doesNotMatch(route, /\.from\(["']menu_dishes["']\)\s*\.update/);
  const patchBody = route.match(
    /export async function PATCH\([\s\S]*?\n}/
  )?.[0] ?? "";
  assert.match(
    patchBody,
    /return\s+handleAdminAvailabilityRequest\(request,\s*params,\s*\{[\s\S]*requireAccess:[\s\S]*callAvailabilityRpc:[\s\S]*}\s*\);/
  );
});

test("availability SQL atomically scopes the one allowed dish field to an active admin QR", async () => {
  const migration = await readFile(
    "supabase/migrations/20260709181000_admin_dish_availability.sql",
    "utf8"
  );
  const updateStatement =
    migration.match(/update\s+public\.menu_dishes[\s\S]*?;/i)?.[0] ?? "";
  const setClause = updateStatement.match(/\bset\b([\s\S]*?)\bfrom\b/i)?.[1] ?? "";

  assert.match(updateStatement, /qr_codes/i);
  assert.match(updateStatement, /qr\.id\s*=\s*p_qr_id/i);
  assert.match(updateStatement, /qr\.restaurant_id\s*=\s*p_restaurant_id/i);
  assert.match(updateStatement, /qr\.status\s*=\s*'active'/i);
  assert.match(updateStatement, /qr\.target_kind\s*=\s*'admin'/i);
  assert.match(updateStatement, /dish\.restaurant_id\s*=\s*p_restaurant_id/i);
  assert.match(setClause, /^\s*(?:dish\.)?is_available\s*=\s*p_available\s*$/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /revoke execute[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute[\s\S]*to service_role/i);
});

test("successful availability changes revalidate admin and public menu paths", async () => {
  const revalidation = await readFile("lib/owner/menuMutationRevalidation.ts", "utf8");
  const control = await readFile("components/admin/AdminDishAvailabilityControl.tsx", "utf8");

  assert.match(revalidation, /revalidatePath\(["']\/admin["']\)/);
  assert.match(revalidation, /`\/menu\/\$\{restaurantSlug\}`/);
  assert.match(control, /router\.refresh\(\)/);
  assert.match(control, /Rendre \$\{dishName\} indisponible/);
  assert.match(control, /Rendre \$\{dishName\} disponible/);
});
