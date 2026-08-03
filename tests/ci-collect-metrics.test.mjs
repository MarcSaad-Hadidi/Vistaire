import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeJobs, collectMetrics, MetricsConsistencyError } from "../scripts/ci/collect-metrics.mjs";

const times = { started_at: "2026-08-03T10:00:00Z", completed_at: "2026-08-03T10:01:00Z" };
const job = (name, conclusion = "success", extra = {}) => ({ id: Math.random(), name, status: "completed", conclusion, ...times, steps: [], ...extra });

test("green run excludes the collector and reports zero job failures", () => {
  const result = analyzeJobs([
    job("classify-changes"),
    job("static-quality", "success", { steps: [{ name: "Install dependencies", ...times }] }),
    job("CI metrics", "failure", { status: "in_progress", completed_at: undefined }),
    job("e2e-public-chromium", "success", {
      steps: [{ name: "Run npm ci", ...times }, { name: "Playwright install", ...times }],
      test_report: { stats: { expected: 3, unexpected: 0, skipped: 0, flaky: 0 } }
    })
  ]);
  assert.equal(result.summary.failed_jobs, 0);
  assert.equal(result.summary.jobs_in_progress, 0);
  assert.equal(result.summary.failed_tests, 0);
  assert.equal(result.timings.npm_ci_count, 2);
  assert.equal(result.timings.browser_setup_count, 1);
});

test("in-progress jobs are tracked separately and never become failures", () => {
  const result = analyzeJobs([job("build-app", "", { status: "in_progress", conclusion: undefined, completed_at: undefined })]);
  assert.equal(result.summary.failed_jobs, 0);
  assert.equal(result.summary.jobs_in_progress, 1);
  assert.deepEqual(result.summary.jobs_in_progress_names, ["build-app"]);
});

test("failed, cancelled, and expected skipped jobs are distinguished", () => {
  const result = analyzeJobs([
    job("static-quality", "failure"),
    job("database-contracts", "cancelled"),
    job("e2e-public-chromium", "skipped")
  ], { expected: { "e2e-public-chromium": false } });
  assert.equal(result.summary.failed_jobs, 1);
  assert.equal(result.summary.cancelled_jobs, 1);
  assert.equal(result.summary.skipped_jobs, 1);
  assert.deepEqual(result.summary.failed_job_names, ["static-quality"]);
});

test("all supported install step names are counted", () => {
  const result = analyzeJobs([job("static-quality", "success", { steps: [
    { name: "npm ci", ...times },
    { name: "Run npm ci", ...times },
    { name: "Install dependencies", ...times },
    { name: "Install trusted smoke dependencies", ...times },
    { name: "npm ci mentioned in a note", ...times }
  ] })]);
  assert.equal(result.timings.npm_ci_count, 4);
});

test("Playwright JSON and JUnit reporters provide structured test totals", () => {
  const result = analyzeJobs([
    job("e2e-public-chromium", "success", { test_report: { stats: { expected: 4, unexpected: 1, skipped: 1, flaky: 1 } } }),
    job("static-quality", "success", { test_report: '<testsuite tests="3" failures="1" errors="0" skipped="1" flaky="1" />' })
  ]);
  assert.deepEqual(result.reports.totals, { total: 10, passed: 4, failed: 2, skipped: 2, flaky: 2, interrupted: 0 });
});

test("Node JUnit comments and workflow outputs are machine-readable", () => {
  const nodeJunit = `<?xml version="1.0"?><testsuites><testcase name="a"/><testcase name="b"/><testcase name="c"/><testcase name="d"/><testcase name="e"/><testcase name="f"/><testcase name="g"/><!-- tests 7 --><!-- pass 6 --><!-- fail 1 --><!-- cancelled 0 --><!-- skipped 0 --></testsuites>`;
  const result = analyzeJobs([
    job("e2e-public-chromium", "success")
  ], { reportsByJob: { "e2e-public-chromium": nodeJunit } });
  assert.deepEqual(result.reports.totals, { total: 7, passed: 6, failed: 1, skipped: 0, flaky: 0, interrupted: 0 });
});

test("inconsistent structured totals fail clearly", () => {
  assert.throws(() => analyzeJobs([job("e2e-public-chromium", "success", { test_report: { total: 1, passed: 2 } })]), MetricsConsistencyError);
});

test("incomplete GitHub API produces an explicit non-complete artifact", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vistoire-metrics-"));
  const outputPath = join(directory, "metrics.json");
  const env = { GITHUB_REPOSITORY: "example/repo", GITHUB_RUN_ID: "42", GITHUB_TOKEN: "token", CI_METRICS_OUTPUT: outputPath };
  const output = await collectMetrics({ env, fetchImpl: async () => ({ ok: false, status: 503 }) });
  assert.equal(output.data_quality.collection_complete, false);
  assert.deepEqual(output.data_quality.collection_warnings, ["github_api_unavailable"]);
  assert.equal(output.collection_error.includes("503"), true);
  assert.deepEqual(JSON.parse(await readFile(outputPath, "utf8")), output);
  await rm(directory, { recursive: true, force: true });
});
