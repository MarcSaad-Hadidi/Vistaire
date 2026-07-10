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
  assert.match(sql, /grant select, insert on table public\.analytics_events to service_role/i);
  assert.doesNotMatch(sql, /\b(update|delete from|truncate|insert into)\s+public\.analytics_events/i);
});

test("analytics reconciliation freezes sixteen columns and nine indexes", async () => {
  const sql = await readFile(migration, "utf8");
  for (const column of ["id", "restaurant_id", "menu_id", "dish_id", "session_id", "event_name", "source", "dish_slug", "category_slug", "search_query", "filter_name", "cta_name", "viewport", "user_agent", "metadata", "created_at"]) {
    assert.match(sql, new RegExp(`\\b${column}\\b`));
  }
  assert.equal(new Set(sql.match(/analytics_events_(?:restaurant_id|menu_id|dish_id|session_id|event_name|source|created_at|restaurant_created_at|dashboard_scope)_idx/g)).size, 9);
  assert.match(sql, /vistaire_no_direct_public_access/i);
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
