import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  deleteRestaurantRecord,
  updateRestaurantStatusRecord,
  validateRestaurantStatusAction
} from "../lib/owner/restaurantStatus.ts";

const RESTAURANT_ID = "22222222-2222-4222-8222-222222222222";

function updateClient({
  restaurant = {
    id: RESTAURANT_ID,
    name: "Bistro Test",
    slug: "bistro-test",
    status: "active"
  },
  lookupError = null,
  data = null,
  error = null,
  onUpdate = () => {},
  onEq = () => {}
} = {}) {
  return {
    from(table) {
      assert.equal(table, "restaurants");
      return {
        select(columns) {
          assert.equal(columns, "id,name,slug,status");
          return {
            eq(column, value) {
              onEq(column, value);
              return {
                async single() {
                  return { data: restaurant, error: lookupError };
                }
              };
            }
          };
        },
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

function missingTable(table) {
  return {
    code: "42P01",
    message: `relation "public.${table}" does not exist`
  };
}

function missingColumn(column) {
  return {
    code: "42703",
    message: `column "${column}" does not exist`
  };
}

function deleteClient({
  restaurant = {
    id: RESTAURANT_ID,
    name: "Bistro Test",
    slug: "bistro-test",
    status: "active"
  },
  lookupError = null,
  deleteResults = {},
  verifyRestaurantDeleted = true,
  verifyError = null,
  onDelete = () => {},
  storage = undefined
} = {}) {
  return {
    storage,
    from(table) {
      if (table === "restaurants") {
        return {
          select(columns) {
            return {
              eq(column, value) {
                return {
                  async single() {
                    assert.equal(columns, "id,name,slug,status");
                    assert.equal(column === "id" || column === "slug", true);
                    assert.equal(typeof value, "string");
                    return { data: restaurant, error: lookupError };
                  },
                  async maybeSingle() {
                    assert.equal(columns, "id");
                    assert.equal(column, "id");
                    return {
                      data: verifyRestaurantDeleted ? null : { id: value },
                      error: verifyError
                    };
                  }
                };
              }
            };
          },
          delete(options) {
            assert.deepEqual(options, { count: "exact" });
            return {
              async eq(column, value) {
                onDelete({ table, column, value });
                const result = deleteResults[`${table}.${column}`] ?? { count: 1 };
                return {
                  data: null,
                  error: result.error ?? null,
                  count: result.count ?? null
                };
              }
            };
          }
        };
      }

      return {
        delete(options) {
          assert.deepEqual(options, { count: "exact" });
          return {
            async eq(column, value) {
              onDelete({ table, column, value });
              const result = deleteResults[`${table}.${column}`] ?? { count: 0 };
              return {
                data: null,
                error: result.error ?? null,
                count: result.count ?? null
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
  const eqCalls = [];
  const result = await updateRestaurantStatusRecord(RESTAURANT_ID, "archive", {
    admin: {
      ok: true,
      client: updateClient({
        onUpdate(row) {
          updatedRow = row;
        },
        onEq(column, value) {
          eqCalls.push({ column, value });
        },
        data: { id: RESTAURANT_ID, status: "archived" }
      })
    }
  });

  assert.deepEqual(result, {
    ok: true,
    restaurantId: RESTAURANT_ID,
    status: "archived"
  });
  assert.deepEqual(updatedRow, { status: "archived" });
  assert.deepEqual(eqCalls.at(-1), { column: "id", value: RESTAURANT_ID });
});

test("archive refuses a missing restaurant", async () => {
  const result = await updateRestaurantStatusRecord(RESTAURANT_ID, "archive", {
    admin: {
      ok: true,
      client: updateClient({
        restaurant: null,
        lookupError: { code: "PGRST116", message: "not found" }
      })
    }
  });

  assert.deepEqual(result, {
    ok: false,
    status: 404,
    error: "Restaurant introuvable."
  });
});

test("restores an archived restaurant to setup_needed", async () => {
  let updatedRow;
  const result = await updateRestaurantStatusRecord(RESTAURANT_ID, "restore", {
    admin: {
      ok: true,
      client: updateClient({
        restaurant: {
          id: RESTAURANT_ID,
          name: "Bistro Test",
          slug: "bistro-test",
          status: "archived"
        },
        onUpdate(row) {
          updatedRow = row;
        },
        data: { id: RESTAURANT_ID, status: "setup_needed" }
      })
    }
  });

  assert.deepEqual(result, {
    ok: true,
    restaurantId: RESTAURANT_ID,
    status: "setup_needed"
  });
  assert.deepEqual(updatedRow, { status: "setup_needed" });
});

test("deletes a confirmed restaurant and reports linked Supabase cleanup counts", async () => {
  const deleteCalls = [];
  const result = await deleteRestaurantRecord(
    RESTAURANT_ID,
    { confirmation: "Bistro Test", deleteStorage: false },
    {
      admin: {
        ok: true,
        client: deleteClient({
          deleteResults: {
            "qr_codes.restaurant_id": { count: 2 },
            "menu_dishes.restaurant_id": { count: 12 },
            "menu_dishes.restaurant_slug": { count: 0 },
            "menu_ui_configs.restaurant_id": { count: 1 },
            "analytics_events.restaurant_id": { count: 3 },
            "restaurants.id": { count: 1 }
          },
          onDelete(call) {
            deleteCalls.push(call);
          }
        })
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.restaurantDeleted, true);
  assert.equal(result.deleted.menu_dishes, 12);
  assert.equal(result.deleted.qr_codes, 2);
  assert.equal(result.deleted.menu_ui_configs, 1);
  assert.equal(result.deleted.analytics_events, 3);
  assert.equal(result.deleted.restaurants, 1);
  assert.equal(result.storage.attempted, false);
  assert.equal(deleteCalls.at(-1).table, "restaurants");
  assert.deepEqual(deleteCalls.slice(0, 4), [
    { table: "qr_codes", column: "restaurant_id", value: RESTAURANT_ID },
    { table: "menu_dishes", column: "restaurant_id", value: RESTAURANT_ID },
    { table: "menu_dishes", column: "restaurant_slug", value: "bistro-test" },
    { table: "menu_ui_configs", column: "restaurant_id", value: RESTAURANT_ID }
  ]);
});

test("restaurant delete requires exact confirmation and protects demo rows", async () => {
  const admin = {
    ok: true,
    client: deleteClient()
  };

  assert.deepEqual(
    await deleteRestaurantRecord(RESTAURANT_ID, { confirmation: "Wrong name" }, { admin }),
    {
      ok: false,
      status: 400,
      error: "La confirmation ne correspond pas au restaurant.",
      restaurantDeleted: false,
      deleted: {},
      storage: {
        attempted: false,
        buckets: [],
        deletedFiles: 0,
        prefixes: [],
        warnings: []
      },
      warnings: []
    }
  );

  const demoResult = await deleteRestaurantRecord(
    "11111111-1111-1111-1111-111111111111",
    { confirmation: "Maison Elyse" },
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
  );

  assert.equal(demoResult.ok, false);
  assert.equal(demoResult.status, 403);
  assert.equal(demoResult.restaurantDeleted, false);
});

test("restaurant delete refuses invalid ids before touching Supabase", async () => {
  const result = await deleteRestaurantRecord(
    "../wrong",
    { confirmation: "Bistro Test" },
    {
      admin: {
        ok: true,
        client: deleteClient()
      }
    }
  );

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    error: "Identifiant restaurant invalide.",
    restaurantDeleted: false,
    deleted: {},
      storage: {
        attempted: false,
        buckets: [],
        deletedFiles: 0,
        prefixes: [],
        warnings: []
      },
    warnings: []
  });
});

test("menu_dishes failure blocks parent restaurant deletion", async () => {
  const deleteCalls = [];
  const result = await deleteRestaurantRecord(
    RESTAURANT_ID,
    { confirmation: "bistro-test" },
    {
      admin: {
        ok: true,
        client: deleteClient({
          deleteResults: {
            "qr_codes.restaurant_id": { count: 1 },
            "menu_dishes.restaurant_id": {
              error: { code: "42501", message: "permission denied for table menu_dishes" }
            }
          },
          onDelete(call) {
            deleteCalls.push(call);
          }
        })
      }
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.restaurantDeleted, false);
  assert.equal(result.details.table, "menu_dishes");
  assert.match(result.error, /menu_dishes/);
  assert.equal(deleteCalls.some((call) => call.table === "restaurants"), false);
});

test("qr_codes failure blocks parent restaurant deletion", async () => {
  const deleteCalls = [];
  const result = await deleteRestaurantRecord(
    RESTAURANT_ID,
    { confirmation: "Bistro Test" },
    {
      admin: {
        ok: true,
        client: deleteClient({
          deleteResults: {
            "qr_codes.restaurant_id": {
              error: { code: "23503", message: "foreign key constraint still blocks qr" }
            }
          },
          onDelete(call) {
            deleteCalls.push(call);
          }
        })
      }
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.restaurantDeleted, false);
  assert.equal(result.details.table, "qr_codes");
  assert.equal(deleteCalls.some((call) => call.table === "restaurants"), false);
});

test("missing optional tables and missing fallback columns continue with warnings", async () => {
  const result = await deleteRestaurantRecord(
    RESTAURANT_ID,
    { confirmation: "Bistro Test" },
    {
      admin: {
        ok: true,
        client: deleteClient({
          deleteResults: {
            "qr_codes.restaurant_id": { count: 0 },
            "menu_dishes.restaurant_id": { count: 2 },
            "menu_dishes.restaurant_slug": { error: missingColumn("restaurant_slug") },
            "menu_ui_configs.restaurant_id": { count: 0 },
            "analytics_events.restaurant_id": { error: missingTable("analytics_events") },
            "restaurants.id": { count: 1 }
          }
        })
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.restaurantDeleted, true);
  assert.equal(result.deleted.menu_dishes, 2);
  assert.equal(result.deleted.restaurants, 1);
  assert.equal(result.skipped.some((entry) => entry.table === "analytics_events"), true);
  assert.equal(result.skipped.some((entry) => entry.table === "menu_dishes"), true);
});

test("storage cleanup can be attempted without blocking a confirmed DB deletion", async () => {
  const storageCalls = [];
  const storage = {
    from(bucket) {
      return {
        async list(prefix) {
          storageCalls.push({ action: "list", bucket, prefix });
          if (bucket === "vistaire-media" && prefix === `restaurants/${RESTAURANT_ID}`) {
            return {
              data: [{ name: "hero.jpg", id: "file-1" }],
              error: null
            };
          }
          if (bucket === "vistaire-3d") {
            return {
              data: null,
              error: { message: "bucket not found" }
            };
          }
          return { data: [], error: null };
        },
        async remove(paths) {
          storageCalls.push({ action: "remove", bucket, paths });
          return { data: paths.map((name) => ({ name })), error: null };
        }
      };
    }
  };

  const result = await deleteRestaurantRecord(
    RESTAURANT_ID,
    { confirmation: "Bistro Test", deleteStorage: true },
    {
      env: {
        VISTAIRE_MEDIA_BUCKET: "vistaire-media",
        VISTAIRE_3D_CDN_BUCKET: "vistaire-3d"
      },
      admin: {
        ok: true,
        client: deleteClient({
          storage,
          deleteResults: {
            "qr_codes.restaurant_id": { count: 0 },
            "menu_dishes.restaurant_id": { count: 0 },
            "menu_ui_configs.restaurant_id": { count: 0 },
            "restaurants.id": { count: 1 }
          }
        })
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.storage.attempted, true);
  assert.equal(result.storage.deletedFiles, 1);
  assert.equal(result.storage.warnings.length > 0, true);
  assert.equal(storageCalls.some((call) => call.action === "remove"), true);
});

test("owner restaurant routes are owner-only and same-origin", async () => {
  const legacyRoute = await readFile("app/api/restaurants/[restaurantId]/route.ts", "utf8");
  const ownerDeleteRoute = await readFile("app/api/owner/restaurants/[restaurantId]/route.ts", "utf8");
  const ownerArchiveRoute = await readFile(
    "app/api/owner/restaurants/[restaurantId]/archive/route.ts",
    "utf8"
  );

  for (const source of [legacyRoute, ownerDeleteRoute, ownerArchiveRoute]) {
    assert.match(source, /requireVistaireOwnerApi/);
    assert.match(source, /requireSameOriginOwnerMutation\(request\)/);
  }

  assert.match(ownerArchiveRoute, /PATCH/);
  assert.match(ownerDeleteRoute, /DELETE/);
  assert.match(ownerDeleteRoute, /deleteRestaurantRecord/);
  assert.match(ownerArchiveRoute, /updateRestaurantStatusRecord/);
});

test("restaurant dashboard exposes archive controls and confirmed hard delete", async () => {
  const source = await readFile("components/owner/OwnerRestaurantDashboard.tsx", "utf8");

  assert.match(source, /Archiver le restaurant/);
  assert.match(source, /Restaurer le restaurant/);
  assert.match(source, /onStatusAction\(nextAction\)/);
  assert.match(source, /Suppression definitive/);
  assert.match(source, /confirmation/);
  assert.match(source, /deleteStorage/);
  assert.match(source, /Storage\/CDN/);
  assert.match(source, /method:\s*["']DELETE["']/);
  assert.match(source, /Supprimer definitivement/);
  assert.match(source, /Restaurant supprime definitivement/);
});

test("owner restaurants page can display delete success after redirect", async () => {
  const source = await readFile("app/owner/restaurants/page.tsx", "utf8");

  assert.match(source, /deleted.*"1"/);
  assert.match(source, /Restaurant supprime definitivement/);
});

test("restaurant deletion migration adds transactional RPC", async () => {
  const source = await readFile(
    "supabase/migrations/0010_delete_owner_restaurant_cascade.sql",
    "utf8"
  );

  assert.match(source, /delete_owner_restaurant_cascade/);
  assert.match(source, /for update/i);
  assert.match(source, /delete from public\.restaurants/i);
  assert.match(source, /grant execute .*service_role/is);
  assert.match(source, /missing_table/);
  assert.match(source, /missing_column/);
});

test("owner portfolio keeps archived restaurants out of urgent counters", async () => {
  const source = await readFile("app/owner/page.tsx", "utf8");

  assert.match(source, /isActivePortfolioRestaurant/);
  assert.match(source, /restaurant\.status !== "archived"/);
  assert.match(source, /statusSortWeight/);
});
