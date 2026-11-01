import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function harness(respond) {
  const calls = [];
  const client = { from(table) {
    const call = { table, filters: [], orders: [] };
    const query = {
      select(columns) { call.columns = columns; return query; },
      eq(...args) { call.filters.push(["eq", ...args]); return query; },
      in(...args) { call.filters.push(["in", ...args]); return query; },
      gte(...args) { call.filters.push(["gte", ...args]); return query; },
      lt(...args) { call.filters.push(["lt", ...args]); return query; },
      order(...args) { call.orders.push(args); return query; },
      async range(...args) { call.range = args; calls.push(call); return respond(call); }
    };
    return query;
  } };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync("lib/analytics/serverRows.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, {
    exports, process: { env: { NODE_ENV: "production" } }, console: { error() {} },
    require: (name) => name === "server-only" ? {} : { getSupabaseAdminClient: () => ({ ok: true, client }) }
  });
  return { read: exports.readAnalyticsEventsForPeriod, calls };
}
const args = { restaurantId: "restaurant-a", menuId: "menu-a", fromIso: "2026-10-01T00:00:00Z", toIso: "2026-10-08T00:00:00Z", pageSize: 2, maxRows: 6 };

test("unmigrated analytics reads preserve tenant, menu, dates and pagination", async () => {
  const rows = [{ id: "1" }, { id: "2" }, { id: "3" }];
  const { read, calls } = harness((call) => {
    const missing = ["schema_version", "environment", "sequence"].find(column => call.columns.split(",").includes(column));
    return missing ? { data: null, error: { code: "42703", message: `column analytics_events.${missing} does not exist` } }
      : { data: rows.slice(call.range[0], call.range[1] + 1), error: null };
  });
  const result = await read(args);
  assert.equal(result.ok, true);
  assert.equal(result.truncated, false);
  assert.deepEqual(Array.from(result.rows, row => row.id), ["1", "2", "3"]);
  assert.equal(calls.length, 5);
  for (const call of calls) {
    for (const filter of [["eq", "restaurant_id", args.restaurantId], ["eq", "menu_id", args.menuId], ["eq", "source", "production"], ["gte", "created_at", args.fromIso], ["lt", "created_at", args.toIso]]) {
      assert.ok(call.filters.some(value => JSON.stringify(value) === JSON.stringify(filter)));
    }
    assert.equal(JSON.stringify(call.orders), JSON.stringify([["created_at", { ascending: true }], ["id", { ascending: true }]]));
  }
  assert.ok(calls.slice(3).every(call => !call.columns.match(/schema_version|environment|sequence/) && !call.filters.some(filter => filter[1] === "environment")));
});

test("migrated analytics retain environment isolation and unrelated errors never downgrade", async () => {
  const migrated = harness(() => ({ data: [{ id: "v2", schema_version: 2 }], error: null }));
  assert.equal((await migrated.read(args)).ok, true);
  assert.equal(migrated.calls.length, 1);
  assert.ok(migrated.calls[0].filters.some(filter => filter[0] === "in" && filter[1] === "environment"));
  for (const error of [{ code: "42501", message: "permission denied" }, { code: "42703", message: "column analytics_events.menu_id does not exist" }, { code: "PGRST000", message: "connection unavailable" }, { code: "PGRST204", message: "Could not find the environment column in the schema cache" }]) {
    const failed = harness(() => ({ data: null, error }));
    assert.equal((await failed.read(args)).ok, false);
    assert.equal(failed.calls.length, 1);
  }
});

test("partial v2 schemas never drop a working environment filter", async () => {
  const { read, calls } = harness(call => call.columns.includes("sequence")
    ? { data: null, error: { code: "42703", message: "column analytics_events.sequence does not exist" } }
    : { data: [{ id: "production-only" }], error: null });
  assert.equal((await read(args)).ok, true);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].columns.includes("schema_version"));
  assert.ok(calls.every(call => call.filters.some(filter => filter[1] === "environment")));
});
