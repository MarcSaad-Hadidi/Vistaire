import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const concurrencySql = await readFile(
  new URL("postgres/qr-lifecycle/concurrency.test.sql", import.meta.url),
  "utf8"
);

test("dblink concurrency workers reuse the current database identity without embedded credentials", () => {
  assert.match(concurrencySql, /current_database\(\)/);
  assert.match(concurrencySql, /current_user/);
  assert.doesNotMatch(concurrencySql, /dbname\s*=\s*postgres/i);
  assert.doesNotMatch(concurrencySql, /user\s*=\s*postgres/i);
  assert.doesNotMatch(concurrencySql, /password\s*=/i);
});

test("the PostgreSQL harness retains twenty creates and two concurrent rotations", () => {
  assert.match(concurrencySql, /for v_worker in 1\.\.20 loop/);
  assert.match(concurrencySql, /count\(\*\) = 20/);
  assert.match(concurrencySql, /for v_worker in 1\.\.2 loop/);
  assert.match(concurrencySql, /count\(\*\) = 2/);
  assert.match(
    concurrencySql,
    /purpose_key = 'concurrent'\s+and is_canonical/
  );
});
