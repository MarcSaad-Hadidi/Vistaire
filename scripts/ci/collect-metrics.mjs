#!/usr/bin/env node

/**
 * Collect a machine readable summary of the current Actions run.
 *
 * This module deliberately only reports facts available from the completed
 * Jobs API payload (and structured reports supplied by a caller).  In
 * particular, an in-progress job is never treated as a failure and a missing
 * test report is never represented by a misleading null value.
 */

import { readFile, writeFile } from "node:fs/promises";

export class MetricsConsistencyError extends Error {
  constructor(message) {
    super(message);
    this.name = "MetricsConsistencyError";
  }
}

const TERMINAL_RESULTS = new Set([
  "success", "failure", "cancelled", "skipped", "timed_out", "action_required",
  "neutral", "stale"
]);
const IN_PROGRESS_STATUSES = new Set(["queued", "in_progress", "waiting", "requested", "pending"]);
const RUN_OUTPUTS = [
  "run_static", "run_database", "run_build", "run_core", "run_landing",
  "run_menu", "run_sauge", "run_admin_qr", "run_seo", "run_webkit"
];
const ORDERED_JOBS = [
  "classify-changes", "fast-gate", "static-quality", "database-contracts",
  "build-app", "e2e-public-chromium", "e2e-sauge-chromium",
  "e2e-admin-qr-chromium", "webkit-critical", "CI Gate"
];

const expectedFromEnv = (env) => ({
  "fast-gate": env.CLASSIFY_RESULT === "success",
  "static-quality": env.RUN_STATIC === "true",
  "database-contracts": env.RUN_DATABASE === "true",
  "build-app": env.RUN_BUILD === "true",
  "e2e-public-chromium": [env.RUN_CORE, env.RUN_LANDING, env.RUN_MENU, env.RUN_SEO].some((value) => value === "true"),
  "e2e-sauge-chromium": env.RUN_SAUGE === "true",
  "e2e-admin-qr-chromium": env.RUN_ADMIN_QR === "true",
  "webkit-critical": env.RUN_WEBKIT === "true"
});

function isCollector(job, collectorName) {
  const name = String(job?.name ?? "").trim().toLowerCase();
  return name === String(collectorName ?? "ci metrics").trim().toLowerCase() ||
    name === "ci-metrics" || name === "ci metrics";
}

function isCompleted(job) {
  return String(job?.status ?? "").toLowerCase() === "completed" ||
    TERMINAL_RESULTS.has(String(job?.conclusion ?? "").toLowerCase());
}

function secondsBetween(start, end) {
  if (!start || !end) return undefined;
  const value = (Date.parse(end) - Date.parse(start)) / 1000;
  return Number.isFinite(value) && value >= 0 ? Number(value.toFixed(3)) : undefined;
}

function sum(values) {
  return Number(values.filter(Number.isFinite).reduce((total, value) => total + value, 0).toFixed(3));
}

function matchStep(step, pattern) {
  return pattern.test(String(step?.name ?? ""));
}

function stepMetrics(job) {
  const steps = Array.isArray(job?.steps) ? job.steps : [];
  // These names cover both `run: npm ci` and named install steps.  Keep the
  // patterns intentionally narrow so an `npm ci` mentioned in prose is not
  // counted as an installation.
  const npmPattern = /^(?:run\s+)?npm\s+ci$/i;
  const installPattern = /^(?:install dependencies|install trusted smoke dependencies)$/i;
  const npm = steps.filter((step) => matchStep(step, npmPattern) || matchStep(step, installPattern));
  const browser = steps.filter((step) => /playwright\s+install/i.test(String(step?.name ?? "")));
  const artifact = steps.filter((step) => /download(?:-artifact| verified next\.js build)/i.test(String(step?.name ?? "")));
  const upload = steps.filter((step) => /upload verified next\.js build/i.test(String(step?.name ?? "")));
  const graph = steps.filter((step) => /fetch minimal PR graph/i.test(String(step?.name ?? "")));
  const checkout = job?.name === "classify-changes" ? steps.filter((step) => /^checkout$/i.test(String(step?.name ?? ""))) : [];
  const tests = steps.filter((step) => /(?:npm run test|run .*test|browser smoke)/i.test(String(step?.name ?? "")));
  const duration = (list) => sum(list.map((step) => secondsBetween(step.started_at, step.completed_at)));
  return {
    npm_ci: npm,
    browser_setup: browser,
    artifact_download: artifact,
    next_upload: upload,
    graph_fetch: graph,
    classifier_checkout: checkout,
    test_steps: tests,
    npm_ci_seconds: duration(npm),
    browser_setup_seconds: duration(browser),
    artifact_download_seconds: duration(artifact),
    next_upload_seconds: duration(upload),
    graph_fetch_seconds: duration(graph),
    classifier_checkout_seconds: duration(checkout)
  };
}

