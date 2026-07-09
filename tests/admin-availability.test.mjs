import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { parseAvailabilityInput } from "../lib/admin/availability.ts";

test("availability input accepts exactly one boolean final-state field", () => {
  assert.deepEqual(parseAvailabilityInput({ available: false }), {
    ok: true,
    available: false
  });
  assert.deepEqual(parseAvailabilityInput({ available: true }), {
    ok: true,
    available: true
  });
  assert.equal(parseAvailabilityInput({ available: "false" }).ok, false);
  assert.equal(
    parseAvailabilityInput({ available: true, restaurantId: "rest-2" }).ok,
    false
  );
  assert.equal(parseAvailabilityInput(null).ok, false);
  assert.equal(parseAvailabilityInput([]).ok, false);
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
