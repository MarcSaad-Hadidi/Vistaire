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

function deleteClient({
  restaurant = {
    id: RESTAURANT_ID,
    name: "Bistro Test",
    slug: "bistro-test",
    status: "active"
  },
  lookupError = null,
  rpcData = {
    ok: true,
    restaurantId: RESTAURANT_ID,
    restaurantDeleted: true,
    deleted: {
      qr_codes: 0,
      menu_dishes: 0,
      restaurants: 1
    },
    skipped: [],
    warnings: []
  },
  rpcError = null,
  rpcUnavailable = false,
  onRpc = () => {},
  deleteResults = {},
  dishRows = [],
  dishRowsError = null,
  onDishMediaList = () => {},
  verifyRestaurantDeleted = true,
  verifyError = null,
  onDelete = () => {},
  storage = undefined
} = {}) {
  const client = {
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
      if (table === "menu_dishes") {
        return {
          select(columns) {
            assert.equal(columns, "id,metadata");
            return {
              eq(column, value) {
                assert.equal(column, "restaurant_id");
                assert.equal(value, RESTAURANT_ID);
                onDishMediaList({ table, column, value });
                return {
                  async limit(count) {
                    assert.equal(count, 1000);
                    return { data: dishRows, error: dishRowsError };
                  }
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

  if (!rpcUnavailable) {
    client.rpc = async (fn, args) => {
      onRpc({ fn, args });
      return { data: rpcData, error: rpcError };
    };
  }

  return client;
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
  const rpcCalls = [];
  const dishMediaLists = [];
  const result = await deleteRestaurantRecord(
    RESTAURANT_ID,
    { confirmation: "Bistro Test", deleteStorage: false },
    {
      admin: {
        ok: true,
        client: deleteClient({
          rpcData: {
            ok: true,
            restaurantId: RESTAURANT_ID,
            restaurantDeleted: true,
            deleted: {
              qr_codes: 2,
              menu_dishes: 12,
              menu_ui_configs: 1,
              analytics_events: 3,
              restaurants: 1
            },
            skipped: [],
            warnings: []
          },
          onRpc(call) {
            rpcCalls.push(call);
          },
          onDishMediaList(call) {
            dishMediaLists.push(call);
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
  assert.deepEqual(rpcCalls, [
    {
      fn: "delete_owner_restaurant_cascade",
      args: {
        p_restaurant_id: RESTAURANT_ID,
        p_confirmation: "Bistro Test"
      }
    }
  ]);
  assert.deepEqual(dishMediaLists, []);
});

test("restaurant deleteStorage=false never removes dish media storage", async () => {
  const storageCalls = [];
  const result = await deleteRestaurantRecord(
    RESTAURANT_ID,
    { confirmation: "Bistro Test", deleteStorage: false },
    {
      admin: {
        ok: true,
        client: deleteClient({
          dishRows: [
            {
              metadata: {
                photoStoragePath: `restaurants/${RESTAURANT_ID}/photos/originals/burger.webp`
              }
            }
          ],
          storage: {
            from(bucket) {
              return {
                async list(prefix) {
                  storageCalls.push({ action: "list", bucket, prefix });
                  return { data: [], error: null };
                },
                async remove(paths) {
                  storageCalls.push({ action: "remove", bucket, paths });
                  return { data: [], error: null };
                }
              };
            }
          }
        })
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.storage.attempted, false);
  assert.equal(result.storage.dishMedia, undefined);
  assert.deepEqual(storageCalls, []);
});

test("restaurant RPC failure never removes dish media storage", async () => {
  const storageCalls = [];
  const result = await deleteRestaurantRecord(
    RESTAURANT_ID,
    { confirmation: "Bistro Test", deleteStorage: true },
    {
      admin: {
        ok: true,
        client: deleteClient({
          dishRows: [
            {
              metadata: {
                photoStoragePath: `restaurants/${RESTAURANT_ID}/photos/originals/nachos.webp`
              }
            }
          ],
          rpcError: {
            code: "P0001",
            message: "Impossible de supprimer les donnees liees dans menu_dishes."
          },
          storage: {
            from(bucket) {
              return {
                async list(prefix) {
                  storageCalls.push({ action: "list", bucket, prefix });
                  return { data: [], error: null };
                },
                async remove(paths) {
                  storageCalls.push({ action: "remove", bucket, paths });
                  return { data: [], error: null };
                }
              };
            }
          }
        })
      }
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.restaurantDeleted, false);
  assert.deepEqual(storageCalls, []);
});

test("restaurant RPC deleted with deleteStorage=true removes precollected dish media", async () => {
  const storageCalls = [];
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
          dishRows: [
            {
              metadata: {
                photoStoragePath: `restaurants/${RESTAURANT_ID}/photos/originals/burger.webp`,
                webModel3dStoragePath: `restaurants/${RESTAURANT_ID}/models/web/burger.glb`
              }
            }
          ],
          storage: {
            from(bucket) {
              return {
                async list(prefix) {
                  storageCalls.push({ action: "list", bucket, prefix });
                  return { data: [], error: null };
                },
                async remove(paths) {
                  storageCalls.push({ action: "remove", bucket, paths });
                  return { data: paths.map((name) => ({ name })), error: null };
                }
              };
            }
          }
        })
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.storage.dishMedia.deletedFiles, 2);
  assert.equal(
    storageCalls.some(
      (call) =>
        call.action === "remove" &&
        call.bucket === "vistaire-media" &&
        call.paths.includes(`restaurants/${RESTAURANT_ID}/photos/originals/burger.webp`)
    ),
    true
  );
  assert.equal(
    storageCalls.some(
      (call) =>
        call.action === "remove" &&
        call.bucket === "vistaire-3d" &&
        call.paths.includes(`restaurants/${RESTAURANT_ID}/models/web/burger.glb`)
    ),
    true
  );
});

test("restaurant dish media cleanup warnings are reported after confirmed DB deletion", async () => {
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
          dishRows: [
            {
              metadata: {
                photoStoragePath: `restaurants/${RESTAURANT_ID}/photos/originals/burger.webp`
              }
            }
          ],
          storage: {
            from(bucket) {
              return {
                async list() {
                  return { data: [], error: null };
                },
                async remove() {
                  return { data: null, error: { message: `${bucket} unavailable` } };
                }
              };
            }
          }
        })
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.restaurantDeleted, true);
  assert.equal(result.storage.dishMedia.deletedFiles, 0);
  assert.match(result.storage.dishMedia.warnings.join("\n"), /non supprime|unavailable/);
  assert.match(result.storage.warnings.join("\n"), /non supprime|unavailable/);
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
  const result = await deleteRestaurantRecord(
    RESTAURANT_ID,
    { confirmation: "bistro-test" },
    {
      admin: {
        ok: true,
        client: deleteClient({
          rpcError: {
            code: "P0001",
            message:
              "Impossible de supprimer les donnees liees dans menu_dishes. permission denied"
          }
        })
      }
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.restaurantDeleted, false);
  assert.equal(result.details.table, "menu_dishes");
  assert.match(result.details.supabaseMessage, /menu_dishes/);
});

test("qr_codes failure blocks parent restaurant deletion", async () => {
  const result = await deleteRestaurantRecord(
    RESTAURANT_ID,
    { confirmation: "Bistro Test" },
    {
      admin: {
        ok: true,
        client: deleteClient({
          rpcError: {
            code: "P0001",
            message:
              "Impossible de supprimer les donnees liees dans qr_codes. foreign key constraint still blocks qr"
          }
        })
      }
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.restaurantDeleted, false);
  assert.equal(result.details.table, "qr_codes");
  assert.match(result.details.supabaseMessage, /qr_codes/);
});

test("missing transactional RPC refuses delete without fallback row deletes", async () => {
  const deleteCalls = [];
  const result = await deleteRestaurantRecord(
    RESTAURANT_ID,
    { confirmation: "Bistro Test" },
    {
      admin: {
        ok: true,
        client: deleteClient({
          rpcUnavailable: true,
          onDelete(call) {
            deleteCalls.push(call);
          }
        })
      }
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.restaurantDeleted, false);
  assert.equal(result.details.table, "delete_owner_restaurant_cascade");
  assert.match(result.error, /fonction transactionnelle Supabase/);
  assert.deepEqual(result.deleted, {});
  assert.deepEqual(deleteCalls, []);
});

test("missing optional tables and missing columns continue with RPC warnings", async () => {
  const result = await deleteRestaurantRecord(
    RESTAURANT_ID,
    { confirmation: "Bistro Test" },
    {
      admin: {
        ok: true,
        client: deleteClient({
          rpcData: {
            ok: true,
            restaurantId: RESTAURANT_ID,
            restaurantDeleted: true,
            deleted: {
              menu_dishes: 2,
              restaurants: 1
            },
            skipped: [
              {
                table: "analytics_events",
                column: "restaurant_id",
                reason: "missing_table",
                message: "analytics_events absent dans Supabase."
              },
              {
                table: "menu_dishes",
                column: "restaurant_slug",
                reason: "missing_column",
                message: "menu_dishes.restaurant_slug absent dans Supabase."
              },
              {
                table: "restaurant_daily_analytics",
                column: "restaurant_id",
                reason: "non_table_relation",
                message: "restaurant_daily_analytics est une vue ou une relation non supprimable."
              }
            ],
            warnings: [
              "analytics_events absent: nettoyage ignore.",
              "menu_dishes.restaurant_slug absent: nettoyage ignore pour cette colonne."
            ]
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
  assert.equal(
    result.skipped.some(
      (entry) =>
        entry.table === "restaurant_daily_analytics" &&
        entry.reason === "non_table_relation"
    ),
    true
  );
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
          rpcData: {
            ok: true,
            restaurantId: RESTAURANT_ID,
            restaurantDeleted: true,
            deleted: {
              restaurants: 1
            },
            skipped: [],
            warnings: []
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
  const source = await readFile("components/owner/OwnerRestaurantSettings.tsx", "utf8");

  assert.match(source, /Archiver le restaurant/);
  assert.match(source, /Restaurer le restaurant/);
  assert.match(source, /updateRestaurantStatus\(nextAction\)/);
  assert.match(source, /Suppression définitive/);
  assert.match(source, /confirmation/);
  assert.match(source, /deleteStorage/);
  assert.match(source, /Storage\/CDN/);
  assert.match(source, /method:\s*["']DELETE["']/);
  assert.match(source, /Supprimer définitivement/);
  assert.match(source, /Restaurant supprimé définitivement/);
});

test("owner restaurants page can display delete success after redirect", async () => {
  const source = await readFile("app/(fr)/owner/restaurants/page.tsx", "utf8");

  assert.match(source, /deleted.*"1"/);
  assert.match(source, /Restaurant supprim/);
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
  assert.match(source, /non_table_relation/);
  assert.doesNotMatch(source, /"table":"restaurant_daily_analytics"/);
  assert.doesNotMatch(source, /"table":"restaurant_dish_analytics"/);
  assert.doesNotMatch(source, /"table":"restaurant_search_analytics"/);
  assert.doesNotMatch(source, /"table":"restaurant_category_analytics"/);
  assert.doesNotMatch(
    source,
    /"table":"owner_3d_publish_events","column":"restaurant_slug"/
  );
  assert.doesNotMatch(
    source,
    /"table":"owner_3d_pipeline_artifacts","column":"restaurant_slug"/
  );
  assert.match(
    source,
    /"table":"owner_3d_publish_events","column":"asset_version_id","kind":"asset_version_id"/
  );
  assert.match(
    source,
    /"table":"owner_3d_publish_events","column":"previous_version_id","kind":"asset_version_id"/
  );
  assert.match(
    source,
    /"table":"owner_3d_publish_events","column":"job_id","kind":"job_id"/
  );
  assert.match(
    source,
    /"table":"owner_3d_pipeline_artifacts","column":"asset_version_id","kind":"asset_version_id"/
  );
  assert.match(
    source,
    /"table":"owner_3d_pipeline_artifacts","column":"job_id","kind":"job_id"/
  );
  assert.match(source, /using public\.owner_3d_asset_versions as versions/i);
  assert.match(source, /using public\.owner_3d_pipeline_jobs as jobs/i);
});

test("restaurant delete source refuses non-transactional fallback deletes", async () => {
  const source = await readFile("lib/owner/restaurantStatus.ts", "utf8");

  assert.doesNotMatch(source, /deleteScopedRows/);
  assert.doesNotMatch(source, /deleteRestaurantParent/);
  assert.doesNotMatch(source, /\.delete\(\{ count: "exact" \}\)/);
  assert.match(source, /delete_owner_restaurant_cascade/);
});

test("runtime hardening migration locks Data API and private Storage buckets", async () => {
  const source = await readFile(
    "supabase/migrations/0011_security_storage_runtime_hardening.sql",
    "utf8"
  );

  assert.match(source, /vistaire_no_direct_public_access/);
  assert.match(source, /revoke all on table public\.%I from anon, authenticated/);
  assert.match(source, /grant select, insert, update, delete on table public\.%I to service_role/);
  assert.match(source, /security_invoker/);
  assert.match(source, /resolve_qr_code_scan\(text\)/);
  assert.match(source, /owner_3d_claim_pipeline_job/);
  assert.match(source, /analytics_events_dish_id_idx/);
  assert.match(source, /to_regclass\('public\.analytics_events'\)/);
  assert.match(source, /column_name = 'dish_id'/);
  assert.doesNotMatch(
    source,
    /\ncreate index if not exists analytics_events_dish_id_idx\s+on public\.analytics_events \(dish_id\);/i
  );
  assert.match(source, /owner_3d_pipeline_jobs_asset_version_id_idx/);
  assert.match(source, /'vistaire-3d-sources'/);
  assert.match(source, /'vistaire-3d-qa'/);
  assert.match(source, /'vistaire-media'/);
  assert.match(source, /'vistaire-3d'/);
  assert.doesNotMatch(source, /public,\s*true/);
});

test("forward repair migration refreshes deployed restaurant delete RPC", async () => {
  const source = await readFile(
    "supabase/migrations/0012_refresh_owner_restaurant_delete_rpc.sql",
    "utf8"
  );

  assert.match(source, /create or replace function public\.delete_owner_restaurant_cascade/);
  assert.match(source, /notify pgrst, 'reload schema'/);
  assert.doesNotMatch(source, /"table":"restaurant_daily_analytics"/);
  assert.doesNotMatch(source, /"table":"restaurant_dish_analytics"/);
  assert.doesNotMatch(source, /"table":"restaurant_search_analytics"/);
  assert.doesNotMatch(source, /"table":"restaurant_category_analytics"/);
  assert.match(source, /non_table_relation/);
  assert.match(source, /owner_3d_publish_events/);
  assert.match(source, /asset_version_id/);
  assert.match(source, /job_id/);
});

test("owner portfolio keeps archived restaurants out of urgent counters", async () => {
  const source = await readFile("app/(fr)/owner/page.tsx", "utf8");

  assert.match(source, /isActivePortfolioRestaurant/);
  assert.match(source, /restaurant\.status !== "archived"/);
  assert.match(source, /statusSortWeight/);
});
