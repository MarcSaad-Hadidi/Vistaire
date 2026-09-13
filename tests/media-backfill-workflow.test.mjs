import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/media-backfill.yml", import.meta.url), "utf8");
const canary = "11111111-1111-4111-8111-111111111111";
const privateMarker = "PRIVATE_REPORT_SENTINEL";
const stageNames = {
  inventory: "Run read-only dry-run inventory",
  measure: "Measure exact derivative capacity before apply",
  apply: "Apply measured derivative backfill",
  verify: "Verify derivative metadata and Storage objects after apply"
};

// Execute the actual inline Bash/Node from the Linux Actions workflow, not a
// second implementation of its guards. Only the provider-facing command is fake.
function step(name) {
  const block = workflow.split(/^      - name: /m).find((part) => part.startsWith(`${name}\n`));
  assert.ok(block, `Missing workflow step: ${name}`);
  const body = block.match(/^        run: \|\n([\s\S]*)/m);
  assert.ok(body, `Missing literal run block: ${name}`);
  return { block, script: body[1].split("\n").map((line) => line.replace(/^ {10}/, "")).join("\n") };
}

function runStep(name, env = {}, cwd) {
  const result = spawnSync("bash", ["--noprofile", "--norc", "-c", step(name).script], {
    encoding: "utf8", timeout: 10000, cwd,
    env: {
      PATH: process.env.PATH, SystemRoot: process.env.SystemRoot ?? "", HOME: os.tmpdir(),
      BACKFILL_MODE: "dry-run", BACKFILL_CONFIRMATION: "", CANARY_RESTAURANT_ID: "",
      VISTAIRE_MEDIA_BACKFILL_ALLOW_APPLY: "0", VISTAIRE_MEDIA_WRITES_ENABLED: "false",
      ...env
    }
  });
  assert.ifError(result.error);
  return result;
}

function fixture(t) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "vistaire-backfill-workflow-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bin = path.join(dir, "bin");
  const reports = path.join(dir, "reports");
  mkdirSync(bin); mkdirSync(reports, { mode: 0o700 });
  const provider = path.join(dir, "provider.mjs");
  writeFileSync(provider, `import { writeFileSync } from 'node:fs';
writeFileSync(process.env.INVOCATION_CAPTURE, JSON.stringify({ args: process.argv.slice(2),
  applyOptIn: process.env.VISTAIRE_MEDIA_BACKFILL_ALLOW_APPLY,
  writesEnabled: process.env.VISTAIRE_MEDIA_WRITES_ENABLED }));
console.log(process.env.STUB_REPORT);
console.error(${JSON.stringify(privateMarker)});
process.exitCode = Number(process.env.STUB_EXIT || 0);
`);
  const executable = JSON.stringify(process.execPath.replaceAll("\\", "/"));
  writeFileSync(path.join(bin, "node"), `#!/bin/sh\nif [ "$1" = "scripts/backfill-dish-photo-derivatives.mjs" ]; then\n  exec ${executable} "$PROVIDER_FIXTURE" "$@"\nfi\nexec ${executable} "$@"\n`);
  chmodSync(path.join(bin, "node"), 0o755);
  return { dir, env: {
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    REPORT_DIR: reports, PROVIDER_FIXTURE: provider,
    INVOCATION_CAPTURE: path.join(dir, "invocation.json"),
    CANARY_RESTAURANT_ID: canary, BACKFILL_MODE: "apply",
    VISTAIRE_MEDIA_BACKFILL_ALLOW_APPLY: "1", VISTAIRE_MEDIA_WRITES_ENABLED: "true",
    STUB_REPORT: JSON.stringify({ status: "pass", pass: true, rowCount: 1, sourceCount: 1,
      uniqueAdditionalBytes: 100, headroomAfterPercent: 35,
      rows: [{ storagePath: privateMarker }], reasons: [privateMarker] })
  } };
}