function normalizeJob(job, expected) {
  const status = String(job?.status ?? (job?.conclusion ? "completed" : "unknown"));
  const result = String(job?.conclusion ?? job?.status ?? "unknown").toLowerCase();
  const completed = isCompleted(job);
  const duration = completed ? secondsBetween(job?.started_at, job?.completed_at) : undefined;
  const normalized = {
    name: String(job?.name ?? "unknown"),
    id: job?.id,
    result,
    status,
    expected: expected[String(job?.name ?? "")],
    steps: stepMetrics(job)
  };
  for (const [key, value] of Object.entries({
    started_at: job?.started_at,
    completed_at: job?.completed_at,
    duration_seconds: duration,
    runner_minutes_billed_estimate: duration === undefined ? undefined : Math.ceil(duration / 60)
  })) if (value !== undefined && value !== null) normalized[key] = value;
  return normalized;
}

function parseXmlAttributes(text, tag) {
  const match = String(text).match(new RegExp(`<${tag}\\b([^>]*)>`, "i"));
  if (!match) return {};
  return Object.fromEntries([...match[1].matchAll(/([\w-]+)=["']([^"']*)["']/g)].map((item) => [item[1], item[2]]));
}

function countStructuredReport(report) {
  if (report === undefined || report === null) return undefined;
  if (typeof report === "string") {
    const text = report.trim().replace(/^\uFEFF/, "");
    if (text.startsWith("<")) {
      const suites = [...text.matchAll(/<testsuite\b([^>]*)>/gi)].map((match) => Object.fromEntries([...match[1].matchAll(/([\w-]+)=["']([^"']*)["']/g)].map((item) => [item[1], item[2]])));
      const values = suites.length ? suites : [parseXmlAttributes(text, "testsuites")];
      const number = (item, ...keys) => {
        for (const key of keys) if (Number.isFinite(Number(item?.[key]))) return Number(item[key]);
        return 0;
      };
      const totals = values.reduce((result, item) => {
        result.total += number(item, "tests", "total");
        result.failed += number(item, "failures") + number(item, "errors");
        result.skipped += number(item, "skipped");
        result.flaky += number(item, "flaky", "flaky_tests");
        result.interrupted += number(item, "interrupted", "interrupted_tests", "cancelled", "canceled");
        return result;
      }, { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0, interrupted: 0 });
      const commentCount = (name) => {
        const match = text.match(new RegExp(`<!--\\s*${name}\\s+(\\d+)`, "i"));
        return match ? Number(match[1]) : undefined;
      };
      const pass = commentCount("pass");
      const fail = commentCount("fail");
      const skip = commentCount("skipped");
      const interrupted = commentCount("cancelled") ?? commentCount("canceled");
      if (pass !== undefined) totals.passed = pass;
      if (fail !== undefined) totals.failed = fail;
      if (skip !== undefined) totals.skipped = skip;
      if (interrupted !== undefined) totals.interrupted = interrupted;
      if (totals.total === 0) totals.total = (text.match(/<testcase\b/gi) ?? []).length;
      if (totals.passed === 0 && totals.total > 0) {
        totals.passed = Math.max(0, totals.total - totals.failed - totals.skipped - totals.flaky - totals.interrupted);
      }
      return totals;
    }
    try { return countStructuredReport(JSON.parse(text)); } catch { return undefined; }
  }
  if (typeof report !== "object") return undefined;
  const stats = report.stats ?? report.summary ?? report;
  const number = (...keys) => {
    for (const key of keys) if (Number.isFinite(Number(stats?.[key]))) return Number(stats[key]);
    return 0;
  };
  const hasCounts = ["expected", "total", "passed", "failed", "unexpected", "skipped", "flaky", "interrupted"].some((key) => stats?.[key] !== undefined);
  if (hasCounts) {
    const failed = number("failed", "unexpected", "failures", "errors");
    const skipped = number("skipped");
    const flaky = number("flaky", "flaky_tests");
    const interrupted = number("interrupted", "interrupted_tests");
    // Playwright's `expected` is the passed count, not the full test count.
    // Derive the total when a reporter does not emit an explicit `total`.
    const total = Number.isFinite(Number(stats?.total))
      ? Number(stats.total)
      : number("expected", "tests") + failed + skipped + flaky + interrupted;
    const passed = number("passed") || Math.max(0, total - failed - skipped - flaky - interrupted);
    return { total, passed, failed, skipped, flaky, interrupted };
  }
  const entries = Array.isArray(report.tests) ? report.tests : Array.isArray(report.testResults) ? report.testResults : undefined;
  if (!entries) return undefined;
  const totals = { total: entries.length, passed: 0, failed: 0, skipped: 0, flaky: 0, interrupted: 0 };
  for (const entry of entries) {
    const status = String(entry?.status ?? entry?.outcome ?? entry?.state ?? "").toLowerCase();
    if (entry?.flaky || status === "flaky") totals.flaky++;
    else if (["passed", "pass", "success", "expected"].includes(status)) totals.passed++;
    else if (["skipped", "skip"].includes(status)) totals.skipped++;
    else if (["interrupted", "cancelled", "canceled", "timedout", "timeout"].includes(status)) totals.interrupted++;
    else totals.failed++;
  }
  return totals;
}

