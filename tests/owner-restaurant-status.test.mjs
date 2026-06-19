import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  updateRestaurantStatusRecord,
  validateRestaurantStatusAction
} from "../lib/owner/restaurantStatus.ts";

function updateClient({ data = null, error = null, onUpdate = () => {}, onEq = () => {} } = {}) {
  return {
    from(table) {
      assert.equal(table, "restaurants");
      return {
        update(row) {
          onUpdate(row);
          return {
            eq(column, value) {
              onEq(column, value);
              return {
                select(columns) {
                  assert.equal(columns, "id,status");
                  return {
                    async single() {
                      return { data, error };
                    }
                  };
                }
              };
            }
          };
        }
      };
    }
  };
}

test("validates owner restaurant status actions", () => {
  assert.deepEqual(validateRestaurantStatusAction({ action: "archive" }), {
    ok: true,
    action: "archive",
    status: "archived"
  });
  assert.deepEqual(validateRestaurantStatusAction({ action: "restore" }), {
    ok: true,
    action: "restore",
    status: "setup_needed"
  });
  assert.deepEqual(validateRestaurantStatusAction({ action: "delete" }), {
    ok: false,
    error: "Action restaurant non supportee."
  });
});

test("archives a restaurant through the Supabase service role", async () => {
  let updatedRow;
  let eqCall;
  const result = await updateRestaurantStatusRecord("rest_123", "archive", {
    admin: {
      ok: true,
      client: updateClient({
        onUpdate(row) {
          updatedRow = row;
        },
        onEq(column, value) {
          eqCall = { column, value };
        },
        data: { id: "rest_123", status: "archived" }
      })
    }
  });

  assert.deepEqual(result, {
    ok: true,
    restaurantId: "rest_123",
    status: "archived"
  });
  assert.deepEqual(updatedRow, { status: "archived" });
  assert.deepEqual(eqCall, { column: "id", value: "rest_123" });
});

test("restores an archived restaurant to setup_needed", async () => {
  let updatedRow;
  const result = await updateRestaurantStatusRecord("rest_123", "restore", {
    admin: {
      ok: true,
      client: updateClient({
        onUpdate(row) {
          updatedRow = row;
        },
        data: { id: "rest_123", status: "setup_needed" }
      })
    }
  });

  assert.deepEqual(result, {
    ok: true,
    restaurantId: "rest_123",
    status: "setup_needed"
  });
  assert.deepEqual(updatedRow, { status: "setup_needed" });
});

test("restaurant archive route is owner-only and same-origin", async () => {
  const source = await readFile("app/api/restaurants/[restaurantId]/route.ts", "utf8");

  assert.match(source, /PATCH/);
  assert.match(source, /requireVistaireOwnerApi/);
  assert.match(source, /requireSameOriginOwnerMutation\(request\)/);
  assert.match(source, /updateRestaurantStatus/);
});

test("restaurant dashboard exposes reversible archive controls without hard delete", async () => {
  const source = await readFile("components/owner/OwnerRestaurantDashboard.tsx", "utf8");

  assert.match(source, /Archiver le restaurant/);
  assert.match(source, /Restaurer le restaurant/);
  assert.match(source, /onStatusAction\(nextAction\)/);
  assert.doesNotMatch(source, /method:\s*["']DELETE["']/);
});

test("owner portfolio keeps archived restaurants out of urgent counters", async () => {
  const source = await readFile("app/owner/page.tsx", "utf8");

  assert.match(source, /isActivePortfolioRestaurant/);
  assert.match(source, /restaurant\.status !== "archived"/);
  assert.match(source, /statusSortWeight/);
});
