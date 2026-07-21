import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(path, "utf8");
}

test("QR package scripts expose separate Node, PostgreSQL, functional, and aggregate gates", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.equal(packageJson.scripts["test:qr:node"], "node scripts/run-qr-node-tests.mjs");
  assert.equal(packageJson.scripts["test:qr:postgres"], "node scripts/run-qr-postgres-tests.mjs");
  assert.equal(packageJson.scripts["test:qr:functional"], "node scripts/run-qr-functional-e2e.mjs");
  assert.equal(
    packageJson.scripts["test:qr:all"],
    "npm run test:qr:node && npm run test:qr:postgres && npm run test:qr:functional"
  );
});

test("the PostgreSQL runner applies the production QR migrations with real psql", async () => {
  const runner = await source("scripts/run-qr-postgres-tests.mjs");
  for (const migration of [
    "0001_qr_codes.sql",
    "0002_qr_resolve_scan_rpc.sql",
    "0007_restaurants.sql",
    "20260709180000_admin_qr_access.sql",
    "20260717120000_owner_qr_canonical_lifecycle.sql"
  ]) {
    assert.match(runner, new RegExp(migration.replaceAll(".", "\\.")));
  }
  assert.match(runner, /spawnSync\("psql"/);
  assert.match(runner, /Promise\.all/);
  assert.match(runner, /VISTAIRE_QR_POSTGRES_TEST/);
  assert.match(runner, /server_version_num/);
});

test("App CI supplies PostgreSQL 17 and runs every blocking QR gate", async () => {
  const workflow = await source(".github/workflows/app-ci.yml");
  assert.match(workflow, /image:\s*postgres:17(?:\s|$)/);
  for (const command of [
    "npm run assets:check",
    "npm run lfs:check",
    "npm run lint",
    "npm run typecheck",
    "npm run test:qr:node",
    "npm run test:qr:postgres",
    "npm run test:qr:functional",
    "npm run build",
    "npm run test:smoke"
  ]) {
    assert.match(workflow, new RegExp(`run:\\s*${command.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}`));
  }
});