function reportFromJob(job) {
  for (const key of ["test_report", "testReport", "structured_report", "structuredReport", "report"]) {
    const parsed = countStructuredReport(job?.[key]);
    if (parsed) return parsed;
  }
  for (const step of Array.isArray(job?.steps) ? job.steps : []) {
    const parsed = countStructuredReport(step?.test_report ?? step?.report);
    if (parsed) return parsed;
  }
  return undefined;
}

function aggregateReports(jobs) {
  const reports = jobs.map(reportFromJob).filter(Boolean);
  if (!reports.length) return { totals: undefined, sources: 0 };
  const totals = reports.reduce((all, report) => {
    for (const key of ["total", "passed", "failed", "skipped", "flaky", "interrupted"]) all[key] += Number(report[key]) || 0;
    return all;
  }, { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0, interrupted: 0 });
  if (totals.passed + totals.failed + totals.skipped + totals.flaky + totals.interrupted > totals.total) {
    throw new MetricsConsistencyError("structured test totals exceed reported test total");
  }
  return { totals, sources: reports.length };
}

async function readStructuredReportFiles(value) {
  const paths = String(value ?? "").split(/[;,]/).map((item) => item.trim()).filter(Boolean);
  const reports = [];
  for (const path of paths) {
    try {
      const parsed = countStructuredReport(await readFile(path, "utf8"));
      if (parsed) reports.push(parsed);
    } catch {
      // A missing optional report is recorded as unavailable by the caller.
    }
  }
  if (!reports.length) return undefined;
  return reports.reduce((all, report) => {
    for (const key of ["total", "passed", "failed", "skipped", "flaky", "interrupted"]) all[key] += Number(report[key]) || 0;
    return all;
  }, { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0, interrupted: 0 });
}

function parseStructuredReports(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    const reports = {};
    for (const [name, payload] of Object.entries(parsed ?? {})) {
      const raw = payload?.outputs?.test_report ?? payload?.test_report;
      if (!raw) continue;
      try {
        reports[name] = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        // Keep malformed reports unavailable; collection quality will surface
        // the missing structured data instead of inventing test totals.
      }
    }
    return reports;
  } catch {
    return {};
  }
}

