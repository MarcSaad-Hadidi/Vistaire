import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  classifyChanges,
  classifyPath,
  RUN_OUTPUTS
} from "../scripts/ci/detect-changes.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const packageJson = JSON.parse(await read("package.json"));
const workflow = await read(".github/workflows/app-ci.yml");
const webkitCriticalRunner = await read("scripts/run-webkit-critical-e2e.mjs");

const previewOwnedPaths = [
  "app/(fr)/apercu-restaurateur/page.tsx",
  "app/(en)/en/restaurant-preview/page.tsx",
  "components/vistaire-preview/RestaurateurDashboardDemo.tsx",
  "lib/restaurateurPreview/fixture.ts",
  "e2e/restaurateur-preview.spec.ts"
];

const previewSharedPaths = [
  "components/admin/charts/InteractiveLineChart.tsx",
  "components/admin/charts/geometry.ts",
  "components/admin/charts/Charts.module.css",
  "components/admin/system/AdminIcons.tsx",
  "components/admin/system/AdminPresentationPrimitives.tsx",
  "components/admin/system/AdminSystem.module.css",
  "lib/adminPresentationCopy.ts"
];

test("every Prompt 7 product path selects public Chromium and critical WebKit", () => {
  for (const path of previewOwnedPaths) {
    const classification = classifyPath(path);
    assert.equal(
      classification.categories.has("public_navigation"),
      true,
      `${path} must remain in the public_navigation family`
    );

    const result = classifyChanges({
      eventName: "pull_request",
      changedFiles: [path]
    });
    assert.equal(result.run_core, true, `${path} must select public Chromium`);
    assert.equal(result.run_webkit, true, `${path} must select critical WebKit`);
  }
});

test("every shared Prompt 7 dependency selects public Chromium and critical WebKit", () => {
  for (const path of previewSharedPaths) {
    const classification = classifyPath(path);
    assert.equal(
      classification.categories.has("public_navigation"),
      true,
      `${path} must remain in the public_navigation family`
    );

    const result = classifyChanges({
      eventName: "pull_request",
      changedFiles: [path]
    });
    assert.equal(result.run_core, true, `${path} must select public Chromium`);
    assert.equal(result.run_webkit, true, `${path} must select critical WebKit`);
  }
});

test("the Prompt 7 browser contract executes with fail-closed CI options", () => {
  const coreScript = packageJson.scripts?.["test:ci:e2e:core"];
  const webkitScript = packageJson.scripts?.["test:ci:e2e:webkit"];

  assert.equal(typeof coreScript, "string", "test:ci:e2e:core must exist");
  assert.match(coreScript, /e2e\/restaurateur-preview\.spec\.ts/);
  assert.match(coreScript, /--project=chromium/);
  assert.match(coreScript, /--workers=1/);
  assert.match(coreScript, /--retries=0/);
  assert.match(coreScript, /--forbid-only/);
  assert.match(coreScript, /forbid-skipped-tests-reporter\.ts/);

  assert.equal(typeof webkitScript, "string", "test:ci:e2e:webkit must exist");
  assert.match(webkitScript, /scripts\/run-webkit-critical-e2e\.mjs/);
  assert.match(webkitScript, /scripts\/run-playwright-e2e\.mjs/);
  assert.match(webkitCriticalRunner, /e2e\/restaurateur-preview\.spec\.ts/);
  assert.match(webkitCriticalRunner, /--project=webkit/);
  assert.match(webkitCriticalRunner, /--workers=1/);
  assert.match(webkitCriticalRunner, /--retries=0/);
  assert.match(webkitCriticalRunner, /--forbid-only/);
  assert.match(webkitCriticalRunner, /forbid-skipped-tests-reporter\.ts/);
});

test("Prompt 7 Node contracts run in static-quality and the execution lock runs before install", () => {
  assert.equal(
    packageJson.scripts?.["test:restaurateur-preview:node"],
    "node --test tests/restaurateur-preview-fixture.test.mjs tests/restaurateur-preview-security.test.mjs tests/restaurateur-preview-ci-contract.test.mjs"
  );

  const fastGate = workflow.slice(
    workflow.indexOf("  fast-gate:"),
    workflow.indexOf("  static-quality:")
  );
  const staticQuality = workflow.slice(
    workflow.indexOf("  static-quality:"),
    workflow.indexOf("  database-contracts:")
  );
  assert.match(
    fastGate,
    /node --test[\s\S]*tests\/restaurateur-preview-ci-contract\.test\.mjs/
  );
  assert.doesNotMatch(fastGate, /^\s*(?:run:\s*)?npm\s+(?:ci|install)\b/m);
  assert.match(staticQuality, /npm run test:restaurateur-preview:node/);
});

test("Prompt 7 path changes never leave an applicable CI family unselected", () => {
  const result = classifyChanges({
    eventName: "pull_request",
    changedFiles: previewOwnedPaths
  });
  const selected = RUN_OUTPUTS.filter((name) => result[name]);
  assert.deepEqual(selected, ["run_static", "run_build", "run_core", "run_webkit"]);
});
