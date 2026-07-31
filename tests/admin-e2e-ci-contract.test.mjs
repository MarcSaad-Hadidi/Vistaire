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

test("local Playwright smoke uses only synthetic Clerk fixture keys by default", async () => {
  const [runner, config] = await Promise.all([
    source("scripts/run-playwright-e2e.mjs"),
    source("playwright.config.ts")
  ]);

  assert.match(runner, /LOCAL_E2E_CLERK_PUBLISHABLE_KEY/);
  assert.match(runner, /pk_test_Y2xlcmsuZXhhbXBsZS5jb20k/);
  assert.match(runner, /sk_test_Y2xlcmsuZXhhbXBsZS5jb20k/);
  assert.match(runner, /NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:/);
  assert.match(runner, /CLERK_SECRET_KEY:\s*LOCAL_E2E_CLERK_SECRET_KEY/);
  assert.match(runner, /includes\("e2e\/ci-smoke\.spec\.ts"\)/);
  assert.match(
    runner,
    /const useDevelopmentServer\s*=\s*useLocalDemoServer\s*\|\|\s*\(?includesSaugeNoireBrowserFlow/
  );
  assert.match(runner, /useDevelopmentServer \? "dev" : "start"/);
  assert.match(runner, /import \{ randomBytes \} from "node:crypto"/);
  assert.match(runner, /randomBytes\(32\)\.toString\("base64url"\)/);
  assert.doesNotMatch(runner, /vistaire-owner-e2e-local-token/);
  assert.match(runner, /DEFAULT_BASE_URL = "http:\/\/127\.0\.0\.1:3000"/);
  assert.match(runner, /"-H",\s*"127\.0\.0\.1"/);

  assert.match(config, /import \{ randomBytes \} from "node:crypto"/);
  assert.match(config, /randomBytes\(32\)\.toString\("base64url"\)/);
  assert.doesNotMatch(config, /vistaire-owner-e2e-local-token/);
  assert.match(config, /next\/dist\/bin\/next start --hostname 127\.0\.0\.1/);
  assert.match(config, /shouldStartWebServer\s*\?\s*randomBytes\(32\)/);
  assert.match(
    config,
    /process\.env\.VISTAIRE_OWNER_E2E_AUTH_BYPASS_TOKEN\s*=\s*ownerE2eToken/
  );
});

test("App CI uses the hermetic bootstrap smoke and keeps the data-dependent smoke available locally", async () => {
  const [workflow, packageJson, fullSmoke] = await Promise.all([
    source(".github/workflows/app-ci.yml"),
    source("package.json"),
    source("e2e/mvp-smoke.spec.ts")
  ]);
  const scripts = JSON.parse(packageJson).scripts;

  assert.equal(scripts["test:admin"], "node scripts/run-admin-tests.mjs");
  assert.equal(
    scripts["test:smoke"],
    "node scripts/run-playwright-e2e.mjs e2e/mvp-smoke.spec.ts"
  );
  assert.equal(
    scripts["test:smoke:bootstrap"],
    "node scripts/run-playwright-e2e.mjs e2e/ci-smoke.spec.ts"
  );
  assert.equal(scripts["test:qr:node"], "node scripts/run-qr-node-tests.mjs");
  assert.equal(scripts["test:qr:postgres"], "node scripts/run-qr-postgres-tests.mjs");
  assert.equal(scripts["test:qr:functional"], "node scripts/run-qr-functional-e2e.mjs");
  assert.equal(
    scripts["test:qr:all"],
    "npm run test:qr:node && npm run test:qr:postgres && npm run test:qr:functional"
  );
  for (const command of [
    "npm ci",
    "npm run assets:check",
    "npm run lfs:check",
    "npm run lint",
    "npm run typecheck",
    "npm run test:qr:node",
    "npm run test:qr:postgres",
    "npm run build",
    "npm run test:qr:functional",
    "npm run test:seo",
    "npm run test:admin",
    "npm run test:smoke:bootstrap",
    "npm run test:seo:e2e"
  ]) {
    assert.match(workflow, new RegExp(`run: ${command.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}`));
  }
  assert.ok(
    workflow.indexOf("run: npm run build") <
      workflow.indexOf("run: npm run test:qr:functional") &&
      workflow.indexOf("run: npm run build") <
        workflow.indexOf("run: npm run test:smoke:bootstrap"),
    "next start Playwright suites and hermetic smoke must run after build"
  );
  assert.doesNotMatch(workflow, /^\s*run:\s*npm run test:smoke\s*$/m);
  assert.doesNotMatch(fullSmoke, /test\.skip/);
  assert.match(workflow, /image:\s*postgres:17/);
  assert.match(workflow, /PGDATABASE:\s*vistaire_qr_ci/);
  assert.doesNotMatch(workflow, /admin-restaurant-e2e|admin-e2e|VISTAIRE_ADMIN_E2E/);
  assert.doesNotMatch(workflow, /e2e\/admin-restaurant-dashboard\.spec\.ts/);
});

test("App CI keeps deterministic checks blocking with the Sauge Noire browser proofs", async () => {
  const [workflow, packageJson, scrollSpec, staticParitySpec, noSkipReporter] = await Promise.all([
    source(".github/workflows/app-ci.yml"),
    source("package.json"),
    source("e2e/sauge-noire-first-gesture-scroll.spec.ts"),
    source("e2e/sauge-noire-static-page-handoff.spec.ts"),
    source("e2e/support/forbid-skipped-tests-reporter.ts")
  ]);
  const scripts = JSON.parse(packageJson).scripts;

  assert.match(workflow, /^\s{2}checks:\s*$/m);
  assert.match(workflow, /^\s{2}app-ci:\s*$/m);
  assert.match(
    workflow,
    /name: App CI\s+if: \$\{\{ always\(\) \}\}\s+needs:\s+- checks\s+runs-on:/
  );
  assert.match(workflow, /CHECKS_RESULT:\s*\$\{\{ needs\.checks\.result \}\}/);
  assert.equal(
    scripts["test:sauge-noire:scroll"],
    "node scripts/run-playwright-e2e.mjs e2e/sauge-noire-first-gesture-scroll.spec.ts --project=chromium --workers=1 --retries=0 --forbid-only --reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts"
  );
  assert.equal(
    scripts["test:sauge-noire:smoke"],
    "node scripts/run-playwright-e2e.mjs e2e/sauge-noire-critical-smoke.spec.ts --project=chromium --workers=1 --retries=0"
  );
  assert.equal(
    scripts["test:sauge-noire:static-parity"],
    "node scripts/run-playwright-e2e.mjs e2e/sauge-noire-static-page-handoff.spec.ts --project=chromium --project=webkit --workers=1 --retries=0 --forbid-only --reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts"
  );
  assert.equal(
    scripts["test:sauge-noire:contents-single-flip"],
    "node scripts/run-playwright-e2e.mjs e2e/sauge-noire-contents-single-flip.spec.ts --project=chromium --project=webkit --workers=1 --retries=0 --forbid-only --reporter=list,./e2e/support/forbid-skipped-tests-reporter.ts"
  );
  assert.match(
    workflow,
    /- name: Install Playwright WebKit\s+run: npx --no-install playwright install --with-deps webkit/
  );
  assert.match(
    workflow,
    /- name: Sauge Noire critical smoke\s+timeout-minutes: 5\s+env:\s+PLAYWRIGHT_BROWSER_CHANNEL: chrome\s+run: npm run test:sauge-noire:smoke/
  );
  assert.match(
    workflow,
    /- name: Sauge Noire first-gesture scroll\s+timeout-minutes: 5\s+env:\s+PLAYWRIGHT_BROWSER_CHANNEL: chrome\s+run: npm run test:sauge-noire:scroll/
  );
  assert.match(
    workflow,
    /- name: Sauge Noire static-page parity\s+timeout-minutes: 10\s+env:\s+PLAYWRIGHT_BROWSER_CHANNEL: chrome\s+run: npm run test:sauge-noire:static-parity/
  );
  assert.match(
    workflow,
    /- name: Sauge Noire contents single flip\s+timeout-minutes: 10\s+env:\s+PLAYWRIGHT_BROWSER_CHANNEL: chrome\s+run: npm run test:sauge-noire:contents-single-flip/
  );
  assert.ok(
    workflow.indexOf("run: npm run build") <
      workflow.indexOf("run: npm run test:sauge-noire:smoke") &&
      workflow.indexOf("run: npm run build") <
        workflow.indexOf("run: npm run test:sauge-noire:scroll") &&
      workflow.indexOf("run: npm run build") <
        workflow.indexOf("run: npm run test:sauge-noire:contents-single-flip") &&
      workflow.indexOf("run: npm run build") <
        workflow.indexOf("run: npm run test:sauge-noire:static-parity"),
    "the built Next server must exist before the Sauge Noire browser proofs start"
  );
  assert.doesNotMatch(
    workflow,
    /unique_menu_e2e|Unique menu E2E|test:unique-menu-design:e2e|sauge-noire-(?:header|dish-detail|route-transitions|pageflip-lifecycle|static-pages-responsive)\.spec\.ts/
  );
  assert.doesNotMatch(workflow, /continue-on-error/);
  assert.equal(scripts["test:unique-menu-design:e2e"], undefined);

  assert.match(scrollSpec, /Input\.dispatchTouchEvent/);
  for (const touchType of ["touchStart", "touchMove", "touchEnd"]) {
    assert.match(scrollSpec, new RegExp(`"${touchType}"`));
  }
  for (const viewport of [
    /\{\s*width:\s*390,\s*height:\s*844\s*\}/,
    /\{\s*width:\s*430,\s*height:\s*932\s*\}/
  ]) {
    assert.match(scrollSpec, viewport);
  }
  for (const flow of [
    "menu page flip keeps the first vertical gesture on one owner",
    "menu to dish defers route handoff until the active touch ends",
    "dish to menu defers route handoff until the active touch ends",
    "next and previous dish flips keep the first gesture usable",
    "3D open and close preserve scroll and the next touch scrolls"
  ]) {
    assert.match(scrollSpec, new RegExp(flow));
  }
  for (const selector of [
    'data-page-flip-engine-state="flipping"',
    'data-page-flip-engine-state="read"',
    'data-sauge-route-transition-phase="animating"',
    'data-sauge-route-transition-phase="awaiting-destination"',
    'data-sauge-route-renderer-pending-handoff="true"',
    'data-sauge-route-renderer-pending-handoff="false"',
    'data-sauge-reading-surface="true"',
    'data-sauge-scroll-owner="true"'
  ]) {
    assert.match(scrollSpec, new RegExp(selector));
  }
  for (const forbiddenSkip of [
    /\btest\s*\.\s*skip\s*\(/,
    /\btest\s*\.\s*fixme\s*\(/,
    /\btestInfo\s*\.\s*skip\s*\(/,
    /\bdescribe\s*\.\s*skip\s*\(/
  ]) {
    assert.doesNotMatch(scrollSpec, forbiddenSkip);
    assert.doesNotMatch(staticParitySpec, forbiddenSkip);
  }
  for (const viewport of [
    /\{\s*width:\s*390,\s*height:\s*844\s*\}/,
    /\{\s*width:\s*430,\s*height:\s*932\s*\}/
  ]) {
    assert.match(staticParitySpec, viewport);
  }
  for (const pageKind of ["cover", "contents", "ending"]) {
    assert.match(staticParitySpec, new RegExp(`"${pageKind}"`));
  }
  for (const invariant of [
    /canonical\.frame\.clientHeight - canonical\.container\.clientHeight/,
    /canonical\.content\?\.clientHeight/,
    /canonical\.container\.scrollHeight/,
    /canonical\.frame\.scrollHeight/,
    /canonical\.horizontalOverflow/,
    /document\.fonts\.ready/,
    /getAttribute\("data-page-flip-engine-state"\)\s*===\s*"flipping"/,
    /engineState:\s*"read"/
  ]) {
    assert.match(staticParitySpec, invariant);
  }
  assert.match(noSkipReporter, /result\.status !== "skipped"/);
  assert.match(noSkipReporter, /test\.expectedStatus !== "skipped"/);
  assert.match(noSkipReporter, /return \{ status: "failed" as const \}/);
});

test("CodeQL keeps analysis failures blocking without uploading SARIF", async () => {
  const workflow = await source(".github/workflows/codeql.yml");

  assert.match(workflow, /uses:\s*github\/codeql-action\/analyze@v4/);
  assert.match(workflow, /upload:\s*never/);
  assert.doesNotMatch(workflow, /continue-on-error/);
});

test("controlled admin E2E runs only trusted main code against an exact Preview", async () => {
  const workflow = await source(".github/workflows/admin-restaurant-e2e.yml");

  assert.match(workflow, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s{2}(?:pull_request|push):/m);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.match(workflow, /environment:\s*admin-e2e/);
  assert.match(workflow, /GITHUB_REF.*refs\/heads\/main/);
  assert.match(workflow, /MarcSaad-Hadidi\/Vistaire/);
  assert.doesNotMatch(workflow, /git ls-remote/);
  assert.equal(workflow.match(/api\.github\.com\/repos\/\$EXPECTED_REPOSITORY\/git\/ref\/heads/g)?.length, 2);
  assert.equal(workflow.match(/GITHUB_TOKEN:\s*\$\{\{\s*(?:secrets\.GITHUB_TOKEN|github\.token)\s*\}\}/g)?.length, 2);
  assert.equal(
    workflow.match(/echo "::add-mask::\$GITHUB_TOKEN"[\s\S]*?curl --fail --silent --show-error/g)?.length,
    2,
    "each GitHub bearer token must be explicitly masked before curl uses it"
  );
  assert.match(workflow, /REMOTE_SHA.*TARGET_SHA/s);
  assert.equal(
    workflow.match(/ref:\s*\$\{\{\s*github\.sha\s*\}\}/g)?.length,
    1,
    "the only checkout must pin the trusted workflow-dispatch commit"
  );
  assert.doesNotMatch(workflow, /ref:\s*(?:main|master)\s*$/m);
  assert.doesNotMatch(workflow, /path:\s*candidate/);
  assert.doesNotMatch(workflow, /working-directory:\s*candidate/);
  assert.doesNotMatch(workflow, /ref:\s*\$\{\{\s*inputs\.sha\s*\}\}/);
  assert.match(workflow, /node scripts\/admin-e2e-trusted-preflight\.mjs/);
  assert.match(workflow, /VISTAIRE_REQUIRE_ADMIN_E2E:\s*["']1["']/);
  assert.match(workflow, /VISTAIRE_ADMIN_E2E_SENSITIVE:\s*["']1["']/);
  assert.doesNotMatch(workflow, /VISTAIRE_ADMIN_E2E_PRODUCTION_SUPABASE_PROJECT_REF/);
  assert.match(workflow, /VISTAIRE_ADMIN_E2E_EXPECTED_SUPABASE_PROJECT_REF/);
  assert.match(workflow, /npx --no-install playwright install --with-deps chromium/);
  assert.match(workflow, /npx --no-install playwright test e2e\/admin-restaurant-dashboard\.spec\.ts/);
  assert.match(workflow, /::add-mask::/);
  assert.match(workflow, /persist-credentials:\s*false/g);
  assert.equal(
    workflow.match(/^\s*uses:\s*[\w-]+\/[\w-]+@[0-9a-f]{40}\s*#/gm)?.length,
    workflow.match(/^\s*uses:/gm)?.length,
    "every action must be pinned to an immutable full SHA with a readable version comment"
  );
  assert.doesNotMatch(workflow, /uses:\s*[^\n]+@(?:main|master|latest|v\d+)(?:\s|$)/);
  assert.doesNotMatch(workflow, /permissions:[\s\S]*?\bwrite\b/);
  assert.match(workflow, /timeout-minutes:\s*5/);
  assert.match(workflow, /timeout-minutes:\s*20/);
  assert.match(workflow, /cancel-in-progress:\s*false/);
  assert.doesNotMatch(workflow, /upload-artifact|download-artifact/);
  assert.match(workflow, /--grep\s+["']@admin-e2e-live["']/);
  assert.doesNotMatch(workflow, /VISTAIRE_OWNER_E2E_AUTH_BYPASS_TOKEN/);

  for (const input of [
    "expected_preview_host",
    "expected_vercel_project_id",
    "expected_team_id",
    "expected_repository",
    "expected_branch",
    "expected_commit_sha",
    "expected_supabase_project_ref",
    "base_url"
  ]) {
    assert.match(workflow, new RegExp(`^\\s{6}${input}:`, "m"));
  }

  for (const name of [
    "VISTAIRE_ADMIN_E2E_ENABLED",
    "VISTAIRE_ADMIN_E2E_BASE_URL",
    "VISTAIRE_ADMIN_E2E_EXPECTED_COMMIT_SHA",
    "VISTAIRE_ADMIN_E2E_EXPECTED_GIT_BRANCH",
    "VISTAIRE_ADMIN_E2E_EXPECTED_SUPABASE_PROJECT_REF",
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
    workflow.indexOf("node scripts/admin-e2e-trusted-preflight.mjs") <
      workflow.indexOf("npx --no-install playwright test e2e/admin-restaurant-dashboard.spec.ts"),
    "trusted preflight must fail before live browser scenarios"
  );
});

test("trusted live spec excludes owner bypass and redacts session-cookie assertions", async () => {
  const spec = await source("e2e/admin-restaurant-dashboard.spec.ts");
  const ownerTest = spec.match(/test\("owner QR page[\s\S]*?\n}\);/)?.[0] ?? "";

  assert.doesNotMatch(ownerTest, /@admin-e2e-live/);
  assert.match(spec, /test\("[^"]*@admin-e2e-live/);
  assert.doesNotMatch(spec, /headers\(\)\["set-cookie"\]\)\.toContain/);
  assert.match(spec, /headers\(\)\["set-cookie"\]\?\.includes\("vistaire_admin_access="\)/);
  assert.doesNotMatch(spec, /cookies\.find\([\s\S]*?\)\.toBeUndefined\(\)/);
  assert.doesNotMatch(spec, /errors\.push\(message\.text\(\)\)/);
  assert.doesNotMatch(spec, /networkIssues\.push\(`[^`]*\$\{(?:response|request)\.url\(\)\}/);
  assert.match(spec, /redactSensitivePath/);
});

test("trusted workflow masks secrets before use and always removes sensitive output", async () => {
  const workflow = await source(".github/workflows/admin-restaurant-e2e.yml");
  const maskIndex = workflow.indexOf('echo "::add-mask::$secret_value"');
  const preflightIndex = workflow.indexOf("node scripts/admin-e2e-trusted-preflight.mjs");
  const browserIndex = workflow.indexOf("npx --no-install playwright test");

  assert.ok(maskIndex >= 0 && maskIndex < preflightIndex && preflightIndex < browserIndex);
  const secretValidationIndex = workflow.indexOf('[[ ! "$secret_value" =~ ^[A-Za-z0-9_-]{16,}$ ]]');
  assert.ok(secretValidationIndex >= 0 && secretValidationIndex < maskIndex);
  assert.match(workflow, /if:\s*always\(\)/);
  assert.match(workflow, /rm -rf -- test-results playwright-report blob-report/);
  assert.doesNotMatch(workflow, /set -x/);
});

test("bootstrap runbook blocks first use until admin-e2e protections exist", async () => {
  const guide = await source("docs/admin-restaurant-e2e.md");

  for (const requirement of [
    /required reviewer/i,
    /branches autoris[ée]es/i,
    /wildcard/i,
    /bypass administrateur/i,
    /rotation.*suppression.*fixtures/is,
    /ne pas lancer.*protection/is
  ]) {
    assert.match(guide, requirement);
  }
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

test("default E2E isolates fixture-only admin specs", async () => {
  const config = await source("playwright.config.ts");

  for (const spec of [
    "admin-chart-interactions.spec.ts",
    "admin-insights-fidelity.spec.ts",
    "admin-visual.spec.ts"
  ]) {
    assert.match(config, new RegExp(spec.replaceAll(".", "\\.")));
  }
  assert.match(config, /const fixtureOnlyTestIgnore/);
  assert.match(config, /testIgnore:\s*fixtureOnlyTestIgnore/);
  assert.match(config, /VISTAIRE_ADMIN_PERFORMANCE_SESSION_SECRET/);
  assert.match(config, /admin-performance\.spec\.ts/);
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