function runStage(name, f, overrides = {}) {
  const env = { ...f.env, ...overrides };
  // Honour literal per-step environment overrides as Actions does. Defaults
  // deliberately simulate enabled repository flags to catch accidental inheritance.
  for (const key of ["VISTAIRE_MEDIA_BACKFILL_ALLOW_APPLY", "VISTAIRE_MEDIA_WRITES_ENABLED"]) {
    const literal = step(name).block.match(new RegExp(`^          ${key}: "([^"]*)"$`, "m"));
    if (literal) env[key] = literal[1];
  }
  return runStep(name, env, f.dir);
}

function assertPrivate(result) {
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(privateMarker));
}

test("backfill exposes independent read-only modes and never routes them to apply", () => {
  for (const mode of ["dry-run", "apply", "measure-only", "verify-only"]) {
    assert.match(workflow, new RegExp(`^          - ${mode}$`, "m"));
  }
  assert.match(step(stageNames.measure).block, /if:.*inputs\.mode == 'apply'.*inputs\.mode == 'measure-only'/);
  assert.match(step(stageNames.verify).block, /if:.*inputs\.mode == 'apply'.*inputs\.mode == 'verify-only'/);
  assert.match(step(stageNames.apply).block, /if: \$\{\{ inputs\.mode == 'apply' \}\}/);
  assert.doesNotMatch(step(stageNames.apply).block, /measure-only|verify-only/);
});

for (const mode of ["dry-run", "measure-only", "verify-only"]) {
  test(`${mode} does not require production write opt-ins`, () => {
    const result = runStep("Validate trusted manual request", { BACKFILL_MODE: mode,
      CANARY_RESTAURANT_ID: mode === "dry-run" ? "" : canary });
    assert.equal(result.status, 0, result.stderr);
  });
}

test("scoped modes reject absent or malformed canaries without echoing input", () => {
  for (const mode of ["measure-only", "verify-only", "apply"]) {
    for (const id of ["", privateMarker, `${canary};echo ${privateMarker}`]) {
      const result = runStep("Validate trusted manual request", { BACKFILL_MODE: mode, CANARY_RESTAURANT_ID: id });
      assert.notEqual(result.status, 0, `${mode} must reject invalid scope`);
      assertPrivate(result);
    }
  }
});

test("apply requires every independent guard and rejects unknown modes", () => {
  const approved = { BACKFILL_MODE: "apply", CANARY_RESTAURANT_ID: canary,
    BACKFILL_CONFIRMATION: "APPLY-DISH-PHOTO-BACKFILL",
    VISTAIRE_MEDIA_BACKFILL_ALLOW_APPLY: "1", VISTAIRE_MEDIA_WRITES_ENABLED: "true" };
  assert.equal(runStep("Validate trusted manual request", approved).status, 0);
  for (const key of ["BACKFILL_CONFIRMATION", "VISTAIRE_MEDIA_BACKFILL_ALLOW_APPLY", "VISTAIRE_MEDIA_WRITES_ENABLED"]) {
    assert.notEqual(runStep("Validate trusted manual request", { ...approved, [key]: "" }).status, 0, key);
  }
  assert.notEqual(runStep("Validate trusted manual request", { ...approved, BACKFILL_MODE: privateMarker }).status, 0);
});

for (const [stage, name] of Object.entries(stageNames)) {
  test(`${stage} preserves scope, guards and private command output`, (t) => {
    const f = fixture(t);
    const result = runStage(name, f);
    assert.equal(result.status, 0, result.stderr);
    assertPrivate(result);
    const invocation = JSON.parse(readFileSync(f.env.INVOCATION_CAPTURE, "utf8"));
    assert.ok(invocation.args.includes(`--restaurant-id=${canary}`));
    if (stage === "apply") {
      assert.equal(invocation.applyOptIn, "1");
      assert.equal(invocation.writesEnabled, "true");
      assert.ok(invocation.args.includes(`--measure-report=${f.env.REPORT_DIR}/measure.json`));
    } else {
      assert.equal(invocation.applyOptIn, "0");
      assert.equal(invocation.writesEnabled, "false");
      assert.ok(!invocation.args.includes("--apply"));
    }
    if (stage === "verify") assert.ok(invocation.args.includes("--verify-hash"));
  });
  test(`${stage} fails closed without publishing provider diagnostics`, (t) => {
    const f = fixture(t);
    const result = runStage(name, f, { STUB_EXIT: "7" });
    assert.notEqual(result.status, 0);
    assertPrivate(result);
    const stderrFile = stage === "inventory" ? "dry-run.stderr" : `${stage}.stderr`;
    assert.match(readFileSync(path.join(f.env.REPORT_DIR, stderrFile), "utf8"), new RegExp(privateMarker));
  });
}

