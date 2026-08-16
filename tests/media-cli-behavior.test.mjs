import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

function runScript(script, args, env = {}) {
  return spawnSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      WINDIR: process.env.WINDIR,
      ...env
    },
    timeout: 3_000,
    windowsHide: true
  });
}

test("backfill rejects invalid numeric CLI before provider setup with a versioned measure envelope", () => {
  for (const option of [
    "--concurrency=NaN",
    "--concurrency=2.5",
    "--limit=0",
    "--verify-max-objects=Infinity",
    "--verify-max-bytes=-1",
    "--verify-timeout-ms=999"
  ]) {
    const result = runScript("scripts/backfill-dish-photo-derivatives.mjs", ["--measure-only", option]);
    assert.notEqual(result.status, 0, `${option}: ${result.stderr}`);
    const report = JSON.parse(result.stdout);
    assert.equal(report.reportSchemaVersion, 1);
    assert.equal(report.reportVersion, 1);
    assert.equal(report.status, "fail");
    assert.equal(report.pass, false);
    assert.ok(report.errors[0].includes(option.split("=")[0]));
    assert.doesNotMatch(report.errors[0], /SUPABASE_SERVICE_ROLE_KEY/);
  }
});

test("usage audit rejects hosted project-ref mismatch and missing hosted opt-in before network access", () => {
  const common = {
    NEXT_PUBLIC_SUPABASE_URL: "https://hosted-project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "not-a-real-service-role-key"
  };
  const mismatch = runScript("scripts/supabase-usage-audit.mjs", ["--json"], {
    ...common,
    VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF: "different-project"
  });
  assert.notEqual(mismatch.status, 0);
  assert.equal(mismatch.signal, null, mismatch.stderr);
  assert.match(JSON.parse(mismatch.stdout).errors[0], /project ref.*different|different.*project ref/i);

  const noOptIn = runScript("scripts/supabase-usage-audit.mjs", ["--json"], {
    ...common,
    VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF: "hosted-project"
  });
  assert.notEqual(noOptIn.status, 0);
  assert.equal(noOptIn.signal, null, noOptIn.stderr);
  assert.match(JSON.parse(noOptIn.stdout).errors[0], /allow-production-read/);
});

test("usage audit rejects invalid numeric CLI before provider setup with a versioned JSON envelope", () => {
  for (const option of [
    "--storage-limit=49",
    "--storage-limit=1001",
    "--concurrency=0",
    "--verify-max-objects=1.5",
    "--verify-max-bytes=NaN",
    "--verify-timeout-ms=60001"
  ]) {
    const result = runScript("scripts/supabase-usage-audit.mjs", ["--json", option]);
    assert.notEqual(result.status, 0, `${option}: ${result.stderr}`);
    const report = JSON.parse(result.stdout);
    assert.equal(report.reportVersion, 2);
    assert.equal(report.status, "unavailable");
    assert.equal(report.pass, false);
    assert.ok(report.errors[0].includes(option.split("=")[0]));
    assert.doesNotMatch(report.errors[0], /SUPABASE_SERVICE_ROLE_KEY/);
  }
});