export function analyzeJobs(rawJobs, { collectorName = "CI metrics", expected = {}, reportsByJob = {} } = {}) {
  if (!Array.isArray(rawJobs)) throw new MetricsConsistencyError("GitHub Jobs response did not contain a jobs array");
  const sourceJobs = rawJobs
    .filter((job) => !isCollector(job, collectorName))
    .map((job) => {
      const report = reportsByJob[String(job?.name ?? "")];
      return report ? { ...job, test_report: report } : job;
    });
  for (const job of sourceJobs) {
    if (String(job?.status ?? "").toLowerCase() === "completed" &&
        !TERMINAL_RESULTS.has(String(job?.conclusion ?? "").toLowerCase())) {
      throw new MetricsConsistencyError(`completed job ${String(job?.name ?? "unknown")} has no terminal conclusion`);
    }
    const status = String(job?.status ?? "").toLowerCase();
    if (!isCompleted(job) && !IN_PROGRESS_STATUSES.has(status)) {
      throw new MetricsConsistencyError(`job ${String(job?.name ?? "unknown")} has an unknown status`);
    }
  }
  const jobs = sourceJobs.map((job) => normalizeJob(job, expected)).sort((left, right) => {
    const leftIndex = ORDERED_JOBS.indexOf(left.name);
    const rightIndex = ORDERED_JOBS.indexOf(right.name);
    return (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex) || left.name.localeCompare(right.name);
  });
  const completed = sourceJobs.filter(isCompleted);
  const inProgress = sourceJobs.filter((job) => !isCompleted(job));
  const result = (job) => String(job?.conclusion ?? job?.status ?? "unknown").toLowerCase();
  const names = (list) => list.map((job) => String(job.name ?? "unknown"));
  const failed = completed.filter((job) => !["success", "cancelled", "skipped"].includes(result(job)));
  const cancelled = completed.filter((job) => result(job) === "cancelled");
  const skipped = completed.filter((job) => result(job) === "skipped");
  const starts = completed.map((job) => Date.parse(job.started_at ?? "")).filter(Number.isFinite);
  const ends = completed.map((job) => Date.parse(job.completed_at ?? "")).filter(Number.isFinite);
  const stepTotals = completed.reduce((totals, job) => {
    const metrics = stepMetrics(job);
    const stepLists = {
      npm_ci_count: metrics.npm_ci,
      browser_setup_count: metrics.browser_setup,
      artifact_download_count: metrics.artifact_download,
      next_upload_count: metrics.next_upload,
      test_step_count: metrics.test_steps
    };
    for (const [key, list] of Object.entries(stepLists)) totals[key] += list.length;
    for (const key of ["npm_ci_seconds", "browser_setup_seconds", "artifact_download_seconds", "next_upload_seconds", "graph_fetch_seconds", "classifier_checkout_seconds"]) totals[key] += metrics[key] ?? 0;
    return totals;
  }, { npm_ci_count: 0, browser_setup_count: 0, artifact_download_count: 0, next_upload_count: 0, test_step_count: 0, npm_ci_seconds: 0, browser_setup_seconds: 0, artifact_download_seconds: 0, next_upload_seconds: 0, graph_fetch_seconds: 0, classifier_checkout_seconds: 0 });
  const reports = aggregateReports(completed);
  const summary = {
    wall_clock_seconds: starts.length && ends.length ? Number(((Math.max(...ends) - Math.min(...starts)) / 1000).toFixed(3)) : undefined,
    runner_seconds: sum(completed.map((job) => secondsBetween(job.started_at, job.completed_at))),
    runner_minutes_billed_estimate: sum(completed.map((job) => { const d = secondsBetween(job.started_at, job.completed_at); return d === undefined ? undefined : Math.ceil(d / 60); })),
    failed_jobs: failed.length,
    failed_job_names: names(failed),
    cancelled_jobs: cancelled.length,
    cancelled_job_names: names(cancelled),
    skipped_jobs: skipped.length,
    skipped_job_names: names(skipped),
    jobs_in_progress: inProgress.length,
    jobs_in_progress_names: names(inProgress),
    jobs_expected: jobs.filter((job) => job.expected === true).map((job) => job.name),
    jobs_executed: completed.filter((job) => result(job) !== "skipped").map((job) => job.name),
    jobs_skipped: names(skipped)
  };
  if (reports.totals) {
    summary.failed_tests = reports.totals.failed;
    summary.test_report_sources = reports.sources;
  }
  return { jobs, completed, summary, timings: stepTotals, reports };
}

function omitUndefined(value) {
  if (Array.isArray(value)) return value.map(omitUndefined);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null).map(([key, item]) => [key, omitUndefined(item)]));
}

