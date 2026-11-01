import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationPath = "supabase/migrations/20261019050917_menu_telemetry_v2_preserve_history.sql";

test("telemetry v2 preserves all history without expiry or scheduled deletion", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.doesNotMatch(migration, /expires_at|pg_cron|cron\.schedule|purge_expired_menu_telemetry|delete\s+from|truncate/i);
  for (const contract of ["schema_version", "event_id", "sequence between 1 and 3600", "analytics_events_v2_identity_check", "analytics_events_event_id_unique", "pg_advisory_xact_lock", "interval '1 minute'", ">= 120", "new.search_query := null", "new.user_agent := null", "new.viewport := null"])
    assert.ok(migration.includes(contract), contract);
});

test("local database runner includes the entire migration and verifies retained old rows", async () => {
  const runner = await readFile("scripts/run-menu-telemetry-postgres-tests.mjs", "utf8");
  assert.ok(runner.includes("migration.replace"));
  assert.doesNotMatch(runner, /migration\.slice|indexOf\("alter table|indexOf\("select cron|missingCron/);
  const fixture = await readFile("supabase/tests/menu_telemetry_v2.sql", "utf8");
  assert.ok(fixture.includes("interval '100 days'"));
  assert.ok(fixture.includes("to_regprocedure('public.purge_expired_menu_telemetry()') is null"));
  assert.ok(fixture.includes("legacy-old"));
  assert.ok(fixture.includes("rollback;"));
});
