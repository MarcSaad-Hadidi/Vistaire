import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

function runScript(script, args) {
  return spawnSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      WINDIR: process.env.WINDIR
    },
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
    assert.equal(report.reportVersion, 1);
    assert.equal(report.status, "fail");
    assert.equal(report.pass, false);
    assert.ok(report.errors[0].includes(option.split("=")[0]));
    assert.doesNotMatch(report.errors[0], /SUPABASE_SERVICE_ROLE_KEY/);
  }
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
