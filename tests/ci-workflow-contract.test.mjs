import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(new URL("../.github/workflows/app-ci.yml", import.meta.url), "utf8");
const nightly = await readFile(new URL("../.github/workflows/nightly.yml", import.meta.url), "utf8");
const saugeFixtureData = await readFile(
  new URL("../e2e/support/sauge-noire-fixture-data.mjs", import.meta.url),
  "utf8"
);
const maisonIdentityMatches = [
  ...saugeFixtureData.matchAll(
    /^export const maisonRestaurantId = "([0-9a-f-]{36})";$/gm
  )
];
assert.equal(
  maisonIdentityMatches.length,
  1,
  "Maison fixture identity export must remain explicit and unique"
);
const maisonRestaurantId = maisonIdentityMatches[0][1];
const menuExperiences = await readFile(new URL("../lib/landing/menuExperiences.ts", import.meta.url), "utf8");
const e2eRunner = await readFile(new URL("../scripts/run-playwright-e2e.mjs", import.meta.url), "utf8");
const fetchGraph = await readFile(new URL("../scripts/ci/fetch-pr-graph.mjs", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("App CI exposes the production job topology and all event modes", () => {
  for (const job of [
    "classify-changes", "fast-gate", "static-quality", "database-contracts", "build-app",
    "e2e-public-chromium", "e2e-sauge-chromium", "e2e-admin-qr-chromium", "webkit-critical"
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
  for (const job of ["classify-changes", "fast-gate", "static-quality", "database-contracts", "build-app", "e2e-public-chromium", "e2e-sauge-chromium", "e2e-admin-qr-chromium", "webkit-critical"]) {
    const jobResultPattern = new RegExp(`needs\\.${job}\\.result`);
    assert.match(workflow, jobResultPattern);
    assert.doesNotMatch(`needsX${job}Yresult`, jobResultPattern);
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
  assert.match(workflow, /Root failure diagnosis/);
  assert.match(workflow, /blocked by root failure/);
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
    "e2e-public-chromium": "run_core",
    "e2e-sauge-chromium": "run_sauge",
    "e2e-admin-qr-chromium": "run_admin_qr",
    "webkit-critical": "run_webkit"
  };
  for (const [job, output] of Object.entries(jobOutputs)) {
    const start = workflow.indexOf(`  ${job}:`);
    const nextJobOffset = workflow.slice(start + 3).search(/^\n  [A-Za-z0-9_-]+:/m);
    const end = nextJobOffset < 0 ? workflow.length : start + 3 + nextJobOffset;
    const block = workflow.slice(start, end < 0 ? workflow.length : end);
    const condition = block.match(/^    if: (.+)$/m)?.[1] ?? "";
    if (job === "e2e-public-chromium") {
      assert.match(block, /outputs\.run_core == 'true'/, job);
      assert.match(block, /outputs\.run_landing == 'true'/, job);
      assert.match(block, /outputs\.run_menu == 'true'/, job);
      assert.match(block, /outputs\.run_seo == 'true'/, job);
    } else {
      assert.match(condition, new RegExp(`needs\\.classify-changes\\.outputs\\.${output} == 'true'`), job);
    }
    assert.doesNotMatch(condition, /needs\.classify-changes\.outputs\.(?!run_)/, job);
  }
  const gate = workflow.slice(workflow.indexOf("  ci-gate:"));
  assert.doesNotMatch(gate, /needs\.classify-changes\.outputs\.(?:docs_only|database|translations|landing|menu_shared|sauge_renderer|pageflip_gestures|admin|qr)/);
  assert.match(workflow, /name: fast-gate/);
  assert.match(workflow, /node --test tests\/ci-change-detection\.test\.mjs tests\/ci-workflow-contract\.test\.mjs tests\/preview-workflow-contract\.test\.mjs tests\/workflow-security-contract\.test\.mjs/);
  for (const job of ["e2e-public-chromium", "e2e-sauge-chromium", "e2e-admin-qr-chromium", "webkit-critical"]) {
    const start = workflow.indexOf(`  ${job}:`);
    const nextJobOffset = workflow.slice(start + 3).search(/^\n  [A-Za-z0-9_-]+:/m);
    const end = nextJobOffset < 0 ? workflow.length : start + 3 + nextJobOffset;
    const block = workflow.slice(start, end < 0 ? workflow.length : end);
    assert.match(block, /needs: \[classify-changes, fast-gate, static-quality, build-app\]/, job);
    assert.match(block, /needs\.fast-gate\.result == 'success'/, job);
    assert.match(block, /needs\.static-quality\.result == 'success'/, job);
    assert.match(block, /needs\.build-app\.result == 'success'/, job);
  }
  assert.match(workflow, /actions: read/);
  assert.match(workflow, /ci-metrics:/);
  assert.match(workflow, /ci-metrics-\$\{\{ github\.run_id \}\}/);
});

test("browser jobs publish structured reports to the metrics collector", () => {
  const browserJobs = ["e2e-public-chromium", "e2e-sauge-chromium", "e2e-admin-qr-chromium", "webkit-critical"];
  for (const job of browserJobs) {
    const start = workflow.indexOf(`  ${job}:`);
    const nextJobOffset = workflow.slice(start + 3).search(/^\n  [A-Za-z0-9_-]+:/m);
    const end = nextJobOffset < 0 ? workflow.length : start + 3 + nextJobOffset;
    const block = workflow.slice(start, end);
    assert.match(block, /outputs:\s+test_report:/s, `${job} must expose a report output`);
    assert.match(block, /CI_TEST_REPORT_PATH:/, `${job} must configure the report path`);
    assert.match(block, /id: publish-test-report/, `${job} must publish its report`);
    assert.match(block, /did not publish|no selected browser family/, `${job} must fail when the report is absent`);
  }
  assert.match(workflow, /CI_TEST_REPORTS_JSON: \$\{\{ toJSON\(needs\) \}\}/);
  assert.match(workflow, /Publish human-readable metrics summary/);
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
  assert.match(workflow, /head\.repo\.full_name == github\.repository/);
});

test("PR-controlled CI helpers never receive the GitHub token", async () => {
  const assetWorkflow = await readFile(new URL("../.github/workflows/asset-policy.yml", import.meta.url), "utf8");
  for (const source of [workflow, assetWorkflow]) {
    const start = source.indexOf("Fetch minimal PR graph for merge-base");
    const end = source.indexOf("Classify", start);
    const block = source.slice(start, end);
    assert.doesNotMatch(block, /GITHUB_TOKEN/);
    assert.match(block, /run: node scripts\/ci\/fetch-pr-graph\.mjs/);
  }

  const metricsStart = workflow.indexOf("  ci-metrics:");
  const metrics = workflow.slice(metricsStart);
  const collectStart = metrics.indexOf("Collect machine-readable CI metrics");
  const collectEnd = metrics.indexOf("Upload CI metrics JSON", collectStart);
  const collect = metrics.slice(collectStart, collectEnd);
  assert.match(collect, /GITHUB_TOKEN: \$\{\{ github\.ref == 'refs\/heads\/main' && github\.token \|\| '' \}\}/);
  assert.match(collect, /run: node scripts\/ci\/collect-metrics\.mjs/);
});

test("CI uses read-only permissions, bounded jobs, and concurrency", () => {
  assert.match(workflow, /permissions:\s+contents: read/);
  assert.match(workflow, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
  assert.equal((workflow.match(/timeout-minutes:/g) ?? []).length >= 10, true);
  assert.match(workflow, /postgres:17\.10@sha256:[0-9a-f]{64}/);
  assert.doesNotMatch(workflow, /image:\s*postgres:17\s*$/m);
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
  assert.match(
    packageJson.scripts["test:ci:e2e:core"],
    /ci-smoke\.spec\.ts[\s\S]*public-navigation\.spec\.ts/
  );
  assert.match(
    packageJson.scripts["test:ci:e2e:core"],
    /--forbid-only[\s\S]*forbid-skipped-tests-reporter\.ts/
  );
  assert.match(packageJson.scripts["test:ci:e2e:landing"], /landing-production-photo\.spec\.ts[\s\S]*landing-redesign\.spec\.ts/);
  assert.match(packageJson.scripts["test:ci:e2e:sauge"], /sauge-noire-first-gesture-scroll\.spec\.ts[\s\S]*sauge-noire-swipe-intent\.spec\.ts/);
  assert.match(packageJson.scripts["test:ci:e2e:sauge"], /e2e\/ar-renderer-handoff\.spec\.ts/);
  assert.match(packageJson.scripts["test:ci:e2e:menu"], /sauge-noire-menu-shared-smoke\.spec\.ts/);
  assert.match(packageJson.scripts["test:ci:e2e:menu"], /e2e\/ar-handoff\.spec\.ts/);
  assert.doesNotMatch(packageJson.scripts["test:ci:e2e:menu"], /ci-smoke\.spec\.ts/);
  assert.doesNotMatch(packageJson.scripts["test:ci:e2e:menu"], /sauge-noire-critical-smoke\.spec\.ts/);
  assert.doesNotMatch(packageJson.scripts["test:ci:e2e:menu"], /sauge-noire-(?:first-gesture-scroll|swipe-intent|contents-single-flip|static-page-handoff)\.spec\.ts/);
  assert.doesNotMatch(packageJson.scripts["test:ci:e2e:sauge"], /sauge-noire-critical-smoke\.spec\.ts/);
  assert.match(packageJson.scripts["test:seo:e2e"], /forbid-only/);
});

test("App CI validates and executes the public navigation family", () => {
  assert.match(workflow, /public_navigation/);
  assert.match(
    workflow,
    /public_navigation:\s+\$\{\{ steps\.classify\.outputs\.public_navigation \}\}/
  );
  const start = workflow.indexOf("  e2e-public-chromium:");
  const end = workflow.indexOf("  e2e-sauge-chromium:", start);
  const publicJob = workflow.slice(start, end);
  assert.match(publicJob, /outputs\.run_core == 'true'/);
  assert.match(publicJob, /run: npm run test:ci:e2e:core/);

  const gate = workflow.slice(workflow.indexOf("  ci-gate:"));
  assert.match(gate, /RUN_CORE/);
  assert.match(gate, /public_expected=false/);
  assert.match(gate, /\$RUN_CORE.*== true/);
});

test("the shared production artifact is built against the hermetic menu fixture", () => {
  const buildJob = workflow.slice(workflow.indexOf("  build-app:"), workflow.indexOf("  e2e-public-chromium:"));
  assert.match(buildJob, /NEXT_PUBLIC_SUPABASE_URL:\s+http:\/\/127\.0\.0\.1:55434/);
  assert.match(buildJob, /SUPABASE_SERVICE_ROLE_KEY:\s+sauge-noire-fixture-service-role-key/);
  const buildIdentityMatches = [
    ...buildJob.matchAll(
      /^\s+NEXT_PUBLIC_DEMO_RESTAURANT_ID:\s+([0-9a-f-]{36})$/gm
    )
  ];
  assert.equal(buildIdentityMatches.length, 1);
  assert.equal(
    buildIdentityMatches[0][1],
    maisonRestaurantId,
    "build-app must inline the canonical Maison fixture identity"
  );
  assert.match(buildJob, /VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF:\s+""/);
  assert.match(buildJob, /include-hidden-files:\s+true/);
  assert.doesNotMatch(buildJob, /VISTAIRE_E2E_LANDING_CANONICAL/);
});

test("build-app proves the static public graph and artifacts before upload", () => {
  const buildStart = workflow.indexOf("  build-app:");
  const uploadStart = workflow.indexOf("      - name: Upload verified Next.js build", buildStart);
  const buildJob = workflow.slice(buildStart, workflow.indexOf("  e2e-public-chromium:", buildStart));

  assert.match(
    buildJob,
    /VISTAIRE_EXCHANGE_RATES_FIXTURE_JSON:\s*['"]?\{[^\n]*"CAD":1[^\n]*"USD":0\.72[^\n]*"EUR":0\.6225[^\n]*\}['"]?/
  );
  assert.match(buildJob, /VISTAIRE_PUBLIC_ARTIFACT_SENTINELS:/);
  const envValue = (key) => {
    const matches = [
      ...buildJob.matchAll(
        new RegExp(`^\\s+${key}:\\s+(.+?)\\s*$`, "gm")
      )
    ];
    assert.equal(
      matches.length,
      1,
      `${key} must be configured exactly once in build-app`
    );
    const raw = matches[0][1];
    if (raw.startsWith("'") && raw.endsWith("'")) {
      return raw.slice(1, -1).replaceAll("''", "'");
    }
    if (raw.startsWith('"') && raw.endsWith('"')) {
      return JSON.parse(raw);
    }
    return raw;
  };
  const sentinels = JSON.parse(
    envValue("VISTAIRE_PUBLIC_ARTIFACT_SENTINELS")
  );
  assert.deepEqual(sentinels, [
    envValue("SUPABASE_SERVICE_ROLE_KEY"),
    envValue("VISTAIRE_OWNER_EMAILS"),
    envValue("VISTAIRE_ADMIN_SESSION_SECRET")
  ]);
  assert.deepEqual(sentinels, [
    "sauge-noire-fixture-service-role-key",
    "synthetic-owner-email@example.test",
    "synthetic-session-cookie"
  ]);

  const importBoundary = workflow.indexOf(
    "node scripts/ci/check-static-public-import-boundary.mjs",
    buildStart
  );
  const nextBuild = workflow.indexOf("npm run build", buildStart);
  const routeManifest = workflow.indexOf(
    "node scripts/ci/check-static-public-routes.mjs",
    buildStart
  );
  const artifactScan = workflow.indexOf(
    "node scripts/ci/check-public-prerender-artifacts.mjs",
    buildStart
  );
  assert.ok(importBoundary > buildStart, "import boundary must run in build-app");
  assert.ok(importBoundary < nextBuild, "import boundary must fail before build");
  assert.ok(nextBuild < routeManifest, "route manifest must inspect the completed build");
  assert.ok(routeManifest < artifactScan, "artifact scan must follow route classification");
  assert.ok(artifactScan < uploadStart, "all public artifact checks must pass before upload");
});

test("landing E2E uses the production readiness path", () => {
  assert.doesNotMatch(menuExperiences, /VISTAIRE_E2E_LANDING_CANONICAL/);
  assert.doesNotMatch(e2eRunner, /VISTAIRE_E2E_LANDING_CANONICAL/);
});

test("Asset Policy owns the repository asset checks", async () => {
  const assetWorkflow = await readFile(new URL("../.github/workflows/asset-policy.yml", import.meta.url), "utf8");
  const staticJob = workflow.slice(workflow.indexOf("  static-quality:"), workflow.indexOf("  database-contracts:"));
  assert.match(assetWorkflow, /npm run assets:check/);
  assert.match(assetWorkflow, /npm run lfs:check/);
  assert.doesNotMatch(staticJob, /assets:check|lfs:check/);
});
