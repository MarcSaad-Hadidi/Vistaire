#!/usr/bin/env node

/**
 * Collect a stable, machine-readable summary for the current Actions run.
 *
 * The collector runs in a separate, non-blocking job after CI Gate. It uses the
 * read-only Actions API rather than parsing human log output, so timings remain
 * comparable across runner images and job ordering is deterministic.
 */

import { writeFile } from "node:fs/promises";

const outputPath = process.env.CI_METRICS_OUTPUT ?? "ci-metrics.json";
const repository = process.env.GITHUB_REPOSITORY ?? "";
const runId = process.env.GITHUB_RUN_ID ?? "";
const token = process.env.GITHUB_TOKEN ?? "";

const RUN_OUTPUTS = [
  "run_static", "run_database", "run_build", "run_core", "run_landing",
  "run_menu", "run_sauge", "run_admin_qr", "run_seo", "run_webkit"
];

const expected = {
  "fast-gate": process.env.CLASSIFY_RESULT === "success",
  "static-quality": process.env.RUN_STATIC === "true",
  "database-contracts": process.env.RUN_DATABASE === "true",
  "build-app": process.env.RUN_BUILD === "true",
  "e2e-core": process.env.RUN_CORE === "true",
  "e2e-landing": process.env.RUN_LANDING === "true",
  "e2e-menu-shared": process.env.RUN_MENU === "true",
  "e2e-sauge-deep": process.env.RUN_SAUGE === "true",
  "e2e-admin-qr": process.env.RUN_ADMIN_QR === "true",
  "e2e-seo": process.env.RUN_SEO === "true",
  "webkit-critical": process.env.RUN_WEBKIT === "true"
};

const orderedJobNames = [
  "classify-changes", "fast-gate", "static-quality", "database-contracts",
  "build-app", "e2e-core", "e2e-landing", "e2e-menu-shared",
  "e2e-sauge-deep", "e2e-admin-qr", "e2e-seo", "webkit-critical", "CI Gate"
];

function secondsBetween(start, end) {
  if (!start || !end) return null;
  const value = (Date.parse(end) - Date.parse(start)) / 1000;
  return Number.isFinite(value) && value >= 0 ? Number(value.toFixed(3)) : null;
}

function sum(values) {
  return Number(values.filter((value) => Number.isFinite(value)).reduce((total, value) => total + value, 0).toFixed(3));
}

function booleanOutput(value) {
  return value === "true";
}

