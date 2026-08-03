import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(new URL("../.github/workflows/app-ci.yml", import.meta.url), "utf8");
const nightly = await readFile(new URL("../.github/workflows/nightly.yml", import.meta.url), "utf8");
const menuExperiences = await readFile(new URL("../lib/landing/menuExperiences.ts", import.meta.url), "utf8");
const e2eRunner = await readFile(new URL("../scripts/run-playwright-e2e.mjs", import.meta.url), "utf8");
const fetchGraph = await readFile(new URL("../scripts/ci/fetch-pr-graph.mjs", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("App CI exposes the production job topology and all event modes", () => {
  for (const job of [
    "classify-changes", "static-quality", "database-contracts", "build-app",
    "e2e-core", "e2e-landing", "e2e-menu-shared", "e2e-sauge-deep",
    "e2e-admin-qr", "e2e-seo", "webkit-critical"
  ]) assert.match(workflow, new RegExp(`^  ${job}:`, "m"));
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /merge_group:/);
  assert.match(workflow, /workflow_dispatch:/);
  for (const target of ["targeted", "full", "sauge", "database", "admin_qr", "landing", "seo"]) {
    assert.match(workflow, new RegExp(`options: \\[.*${target}`));
  }
  assert.match(nightly, /schedule:/);
  assert.match(nightly, /\.\/\.github\/workflows\/app-ci\.yml/);
});

test("CI Gate is fail-closed and receives every job result", () => {
  assert.match(workflow, /name: CI Gate/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  for (const job of ["classify-changes", "static-quality", "database-contracts", "build-app", "e2e-core", "e2e-landing", "e2e-menu-shared", "e2e-sauge-deep", "e2e-admin-qr", "e2e-seo", "webkit-critical"]) {
    assert.match(workflow, new RegExp(`needs\.${job.replaceAll("-", "\\-")}\.result`));
  }
  assert.match(workflow, /expected but completed/);
  assert.match(workflow, /unexpected result/);
  assert.match(workflow, /invalid full_ci output/);
  assert.match(workflow, /CLASSIFICATION_VALID/);
  assert.doesNotMatch(workflow, /EXPECT_[A-Z_]+/);
  assert.doesNotMatch(workflow, /continue-on-error/);
  assert.doesNotMatch(workflow, /echo .*steps\.classify\.outputs\.(?:reason|changed_files)/);
  assert.match(workflow, /CLASSIFY_REASON:/);
  assert.match(workflow, /CLASSIFY_CHANGED_FILES:/);
});

test("WebKit is isolated to the critical browser job", () => {
  const install = workflow.indexOf("playwright install --with-deps webkit");
  const webkitJob = workflow.indexOf("  webkit-critical:");
  assert.ok(install > webkitJob, "WebKit installation must not happen in static or database jobs");
  assert.equal((workflow.match(/playwright install --with-deps webkit/g) ?? []).length, 1);
  assert.ok((workflow.match(/playwright install --with-deps chromium/g) ?? []).length >= 1);
  const staticJob = workflow.slice(workflow.indexOf("  static-quality:"), workflow.indexOf("  database-contracts:"));
  const databaseJob = workflow.slice(workflow.indexOf("  database-contracts:"), workflow.indexOf("  build-app:"));
  assert.doesNotMatch(staticJob, /playwright install/);
  assert.doesNotMatch(databaseJob, /playwright install/);
  const webkitCondition = workflow.slice(workflow.indexOf("  webkit-critical:"), workflow.indexOf("  ci-gate:"));
  assert.match(webkitCondition, /outputs\.run_webkit == 'true'/);
  assert.doesNotMatch(webkitCondition, /outputs\.(?:menu_shared|landing)/);
});

test("all job conditions and CI Gate consume the classifier run_* outputs", () => {
  for (const output of [
    "run_static", "run_database", "run_build", "run_core", "run_landing",
    "run_menu", "run_sauge", "run_admin_qr", "run_seo", "run_webkit"
  ]) {
    assert.match(workflow, new RegExp(`outputs\\.${output}`), `${output} must be a workflow output`);
    assert.match(workflow, new RegExp(`RUN_${output.slice(4).toUpperCase()}`), `${output} must reach CI Gate`);
  }
  assert.match(workflow, /fetch-depth: 1/);
  assert.match(workflow, /fetch-pr-graph\.mjs/);
  assert.match(workflow, /merge-base/);
  assert.doesNotMatch(workflow, /fetch-depth:\s*0/);
});

test("each App CI job has exactly one classifier-owned run output", () => {
  const jobOutputs = {
    "static-quality": "run_static",
    "database-contracts": "run_database",
    "build-app": "run_build",
    "e2e-core": "run_core",
    "e2e-landing": "run_landing",
    "e2e-menu-shared": "run_menu",
    "e2e-sauge-deep": "run_sauge",
    "e2e-admin-qr": "run_admin_qr",
    "e2e-seo": "run_seo",
    "webkit-critical": "run_webkit"
  };
  for (const [job, output] of Object.entries(jobOutputs)) {
    const start = workflow.indexOf(`  ${job}:`);
    const nextJobOffset = workflow.slice(start + 3).search(/^\n  [A-Za-z0-9_-]+:/m);
    const end = nextJobOffset < 0 ? workflow.length : start + 3 + nextJobOffset;
    const block = workflow.slice(start, end < 0 ? workflow.length : end);
    const condition = block.match(/^    if: (.+)$/m)?.[1] ?? "";
    assert.match(condition, new RegExp(`needs\\.classify-changes\\.outputs\\.${output} == 'true'`), job);
    assert.doesNotMatch(condition, /needs\.classify-changes\.outputs\.(?!run_)/, job);
  }
  const gate = workflow.slice(workflow.indexOf("  ci-gate:"));
  assert.doesNotMatch(gate, /needs\.classify-changes\.outputs\.(?:docs_only|database|translations|landing|menu_shared|sauge_renderer|pageflip_gestures|admin|qr)/);
});

test("PR graph fetch is bounded and fail-closed", () => {
  assert.match(fetchGraph, /--filter=blob:none/);
  assert.match(fetchGraph, /refs\/pull\//);
  assert.match(fetchGraph, /--deepen=/);
  assert.match(fetchGraph, /GIT_CONFIG_KEY_0:\s*"remote\.origin\.url"/);
  assert.match(fetchGraph, /x-access-token:\$\{encodeURIComponent\(token\)\}@/);
  assert.match(fetchGraph, /GIT_CONFIG_VALUE_0:\s*authenticatedOrigin/);
  assert.match(fetchGraph, /GIT_TERMINAL_PROMPT:\s*"0"/);
  assert.doesNotMatch(fetchGraph, /\["-c", `http\.extraheader=AUTHORIZATION/);
  assert.match(fetchGraph, /classifier will use full CI/);
  assert.doesNotMatch(fetchGraph, /fetch-depth:\s*0/);
});

test("CI uses read-only permissions, bounded jobs, and concurrency", () => {
  assert.match(workflow, /permissions:\s+contents: read/);
  assert.match(workflow, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
  assert.equal((workflow.match(/timeout-minutes:/g) ?? []).length >= 10, true);
});

test("CI browser families use one grouped runner invocation", () => {
  for (const script of [
    "test:ci:e2e:core",
    "test:ci:e2e:landing",
    "test:ci:e2e:menu",
    "test:ci:e2e:sauge",
    "test:ci:e2e:webkit"
  ]) {
    assert.equal(typeof packageJson.scripts[script], "string", `${script} must exist`);
    assert.match(packageJson.scripts[script], /scripts\/run-playwright-e2e\.mjs/);
  }
  assert.match(packageJson.scripts["test:ci:e2e:landing"], /landing-production-photo\.spec\.ts[\s\S]*landing-redesign\.spec\.ts/);
  assert.match(packageJson.scripts["test:ci:e2e:sauge"], /sauge-noire-critical-smoke\.spec\.ts[\s\S]*sauge-noire-swipe-intent\.spec\.ts/);
  assert.match(packageJson.scripts["test:ci:e2e:menu"], /ci-smoke\.spec\.ts[\s\S]*sauge-noire-critical-smoke\.spec\.ts/);
  assert.doesNotMatch(packageJson.scripts["test:ci:e2e:menu"], /sauge-noire-(?:first-gesture-scroll|swipe-intent|contents-single-flip|static-page-handoff)\.spec\.ts/);
});

test("the shared production artifact is built against the hermetic menu fixture", () => {
  const buildJob = workflow.slice(workflow.indexOf("  build-app:"), workflow.indexOf("  e2e-core:"));
  assert.match(buildJob, /NEXT_PUBLIC_SUPABASE_URL:\s+http:\/\/127\.0\.0\.1:55434/);
  assert.match(buildJob, /SUPABASE_SERVICE_ROLE_KEY:\s+sauge-noire-fixture-service-role-key/);
  assert.match(buildJob, /VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF:\s+""/);
  assert.match(buildJob, /include-hidden-files:\s+true/);
  assert.doesNotMatch(buildJob, /VISTAIRE_E2E_LANDING_CANONICAL/);
});

test("landing E2E uses the production readiness path", () => {
  assert.doesNotMatch(menuExperiences, /VISTAIRE_E2E_LANDING_CANONICAL/);
  assert.doesNotMatch(e2eRunner, /VISTAIRE_E2E_LANDING_CANONICAL/);
});
