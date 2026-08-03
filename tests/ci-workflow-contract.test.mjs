import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(new URL("../.github/workflows/app-ci.yml", import.meta.url), "utf8");
const nightly = await readFile(new URL("../.github/workflows/nightly.yml", import.meta.url), "utf8");
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
  assert.match(workflow, /cancelled/);
  assert.match(workflow, /invalid full_ci output/);
  assert.doesNotMatch(workflow, /continue-on-error/);
});

test("WebKit is isolated to the critical browser job", () => {
  const install = workflow.indexOf("playwright install --with-deps webkit");
  const webkitJob = workflow.indexOf("  webkit-critical:");
  assert.ok(install > webkitJob, "WebKit installation must not happen in static or database jobs");
  assert.match(workflow, /sauge_renderer.*pageflip_gestures/s);
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
});

test("the shared production artifact is built against the hermetic menu fixture", () => {
  const buildJob = workflow.slice(workflow.indexOf("  build-app:"), workflow.indexOf("  e2e-core:"));
  assert.match(buildJob, /NEXT_PUBLIC_SUPABASE_URL:\s+http:\/\/127\.0\.0\.1:55434/);
  assert.match(buildJob, /SUPABASE_SERVICE_ROLE_KEY:\s+sauge-noire-fixture-service-role-key/);
  assert.match(buildJob, /VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF:\s+""/);
  assert.match(buildJob, /include-hidden-files:\s+true/);
});
