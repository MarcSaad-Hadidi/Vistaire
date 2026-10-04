import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import test from "node:test";

async function runRunner(env) {
  const previousArgv = process.argv;
  const previousSpawn = childProcess.spawnSync;
  const keys = ["CI", "PGDATABASE", "VISTAIRE_QR_POSTGRES_TEST"];
  const previousEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const calls = [];
  try {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, env);
    process.argv = [process.execPath, "run-postgres-tests.mjs", "qr"];
    childProcess.spawnSync = (command, args) => {
      calls.push({ command, args });
      return { status: 0, stdout: args.includes("--command") ? "170010\n" : "", stderr: "" };
    };
    syncBuiltinESMExports();
    await import(new URL("../scripts/run-postgres-tests.mjs?case=" + Math.random(), import.meta.url));
    return calls;
  } finally {
    childProcess.spawnSync = previousSpawn;
    syncBuiltinESMExports();
    process.argv = previousArgv;
    for (const key of keys) {
      if (previousEnv[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[key];
    }
  }
}

test("the consolidated QR runner checks PostgreSQL then runs lifecycle and permanence migrations in order", async () => {
  const calls = await runRunner({ PGDATABASE: "vistaire_test", VISTAIRE_QR_POSTGRES_TEST: "1" });
  assert.equal(calls.length, 4);
  for (const call of calls) {
    assert.equal(call.command, "psql");
    assert.ok(call.args.includes("--set=ON_ERROR_STOP=1"));
    assert.ok(call.args.includes("--no-psqlrc"));
  }
  assert.ok(calls[0].args.includes("select current_setting('server_version_num');"));
  const files = calls.slice(1).map(({ args }) => path.relative(process.cwd(), args.at(-1)).replaceAll("\\", "/"));
  assert.deepEqual(files, [
    "tests/postgres/qr-lifecycle/run.sql",
    "supabase/migrations/20260717120000_owner_qr_canonical_lifecycle.sql",
    "supabase/migrations/20260805090000_enforce_public_qr_permanence.sql"
  ]);
});

test("the consolidated runner refuses missing opt-in and unsafe database names before invoking psql", async () => {
  await assert.rejects(runRunner({ PGDATABASE: "vistaire_test" }), /Refusing.*outside CI/);
  await assert.rejects(
    runRunner({ PGDATABASE: "vistaire_production", VISTAIRE_QR_POSTGRES_TEST: "1" }),
    /PGDATABASE must clearly identify a dedicated test or CI database/
  );
});
