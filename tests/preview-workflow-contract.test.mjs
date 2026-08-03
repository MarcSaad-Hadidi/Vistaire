import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const previewWorkflow = await readFile(new URL("../.github/workflows/preview-smoke.yml", import.meta.url), "utf8");
const productionWorkflow = await readFile(new URL("../.github/workflows/production-smoke.yml", import.meta.url), "utf8");
const smokeSpec = await readFile(new URL("../e2e/preview-smoke.spec.ts", import.meta.url), "utf8");

function assertSafeDeploymentWorkflow(workflow, environment) {
  assert.match(workflow, /deployment_status:/);
  assert.match(workflow, new RegExp(`environment == '${environment}'`));
  assert.match(workflow, /state == 'success'/);
  assert.match(workflow, /github\.repository == 'MarcSaad-Hadidi\/Vistaire'/);
  assert.match(workflow, /permissions:\s+contents: read/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.match(workflow, /ref: main/);
  assert.match(workflow, /persist-credentials: false/);
  for (const match of workflow.matchAll(/uses:\s*([^\s]+)@([^\s#]+)/g)) {
    if (match[1].startsWith("./")) continue;
    assert.match(match[2], /^[0-9a-f]{40}$/, `${match[1]} must use a full commit SHA`);
  }
  assert.match(workflow, /--forbid-only/);
  assert.match(workflow, /forbid-skipped-tests-reporter/);
  assert.match(workflow, /deployment\.sha/);
}

test("Preview Gate is deployment-status-only and never checks out a PR ref", () => {
  assertSafeDeploymentWorkflow(previewWorkflow, "Preview");
  assert.match(previewWorkflow, /environment: preview-gate/);
  assert.match(previewWorkflow, /VERCEL_AUTOMATION_BYPASS_SECRET/);
  assert.match(smokeSpec, /x-vercel-protection-bypass/);
  assert.match(previewWorkflow, /allowlisted Vistaire Vercel preview host/);
});

test("Preview Gate skips safely when the protected bypass secret is unavailable", () => {
  const smokeStep = previewWorkflow.slice(
    previewWorkflow.indexOf("- name: Run protected Preview smoke"),
    previewWorkflow.indexOf("- name: Upload Preview diagnostics"),
  );
  assert.ok(smokeStep.includes('if [[ -z "${VERCEL_AUTOMATION_BYPASS_SECRET:-}" ]]; then'));
  assert.match(smokeStep, /::warning::Preview smoke skipped/);
  assert.match(smokeStep, /No remote page was executed/);
  assert.match(smokeStep, /exit 0/);
  assert.doesNotMatch(smokeStep, /\bexit 1\b/);
  assert.match(smokeStep, /preview-smoke\.spec\.ts/);
});

test("Production smoke is a separate trusted deployment check", () => {
  assertSafeDeploymentWorkflow(productionWorkflow, "Production");
  assert.doesNotMatch(productionWorkflow, /VERCEL_AUTOMATION_BYPASS_SECRET/);
  assert.match(productionWorkflow, /canonical Vistaire host/);
  assert.match(productionWorkflow, /Production deployment must originate from main/);
});

test("remote smoke covers critical routes, diagnostics, and mobile widths", () => {
  for (const route of [
    '"/"', '"/en"', '"/demo"', '"/menu/trouvable?lang=en-CA"',
    '"/menu/sauge-noire?lang=en-CA"', '"/robots.txt"', '"/sitemap.xml"',
    '"/menu/trouvable/dishes/pesto-burrata-verde?lang=en-CA"'
  ]) assert.match(smokeSpec, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(smokeSpec, /failedResponses/);
  assert.match(smokeSpec, /failedRequests/);
  assert.match(smokeSpec, /consoleErrors/);
  assert.match(smokeSpec, /pageErrors/);
  assert.match(smokeSpec, /width: 390/);
  assert.match(smokeSpec, /width: 430/);
  assert.match(smokeSpec, /scrollWidth/);
  assert.match(smokeSpec, /naturalWidth/);
});
