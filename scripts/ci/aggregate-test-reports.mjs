#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

const outputPath = process.env.CI_TEST_REPORT_PATH;
const inputPaths = String(process.env.CI_TEST_REPORT_PATHS ?? "")
  .split(/[;,]/)
  .map((value) => value.trim())
  .filter(Boolean);

if (!outputPath || inputPaths.length === 0) {
  throw new Error("CI_TEST_REPORT_PATH and CI_TEST_REPORT_PATHS are required");
}

const totals = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  flaky: 0,
  interrupted: 0,
};
const families = {};

for (const path of inputPaths) {
  let report;
  try {
    report = JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new Error(`Unable to read structured test report ${path}: ${error.message}`);
  }
  for (const key of Object.keys(totals)) {
    if (!Number.isInteger(report[key]) || report[key] < 0) {
      throw new Error(`Structured test report ${path} has invalid ${key}`);
    }
    totals[key] += report[key];
  }
  if (totals.passed + totals.failed + totals.skipped + totals.flaky + totals.interrupted > totals.total) {
    throw new Error(`Structured test report totals exceed total after ${path}`);
  }
  const normalizedPath = path.replaceAll("\\", "/");
  const family = normalizedPath.match(/\.ci-test-report-([^./]+)\.json$/)?.[1] ?? path;
  families[family] = report;
}

await writeFile(outputPath, `${JSON.stringify({ ...totals, families })}\n`, "utf8");
