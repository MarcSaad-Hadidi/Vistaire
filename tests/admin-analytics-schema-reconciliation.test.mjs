import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = "supabase/migrations/20260710194044_analytics_events_schema_reconciliation.sql";

test("analytics reconciliation is explicit, secure and non-destructive", async () => {
  const sql = await readFile(migration, "utf8");
  assert.match(sql, /create table if not exists public\.analytics_events/i);
  assert.match(sql, /information_schema\.columns|pg_attribute/i);
  assert.match(sql, /raise exception/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on table public\.analytics_events from anon, authenticated/i);
  assert.match(sql, /grant delete, insert, references, select, trigger, truncate, update on table public\.analytics_events to service_role/i);
  assert.doesNotMatch(sql, /\b(update|delete from|truncate|insert into)\s+public\.analytics_events/i);
});

test("analytics reconciliation freezes sixteen columns and nine indexes", async () => {
  const sql = await readFile(migration, "utf8");
  for (const column of ["id", "restaurant_id", "menu_id", "dish_id", "session_id", "event_name", "source", "dish_slug", "category_slug", "search_query", "filter_name", "cta_name", "viewport", "user_agent", "metadata", "created_at"]) {
    assert.match(sql, new RegExp(`\\b${column}\\b`));
  }
  for (const name of ["category_slug_idx","dish_id_idx","dish_slug_idx","menu_created_idx","name_idx","restaurant_created_idx","search_query_idx","session_idx","dashboard_scope_idx"]) assert.match(sql, new RegExp(`analytics_events_${name}`));
  assert.match(sql, /vistaire_no_direct_public_access/i);
});

test("live event checks and broad service grants are preserved exactly", async () => {
  const sql = await readFile(migration, "utf8");
  for (const event of ["session_started","session_duration","menu_opened","category_viewed","dish_opened","dish_3d_clicked","dish_ar_clicked","search_used","filter_used","cta_clicked","dashboard_demo_opened"]) assert.match(sql, new RegExp(`''${event}''|${event}`));
  assert.doesNotMatch(sql, /revoke all on table public\.analytics_events from service_role/i);
  assert.match(sql, /grant delete, insert, references, select, trigger, truncate, update on table public\.analytics_events to service_role/i);
  assert.match(sql, /\{DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE\}/);
});

test("existing catalog objects are compared rather than accepted by name", async () => {
  const sql = await readFile(migration, "utf8");
  for (const catalog of ["pg_attribute", "pg_attrdef", "pg_constraint", "pg_indexes", "pg_policies", "pg_class", "pg_roles", "information_schema.table_privileges"]) {
    assert.match(sql, new RegExp(catalog.replace(".", "\\."), "i"), catalog);
  }
  assert.match(sql, /pg_get_constraintdef/i);
  assert.match(sql, /pg_get_indexdef/i);
  assert.doesNotMatch(sql, /create (?:unique )?index if not exists/i);
  assert.match(sql, /incompatible (?:column|constraint|index|owner|policy|grant|rls)/i);
});

test("catalog reconciliation rejects extra table-specific objects", async () => {
  const sql = await readFile(migration, "utf8");
  assert.match(sql, /unexpected constraint/i);
  assert.match(sql, /unexpected index/i);
  assert.match(sql, /unexpected policy/i);
  assert.match(sql, /unexpected grant/i);
  assert.match(sql, /relacl\/aclexplode/i);
});
