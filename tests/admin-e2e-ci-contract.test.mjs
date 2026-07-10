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

test("App CI executes deterministic admin and owner QR Node tests before build", async () => {
  const [workflow, packageJson] = await Promise.all([
    source(".github/workflows/app-ci.yml"),
    source("package.json")
  ]);
  const scripts = JSON.parse(packageJson).scripts;

  assert.equal(scripts["test:admin"], "node scripts/run-admin-tests.mjs");
  assert.match(workflow, /- name: Admin and owner QR tests\s+run: npm run test:admin/);
  assert.ok(
    workflow.indexOf("run: npm run test:admin") < workflow.indexOf("run: npm run build"),
    "admin tests must run before the build"
  );
});

test("admin E2E guide is UTF-8 French and describes the opt-in live proof honestly", async () => {
  const guide = await source("docs/admin-restaurant-e2e.md");

  assert.doesNotMatch(guide, /(?:Ã.|â€™|â€œ|â€)/);
  assert.match(guide, /VISTAIRE_ADMIN_E2E_ENABLED=true/);
  assert.match(guide, /ne constitue pas une preuve de validation live/i);
});
