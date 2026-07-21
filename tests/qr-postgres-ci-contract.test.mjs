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
  assert.match(runner, /20260717120000_owner_qr_canonical_lifecycle\.sql/);
  assert.match(runner, /spawnSync\("psql"/);
  assert.match(runner, /VISTAIRE_QR_POSTGRES_TEST/);
  assert.match(runner, /server_version_num/);
  assert.match(runner, /tests\/postgres\/qr-lifecycle\/run\.sql/);
  assert.ok(
    runner.indexOf("tests/postgres/qr-lifecycle/run.sql") <
      runner.lastIndexOf("20260717120000_owner_qr_canonical_lifecycle.sql"),
    "the blocking SQL suite must run before the explicit rerun of the production migration"
  );
});

test("the PostgreSQL fixture supplies the minimal Supabase storage bucket contract", async () => {
  const bootstrap = await source("tests/postgres/qr-lifecycle/bootstrap.sql");

  assert.match(bootstrap, /create schema if not exists storage/);
  assert.match(bootstrap, /create table if not exists storage\.buckets/);
  for (const column of ["id", "name", "public", "file_size_limit", "allowed_mime_types", "updated_at"]) {
    assert.match(bootstrap, new RegExp(`\\b${column}\\b`));
  }
});

test("the retained PostgreSQL fixture uses the versioned rotation RPC", async () => {
  const fixture = await source("tests/fixtures/qr-postgres-assertions.sql");
  const modernSignature =
    "owner_rotate_canonical_qr(uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,jsonb,boolean,text,uuid,integer)";

  assert.match(fixture, new RegExp(modernSignature.replace(/[()]/g, "\\$&")));
  assert.doesNotMatch(
    fixture,
    /owner_rotate_canonical_qr\(uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,jsonb,boolean\)/
  );
  assert.match(
    fixture,
    /true,\s*'keep-active',\s*'42000000-0000-4000-8000-000000000002',\s*1/
  );
});

test("App CI supplies PostgreSQL 17 and uses the hermetic bootstrap smoke gate", async () => {
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
    "npm run test:smoke:bootstrap"
  ]) {
    assert.match(workflow, new RegExp(`run:\\s*${command.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}`));
  }
  assert.doesNotMatch(workflow, /^\s*run:\s*npm run test:smoke\s*$/m);
});
