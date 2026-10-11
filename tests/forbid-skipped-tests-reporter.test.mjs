import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";

const reporterUrl = new URL("../e2e/support/forbid-skipped-tests-reporter.ts", import.meta.url);
registerHooks({
  load(url, context, nextLoad) {
    if (url !== reporterUrl.href) return nextLoad(url, context);
    return {
      format: "module",
      source: ts.transpileModule(readFileSync(reporterUrl, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
      }).outputText,
      shortCircuit: true
    };
  }
});
const { default: ForbidSkippedTestsReporter } = await import(reporterUrl.href);

test("reporter counts final timeouts as failures while preserving retries and other statuses", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "vistaire-reporter-"));
  const outputPath = join(directory, "counts.json");
  const previousPath = process.env.CI_TEST_REPORT_PATH;
  t.after(async () => {
    if (previousPath === undefined) delete process.env.CI_TEST_REPORT_PATH;
    else process.env.CI_TEST_REPORT_PATH = previousPath;
    await rm(directory, { recursive: true, force: true });
  });
  process.env.CI_TEST_REPORT_PATH = outputPath;
  const errors = [];
  t.mock.method(console, "error", (message) => errors.push(message));
  const reporter = new ForbidSkippedTestsReporter();
  const cases = {
    passed: ["passed"],
    failed: ["failed"],
    timedOut: ["timedOut"],
    skipped: ["skipped"],
    interrupted: ["interrupted"],
    recoveredTimeout: ["timedOut", "passed"],
    finalTimeout: ["failed", "timedOut"],
    finalFailure: ["timedOut", "failed"]
  };
  for (const [id, statuses] of Object.entries(cases)) {
    const testCase = { id, expectedStatus: "passed", titlePath: () => ["suite", id] };
    statuses.forEach((status, retry) => reporter.onTestEnd(testCase, { status, retry }));
  }

  assert.deepEqual(await reporter.onEnd(), { status: "failed" });
  assert.deepEqual(JSON.parse(await readFile(outputPath, "utf8")), {
    total: 8, passed: 1, failed: 4, skipped: 1, flaky: 1, interrupted: 1
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /must not skip tests:\n- suite > skipped/);
});
