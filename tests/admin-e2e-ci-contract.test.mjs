import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("admin E2E permits only the logout form and keeps editor forms absent", async () => {
  const spec = await source("e2e/admin-restaurant-dashboard.spec.ts");

  assert.doesNotMatch(spec, /locator\("form:visible"\)\.toHaveCount\(0\)/);
  assert.match(spec, /const visibleForms = page\.locator\("form:visible"\)/);
  assert.match(spec, /expect\(visibleForms\)\.toHaveCount\(1\)/);
  assert.match(spec, /expect\(visibleForms\.first\(\)\)\.toHaveAttribute\("action", "\/admin\/logout"\)/);
  assert.match(spec, /expect\(visibleForms\.first\(\)\)\.toHaveAttribute\("method", "post"\)/);
});

test("required live E2E rejects a missing or non-HTTPS preview URL before browser scenarios", async () => {
  const spec = await source("e2e/admin-restaurant-dashboard.spec.ts");

  assert.match(spec, /VISTAIRE_ADMIN_E2E_BASE_URL must be configured/);
  assert.match(spec, /must use an HTTPS preview URL/);
});

test("App CI keeps blocking checks and excludes the live admin E2E", async () => {
  const [workflow, packageJson] = await Promise.all([
    source(".github/workflows/app-ci.yml"),
    source("package.json")
  ]);
  const scripts = JSON.parse(packageJson).scripts;

  assert.equal(scripts["test:admin"], "node scripts/run-admin-tests.mjs");
  for (const command of [
    "npm ci",
    "npm run lint",
    "npm run typecheck",
    "npm run test:seo",
    "npm run test:admin",
    "npm run build",
    "npm run test:seo:e2e"
  ]) {
    assert.match(workflow, new RegExp(`run: ${command.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}`));
  }
  assert.ok(
    workflow.indexOf("run: npm run test:admin") < workflow.indexOf("run: npm run build"),
    "admin tests must run before the build"
  );
  assert.doesNotMatch(workflow, /admin-restaurant-e2e|admin-e2e|VISTAIRE_ADMIN_E2E/);
  assert.doesNotMatch(workflow, /e2e\/admin-restaurant-dashboard\.spec\.ts/);
});

test("controlled admin E2E is manual, environment-bound, and fail-closed", async () => {
  const workflow = await source(".github/workflows/admin-restaurant-e2e.yml");

  assert.match(workflow, /^on:\s*\n\s+workflow_dispatch:\s*$/m);
  assert.doesNotMatch(workflow, /^\s{2}(?:pull_request|push):/m);
  assert.match(workflow, /environment:\s*admin-e2e/);
  assert.match(workflow, /name: Admin restaurant E2E \(manual controlled preview\)/);
  assert.match(workflow, /if: github\.ref != ['"]refs\/heads\/main['"]/);
  assert.doesNotMatch(workflow, /if: github\.ref !==/);
  assert.doesNotMatch(workflow, /name: Admin restaurant E2E \(controlled preview\)/);
  assert.match(workflow, /ref: main/);
  assert.match(workflow, /node scripts\/admin-e2e-fixture-contract\.mjs/);
  assert.match(workflow, /VISTAIRE_REQUIRE_ADMIN_E2E:\s*["']1["']/);
  assert.match(workflow, /npx playwright install --with-deps chromium/);
  assert.match(workflow, /npx playwright test e2e\/admin-restaurant-dashboard\.spec\.ts/);

  for (const name of [
    "VISTAIRE_ADMIN_E2E_ENABLED",
    "VISTAIRE_ADMIN_E2E_BASE_URL",
    "VISTAIRE_ADMIN_E2E_RESTAURANT_NAME",
    "VISTAIRE_ADMIN_E2E_OTHER_RESTAURANT_NAME",
    "VISTAIRE_ADMIN_E2E_QR_TOKEN",
    "VISTAIRE_ADMIN_E2E_OTHER_QR_TOKEN",
    "VISTAIRE_ADMIN_E2E_SUSPENDED_QR_TOKEN",
    "VISTAIRE_ADMIN_E2E_FALLBACK_QR_TOKEN"
  ]) {
    assert.match(workflow, new RegExp(name));
  }

  assert.ok(
    workflow.indexOf("node scripts/admin-e2e-fixture-contract.mjs") <
      workflow.indexOf("npx playwright test e2e/admin-restaurant-dashboard.spec.ts"),
    "fixture validation must fail before live browser scenarios"
  );
});

test("admin E2E guide is UTF-8 French and describes the manual live proof honestly", async () => {
  const guide = await source("docs/admin-restaurant-e2e.md");

  assert.doesNotMatch(guide, /(?:Ã.|â€™|â€œ|â€)/);
  assert.match(guide, /workflow_dispatch/);
  assert.match(guide, /environnement GitHub `admin-e2e`/i);
  assert.match(guide, /VISTAIRE_ADMIN_E2E_ENABLED=true/);
  assert.match(guide, /non bloquant/i);
  assert.match(guide, /ne constitue pas une preuve de validation live/i);
});

test("full-menu parity has a dedicated non-skipping package gate", async () => {
  const [packageJson, runner, spec] = await Promise.all([
    readFile("package.json", "utf8"),
    readFile("scripts/run-admin-full-menu-e2e.mjs", "utf8"),
    readFile("e2e/admin-chart-interactions.spec.ts", "utf8"),
  ]);
  assert.match(packageJson, /"test:admin:full-menu":\s*"node scripts\/run-admin-full-menu-e2e\.mjs"/);
  assert.match(runner, /VISTAIRE_ADMIN_FIXTURE_SCENARIO:\s*"full-menu"/);
  const grep = runner.match(/--grep", "([^"]+)"/)?.[1];
  assert.equal(grep, "full-menu admin parity");
  assert.match(spec, new RegExp(`test\\("${grep.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`));
  assert.match(spec, /toHaveCount\(12\)/);
  assert.match(spec, /data-available="false"/);
});

test("official visual audit covers all four external references", async () => {
  const [audit, visualSpec, insightsSpec] = await Promise.all([
    readFile("scripts/admin-visual-audit.mjs", "utf8"),
    readFile("e2e/admin-visual.spec.ts", "utf8"),
    readFile("e2e/admin-insights-fidelity.spec.ts", "utf8"),
  ]);
  for (const file of ["01-overview-desktop.png", "02-availability-desktop.png", "03-overview-mobile.png", "04-insights-desktop.png"]) assert.match(audit, new RegExp(file.replaceAll(".", "\\.")));
  assert.match(audit, /changedRatio/);
  assert.match(audit, /-overlay\.png/);
  assert.match(audit, /-diff\.png/);
  assert.match(audit, /process\.exitCode = 1/);
  assert.match(visualSpec, /overview-mobile-reference/);
  assert.match(insightsSpec, /insights-kpis\.png/);
});

test("admin E2E specification contains no mojibake", async () => {
  const spec = await source("e2e/admin-restaurant-dashboard.spec.ts");

  assert.doesNotMatch(spec, /(?:Ãƒ.|Ã¢â‚¬â„¢|Ã¢â‚¬Å“|Ã¢â‚¬|DÃ©connexion|AccÃ¨s)/);
  assert.match(spec, /Déconnexion/);
  assert.match(spec, /Accès dashboard restaurant requis/);
});