test("measure report rejects malformed, empty, failed and unsafe summaries without leaking them", (t) => {
  const f = fixture(t);
  const valid = JSON.parse(f.env.STUB_REPORT);
  for (const report of [privateMarker, JSON.stringify({ ...valid, pass: false }),
    JSON.stringify({ ...valid, rowCount: 0 }), JSON.stringify({ ...valid, sourceCount: 0 }),
    JSON.stringify({ ...valid, uniqueAdditionalBytes: privateMarker }),
    JSON.stringify({ ...valid, headroomAfterPercent: 19 })]) {
    const result = runStage(stageNames.measure, f, { STUB_REPORT: report });
    assert.notEqual(result.status, 0);
    assertPrivate(result);
  }
});

test("production URL validation is exact and does not print malformed inputs", () => {
  const ref = "abcdefghijklmnopqrst";
  const env = { VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF: ref,
    SUPABASE_SERVICE_ROLE_KEY: privateMarker, NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co` };
  assert.equal(runStep("Validate configured Supabase production target", env).status, 0);
  for (const url of [privateMarker, `http://${ref}.supabase.co`, `https://${privateMarker}@${ref}.supabase.co`,
    `https://${ref}.supabase.co/${privateMarker}`, `https://${ref}.supabase.co?token=${privateMarker}`,
    "https://another-project.supabase.co"]) {
    const result = runStep("Validate configured Supabase production target", { ...env, NEXT_PUBLIC_SUPABASE_URL: url });
    assert.notEqual(result.status, 0);
    assertPrivate(result);
  }
});

test("summary distinguishes requested apply from read-only work and actual step outcomes", (t) => {
  const f = fixture(t);
  for (const mode of ["dry-run", "measure-only", "verify-only", "apply"]) {
    const summary = path.join(f.dir, `summary-${mode}.md`);
    const result = runStep("Publish execution summary", { BACKFILL_MODE: mode,
      GITHUB_REF: "refs/heads/main", GITHUB_SHA: "a".repeat(40), GITHUB_STEP_SUMMARY: summary,
      INVENTORY_OUTCOME: "skipped", MEASURE_OUTCOME: "failure", APPLY_OUTCOME: "skipped", VERIFY_OUTCOME: "skipped" });
    assert.equal(result.status, 0, result.stderr);
    const text = readFileSync(summary, "utf8");
    assert.match(text, new RegExp(`Production writes requested: ${mode === "apply" ? "yes" : "no"}`));
    assert.match(text, /Apply step: skipped/);
  }
});

test("private reports are not uploaded and cleanup refuses paths outside its own directory", (t) => {
  assert.doesNotMatch(workflow, /\|\s*tee|actions\/upload-artifact|continue-on-error|\|\|\s*true/);
  const f = fixture(t);
  const owned = path.join(f.dir, "vistaire-dish-photo-backfill.123456");
  mkdirSync(owned);
  assert.equal(runStep("Remove ephemeral reports", { RUNNER_TEMP: f.dir, REPORT_DIR: owned }).status, 0);
  assert.equal(existsSync(owned), false);
  assert.equal(runStep("Remove ephemeral reports", { RUNNER_TEMP: f.dir, REPORT_DIR: f.env.REPORT_DIR }).status, 0);
  assert.equal(existsSync(f.env.REPORT_DIR), true);
});
