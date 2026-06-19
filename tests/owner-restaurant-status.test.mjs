import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  deleteRestaurantRecord,
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

function deleteClient({
  restaurant = null,
  lookupError = null,
  deleteErrors = {},
  onDelete = () => {}
} = {}) {
  return {
    from(table) {
      if (table === "restaurants") {
        return {
          select(columns) {
            assert.equal(columns, "id,name,slug,status");
            return {
              eq(column, value) {
                assert.equal(column, "id");
                assert.equal(typeof value, "string");
                return {
                  async single() {
                    return { data: restaurant, error: lookupError };
                  }
                };
              }
            };
          },
          delete() {
            return {
              async eq(column, value) {
                onDelete({ table, column, value });
                return { data: null, error: deleteErrors[`${table}.${column}`] ?? null };
              }
            };
          }
        };
      }

      return {
        delete() {
          return {
            async eq(column, value) {
              onDelete({ table, column, value });
              return { data: null, error: deleteErrors[`${table}.${column}`] ?? null };
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

test("deletes a confirmed restaurant and cleans linked owner rows", async () => {
  const deleteCalls = [];
  const result = await deleteRestaurantRecord(
    "rest_123",
    { confirmed: true, confirmName: "Bistro Test" },
    {
      admin: {
        ok: true,
        client: deleteClient({
          restaurant: {
            id: "rest_123",
            name: "Bistro Test",
            slug: "bistro-test",
            status: "active"
          },
          onDelete(call) {
            deleteCalls.push(call);
          }
        })
      }
    }
  );

  assert.deepEqual(result, {
    ok: true,
    restaurantId: "rest_123",
    deleted: true
  });
  assert.deepEqual(deleteCalls, [
    { table: "qr_codes", column: "restaurant_id", value: "rest_123" },
    { table: "menu_dishes", column: "restaurant_id", value: "rest_123" },
    { table: "menu_dishes", column: "restaurant_slug", value: "bistro-test" },
    { table: "menu_ui_configs", column: "restaurant_id", value: "rest_123" },
    { table: "restaurants", column: "id", value: "rest_123" }
  ]);
});

test("restaurant delete requires exact name confirmation and protects demo rows", async () => {
  const admin = {
    ok: true,
    client: deleteClient({
      restaurant: {
        id: "rest_123",
        name: "Bistro Test",
        slug: "bistro-test",
        status: "active"
      }
    })
  };

  assert.deepEqual(
    await deleteRestaurantRecord(
      "rest_123",
      { confirmed: true, confirmName: "Wrong name" },
      { admin }
    ),
    {
      ok: false,
      status: 400,
      error: "Le nom de confirmation ne correspond pas au restaurant."
    }
  );

  assert.deepEqual(
    await deleteRestaurantRecord(
      "11111111-1111-1111-1111-111111111111",
      { confirmed: true, confirmName: "Maison Elyse" },
      {
        admin: {
          ok: true,
          client: deleteClient({
            restaurant: {
              id: "11111111-1111-1111-1111-111111111111",
              name: "Maison Elyse",
              slug: "maison-elyse",
              status: "active"
            }
          })
        }
      }
    ),
    {
      ok: false,
      status: 403,
      error: "Restaurant de demonstration protege contre la suppression."
    }
  );
});

test("restaurant archive route is owner-only and same-origin", async () => {
  const source = await readFile("app/api/restaurants/[restaurantId]/route.ts", "utf8");

  assert.match(source, /PATCH/);
  assert.match(source, /DELETE/);
  assert.match(source, /requireVistaireOwnerApi/);
  assert.match(source, /requireSameOriginOwnerMutation\(request\)/);
  assert.match(source, /updateRestaurantStatus/);
  assert.match(source, /deleteRestaurantRecord/);
});

test("restaurant dashboard exposes archive controls and confirmed hard delete", async () => {
  const source = await readFile("components/owner/OwnerRestaurantDashboard.tsx", "utf8");

  assert.match(source, /Archiver le restaurant/);
  assert.match(source, /Restaurer le restaurant/);
  assert.match(source, /onStatusAction\(nextAction\)/);
  assert.match(source, /Suppression definitive/);
  assert.match(source, /Tapez .* pour confirmer/);
  assert.match(source, /method:\s*["']DELETE["']/);
  assert.match(source, /confirmName/);
  assert.match(source, /Supprimer definitivement/);
});

test("owner portfolio keeps archived restaurants out of urgent counters", async () => {
  const source = await readFile("app/owner/page.tsx", "utf8");

  assert.match(source, /isActivePortfolioRestaurant/);
  assert.match(source, /restaurant\.status !== "archived"/);
  assert.match(source, /statusSortWeight/);
});