export async function collectMetrics({ env = process.env, fetchImpl = globalThis.fetch, write = writeFile } = {}) {
  const outputPath = env.CI_METRICS_OUTPUT ?? "ci-metrics.json";
  const repository = env.GITHUB_REPOSITORY ?? "";
  const runId = env.GITHUB_RUN_ID ?? "";
  const token = env.GITHUB_TOKEN ?? "";
  const capturedAt = new Date().toISOString();
  const baseUrl = `https://api.github.com/repos/${repository}/actions/runs/${runId}`;
  let jobsPayload;
  let artifactsPayload;
  let apiError;
  const warnings = [];
  const fieldsUnavailable = [];
  const reportsByJob = parseStructuredReports(env.CI_TEST_REPORTS_JSON);
  try {
    if (!repository || !runId || !token) throw new Error("repository, run id, or read token is missing");
    const request = async (url) => {
      const response = await fetchImpl(url, { headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "x-github-api-version": "2022-11-28", "user-agent": "vistoire-ci-metrics" } });
      if (!response?.ok) throw new Error(`GitHub API ${response?.status ?? "unknown"} for ${url}`);
      return response.json();
    };
    jobsPayload = await request(`${baseUrl}/jobs?per_page=100`);
    artifactsPayload = await request(`${baseUrl}/artifacts?name=next-build-${runId}&per_page=10`);
  } catch (error) {
    apiError = error instanceof Error ? error.message : String(error);
  }
  let analysis;
  if (apiError) {
    warnings.push("github_api_unavailable");
    fieldsUnavailable.push("jobs", "artifacts", "timings", "tests", "cache");
  } else {
    try { analysis = analyzeJobs(jobsPayload.jobs, { expected: expectedFromEnv(env), reportsByJob }); }
    catch (error) {
      if (!(error instanceof MetricsConsistencyError)) throw error;
      apiError = error.message;
      warnings.push("inconsistent_metrics");
    }
  }
  if (!analysis) fieldsUnavailable.push("summary", "timings");
  else if (!analysis.reports.totals && env.CI_TEST_REPORTS_JSON && !env.CI_TEST_REPORTS_JSON.trim().startsWith("{")) {
    const fileTotals = await readStructuredReportFiles(env.CI_TEST_REPORTS_JSON);
    if (fileTotals) analysis.reports = { totals: fileTotals, sources: fileTotals ? 1 : 0 };
  }
  if (analysis && !analysis.reports.totals) {
    const browserJobs = new Set(["e2e-public-chromium", "e2e-sauge-chromium", "e2e-admin-qr-chromium", "webkit-critical"]);
    const expectedBrowserJobs = analysis.summary.jobs_expected.filter((name) => browserJobs.has(name));
    if (expectedBrowserJobs.length === 0) {
      analysis.reports = {
        totals: { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0, interrupted: 0 },
        sources: 0
      };
    }
  }
  if (analysis && !analysis.reports.totals) {
    // A job conclusion is not a test result.  Keep test totals absent until a
    // JSON/JUnit report is available, and make the limitation machine-visible.
    warnings.push("structured_test_reports_unavailable");
    fieldsUnavailable.push("tests");
  }
  const output = omitUndefined({
    schema_version: 2,
    captured_at: capturedAt,
    repository,
    run_id: runId || undefined,
    head_sha: env.GITHUB_SHA,
    event: env.GITHUB_EVENT_NAME,
    classification: {
      result: env.CLASSIFY_RESULT,
      event: env.CLASSIFY_EVENT,
      categories: (env.CLASSIFY_CATEGORIES ?? "").split(",").filter(Boolean),
      reason: env.CLASSIFY_REASON,
      changed_files: (env.CLASSIFY_CHANGED_FILES ?? "").split(" ").filter(Boolean),
      merge_base_depth: env.MERGE_BASE_DEPTH ? Number(env.MERGE_BASE_DEPTH) : undefined
    },
    run_policy: Object.fromEntries(RUN_OUTPUTS.map((name) => [name, env[name.toUpperCase()] === "true"])),
    jobs: analysis?.jobs,
    summary: analysis?.summary,
    timings: analysis?.timings,
    artifact: artifactsPayload ? {
      next_build_size_bytes: artifactsPayload.artifacts?.[0]?.size_in_bytes,
      next_build_digest: artifactsPayload.artifacts?.[0]?.digest,
      next_build_upload_count: analysis?.timings.next_upload_count,
      next_build_download_count: analysis?.timings.artifact_download_count
    } : undefined,
    tests: analysis?.reports.totals ? { ...analysis.reports.totals, report_sources: analysis.reports.sources } : undefined,
    data_quality: {
      collection_complete: !apiError && fieldsUnavailable.length === 0,
      collection_warnings: warnings,
      fields_unavailable: [...new Set(fieldsUnavailable)]
    },
    preview_url: env.PREVIEW_URL,
    collection_error: apiError
  });
  await write(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  if (apiError && !warnings.includes("github_api_unavailable")) process.exitCode = 1;
  if (apiError) console.warn(`CI metrics collection incomplete: ${apiError}`);
  return output;
}

if (process.argv[1] && new URL(import.meta.url).pathname.toLowerCase() === process.argv[1].replaceAll("\\", "/").toLowerCase()) await collectMetrics();
