import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260815120000_media_capacity_reservations.sql",
  import.meta.url
);
const sqlTestUrl = new URL("./postgres/media-capacity/run.sql", import.meta.url);

test("capacity SQL keeps overdue and ambiguous reservations counted until explicit settlement", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /status in \('active', 'settlement_pending'\)/);
  assert.doesNotMatch(migration, /status = 'expired'/);
  assert.doesNotMatch(migration, /expires_at > clock_timestamp\(\)/);
  assert.match(migration, /renew_media_capacity_reservation/);
  assert.match(migration, /reservation-key-active/);
  assert.match(migration, /media_capacity_reservations_live_key_idx/);
});

test("capacity reservations reject usage measurements older than fifteen minutes or in the future", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /usage_measured_at\s*<\s*clock_timestamp\(\)\s*-\s*interval '15 minutes'/i);
  assert.match(migration, /usage_measured_at\s*>\s*clock_timestamp\(\)/i);
});

test("PostgreSQL harness exercises same-key ownership, finalized retry, expiry, renewal and ambiguity", async () => {
  const sqlTest = await readFile(sqlTestUrl, "utf8");

  for (const evidence of [
    "same-key:concurrent",
    "reservation-key-active",
    "finalized logical key must create a fresh reservation",
    "overdue reservations must remain counted",
    "renew_media_capacity_reservation",
    "ambiguous finalize retry must settle retained bytes exactly once"
    ,"stale usage measurement must fail closed"
    ,"future usage measurement must fail closed"
  ]) {
    assert.ok(sqlTest.includes(evidence), `missing PostgreSQL case: ${evidence}`);
  }
});