async function githubJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "x-github-api-version": "2022-11-28",
      "user-agent": "vistoire-ci-metrics"
    }
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status} for ${url}`);
  return response.json();
}

function stepMetrics(job) {
  const steps = Array.isArray(job.steps) ? job.steps : [];
  const matching = (pattern) => steps.filter((step) => pattern.test(String(step.name ?? "")));
  const duration = (pattern) => sum(matching(pattern).map((step) => secondsBetween(step.started_at, step.completed_at)));
  return {
    npm_ci: matching(/npm ci/i),
    browser_setup: matching(/playwright install/i),
    artifact_download: matching(/download(?:-artifact| verified next\.js build)/i),
    next_upload: matching(/Upload verified Next\.js build/i),
    graph_fetch: matching(/Fetch minimal PR graph/i),
    classifier_checkout: job.name === "classify-changes" ? matching(/^Checkout$/i) : [],
    test_steps: matching(/(?:npm run test|Run .*test|browser smoke)/i),
    npm_ci_seconds: duration(/npm ci/i),
    browser_setup_seconds: duration(/playwright install/i),
    artifact_download_seconds: duration(/download(?:-artifact| verified next\.js build)/i),
    next_upload_seconds: duration(/Upload verified Next\.js build/i),
    graph_fetch_seconds: duration(/Fetch minimal PR graph/i),
    classifier_checkout_seconds: job.name === "classify-changes" ? duration(/^Checkout$/i) : 0
  };
}

function normalizeJob(job) {
  const duration = secondsBetween(job.started_at, job.completed_at);
  return {
    name: job.name,
    id: job.id ?? null,
    result: job.conclusion ?? job.status ?? "unknown",
    status: job.status ?? "unknown",
    expected: expected[job.name] ?? null,
    started_at: job.started_at ?? null,
    completed_at: job.completed_at ?? null,
    duration_seconds: duration,
    runner_minutes_billed_estimate: duration === null ? null : Math.ceil(duration / 60),
    steps: stepMetrics(job)
  };
}

async function collect() {
  const capturedAt = new Date().toISOString();
  const baseUrl = `https://api.github.com/repos/${repository}/actions/runs/${runId}`;
  let apiError = null;
  let jobs = [];
  let artifacts = [];
  try {
    if (!repository || !runId || !token) throw new Error("repository, run id, or read token is missing");
    const jobsPayload = await githubJson(`${baseUrl}/jobs?per_page=100`);
    jobs = (jobsPayload.jobs ?? []).map(normalizeJob).sort((left, right) => {
      const leftIndex = orderedJobNames.indexOf(left.name);
      const rightIndex = orderedJobNames.indexOf(right.name);
      return (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex) || left.name.localeCompare(right.name);
    });
    const artifactsPayload = await githubJson(`${baseUrl}/artifacts?name=next-build-${runId}&per_page=10`);
    artifacts = artifactsPayload.artifacts ?? [];
  } catch (error) {
    apiError = error instanceof Error ? error.message : String(error);
  }

  const completedJobs = jobs.filter((job) => job.duration_seconds !== null);
  const starts = completedJobs.map((job) => Date.parse(job.started_at)).filter(Number.isFinite);
  const ends = completedJobs.map((job) => Date.parse(job.completed_at)).filter(Number.isFinite);
  const firstStart = starts.length ? Math.min(...starts) : null;
  const lastEnd = ends.length ? Math.max(...ends) : null;
  const failedJobs = jobs.filter((job) => !["success", "skipped"].includes(job.result));
  const firstFailure = failedJobs
    .map((job) => Date.parse(job.completed_at))
    .filter(Number.isFinite)
    .sort((left, right) => left - right)[0];
  const rootFailure = process.env.ROOT_FAILURE && process.env.ROOT_FAILURE !== "none"
    ? process.env.ROOT_FAILURE
    : null;
  const rootJob = rootFailure ? jobs.find((job) => job.name === rootFailure) : null;
  const rootEnd = rootJob?.completed_at ? Date.parse(rootJob.completed_at) : null;
  const wastedAfterRoot = rootEnd === null
    ? null
    : sum(jobs.map((job) => {
      const end = Date.parse(job.completed_at ?? "");
      return Number.isFinite(end) && end > rootEnd ? (end - rootEnd) / 1000 : 0;
    }));
  const stepTotals = jobs.reduce((totals, job) => {
    const metrics = job.steps;
    totals.npm_ci_count += metrics.npm_ci.length;
    totals.browser_setup_count += metrics.browser_setup.length;
    totals.artifact_download_count += metrics.artifact_download.length;
    totals.next_upload_count += metrics.next_upload.length;
    totals.test_step_count += metrics.test_steps.length;
    totals.npm_ci_seconds += metrics.npm_ci_seconds;
    totals.browser_setup_seconds += metrics.browser_setup_seconds;
    totals.artifact_download_seconds += metrics.artifact_download_seconds;
    totals.next_upload_seconds += metrics.next_upload_seconds;
    totals.graph_fetch_seconds += metrics.graph_fetch_seconds;
    totals.classifier_checkout_seconds += metrics.classifier_checkout_seconds;
    return totals;
  }, {
    npm_ci_count: 0,
    browser_setup_count: 0,
    artifact_download_count: 0,
    next_upload_count: 0,
    test_step_count: 0,
    npm_ci_seconds: 0,
    browser_setup_seconds: 0,
    artifact_download_seconds: 0,
    next_upload_seconds: 0,
    graph_fetch_seconds: 0,
    classifier_checkout_seconds: 0
  });

  const output = {
    schema_version: 1,
    captured_at: capturedAt,
    repository,
    run_id: runId || null,
    head_sha: process.env.GITHUB_SHA ?? null,
    event: process.env.GITHUB_EVENT_NAME ?? null,
    classification: {
      result: process.env.CLASSIFY_RESULT ?? null,
      event: process.env.CLASSIFY_EVENT ?? null,
      categories: (process.env.CLASSIFY_CATEGORIES ?? "").split(",").filter(Boolean),
      reason: process.env.CLASSIFY_REASON ?? null,
      changed_files: (process.env.CLASSIFY_CHANGED_FILES ?? "").split(" ").filter(Boolean),
      merge_base_depth: process.env.MERGE_BASE_DEPTH ? Number(process.env.MERGE_BASE_DEPTH) : null
    },
    run_policy: Object.fromEntries(RUN_OUTPUTS.map((name) => [name, booleanOutput(process.env[name.toUpperCase()])])),
    jobs,
    summary: {
      wall_clock_seconds: firstStart !== null && lastEnd !== null ? Number(((lastEnd - firstStart) / 1000).toFixed(3)) : null,
      runner_seconds: sum(completedJobs.map((job) => job.duration_seconds)),
      runner_minutes_billed_estimate: sum(completedJobs.map((job) => job.runner_minutes_billed_estimate)),
      jobs_expected: jobs.filter((job) => job.expected === true).map((job) => job.name),
      jobs_executed: jobs.filter((job) => job.result !== "skipped").map((job) => job.name),
      jobs_skipped: jobs.filter((job) => job.result === "skipped").map((job) => job.name),
      first_failure_possible_at_seconds: firstFailure === undefined || firstStart === null ? null : Number(((firstFailure - firstStart) / 1000).toFixed(3)),
      root_failure: rootFailure,
      work_after_root_failure_seconds: wastedAfterRoot
    },
    timings: stepTotals,
    artifact: {
      next_build_size_bytes: artifacts[0]?.size_in_bytes ?? null,
      next_build_digest: artifacts[0]?.digest ?? null,
      next_build_upload_count: stepTotals.next_upload_count,
      next_build_download_count: stepTotals.artifact_download_count
    },
    tests: {
      test_step_count: stepTotals.test_step_count,
      passed: null,
      failed: failedJobs.length,
      skipped: null
    },
    cache: {
      npm: null,
      next: null,
      playwright: null
    },
    preview_url: process.env.PREVIEW_URL ?? null,
    collection_error: apiError
  };
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  if (apiError) console.warn(`CI metrics API collection incomplete: ${apiError}`);
}

await collect();
