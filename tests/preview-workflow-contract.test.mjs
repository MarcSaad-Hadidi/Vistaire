import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const previewWorkflow = await readFile(
  new URL("../.github/workflows/preview-smoke.yml", import.meta.url),
  "utf8"
);
const smokeSpec = await readFile(
  new URL("../e2e/preview-smoke.spec.ts", import.meta.url),
  "utf8"
);
const reporter = await readFile(
  new URL("../e2e/support/forbid-skipped-tests-reporter.ts", import.meta.url),
  "utf8"
);

function assertPinnedActions(workflow) {
  for (const match of workflow.matchAll(/uses:\s*([^\s]+)@([^\s#]+)/g)) {
    if (match[1].startsWith("./")) continue;
    assert.match(match[2], /^[0-9a-f]{40}$/, "Action " + match[1] + " must use a full commit SHA");
  }
}

test("Preview Gate is deployment-status-only and checks out trusted main", () => {
  assert.match(previewWorkflow, /deployment_status:/);
  assert.match(previewWorkflow, /github\.repository == 'MarcSaad-Hadidi\\/Vistaire'/);
  assert.match(previewWorkflow, /environment == 'Preview'/);
  assert.match(previewWorkflow, /state == 'success'/);
  assert.match(previewWorkflow, /permissions:\s+contents: read/);
  assert.match(previewWorkflow, /environment: preview-gate/);
  assert.match(previewWorkflow, /ref: main/);
  assert.match(previewWorkflow, /persist-credentials: false/);
  assert.doesNotMatch(previewWorkflow, /pull_request_target/);
  assertPinnedActions(previewWorkflow);
  const checkout = previewWorkflow.slice(
    previewWorkflow.indexOf("- name: Checkout trusted smoke harness"),
    previewWorkflow.indexOf("- name: Setup Node")
  );
  assert.doesNotMatch(checkout, /VERCEL_AUTOMATION_BYPASS_SECRET/);
});

test("Preview Gate fails closed and requires a complete green report", () => {
  assert.match(previewWorkflow, /VERCEL_AUTOMATION_BYPASS_SECRET/);
  assert.match(previewWorkflow, /if \[\[ -z "\$\{VERCEL_AUTOMATION_BYPASS_SECRET:-\}" \]\]; then/);
  assert.match(previewWorkflow, /No remote page was executed/);
  assert.match(previewWorkflow, /exit 1/);
  assert.match(previewWorkflow, /Validate Preview structured report/);
  assert.match(previewWorkflow, /report\.failed !== 0/);
  assert.match(previewWorkflow, /report\.flaky !== 0/);
  assert.match(previewWorkflow, /report\.passed !== report\.total/);
  assert.match(previewWorkflow, /report\.skipped !== 0/);
  assert.match(previewWorkflow, /report\.interrupted !== 0/);
  assert.match(previewWorkflow, /deployment\.sha/);
  assert.match(previewWorkflow, /url\.username \|\| url\.password \|\| url\.port/);
});

test("Preview smoke scopes the bypass secret to the validated origin", () => {
  assert.match(smokeSpec, /context\.route/);
  assert.match(smokeSpec, /requestUrl\.origin === expectedOrigin/);
  assert.match(smokeSpec, /x-vercel-protection-bypass/);
  assert.doesNotMatch(smokeSpec, /extraHTTPHeaders/);
  assert.match(smokeSpec, /Preview Gate requires VERCEL_AUTOMATION_BYPASS_SECRET/);
  for (const route of [
    "/",
    "/en",
    "/demo",
    "/menu/trouvable?lang=en-CA",
    "/menu/sauge-noire?lang=en-CA",
    "/menu/trouvable/dishes/pesto-burrata-verde?lang=en-CA",
    "/robots.txt",
    "/sitemap.xml"
  ]) {
    assert.ok(smokeSpec.includes('"' + route + '"'), "missing route " + route);
  }
  assert.match(smokeSpec, /width: 390/);
  assert.match(smokeSpec, /width: 430/);
  assert.match(smokeSpec, /scrollWidth/);
  assert.match(smokeSpec, /naturalWidth/);
  assert.match(smokeSpec, /failedResponses/);
  assert.match(smokeSpec, /failedRequests/);
  assert.match(smokeSpec, /consoleErrors/);
  assert.match(smokeSpec, /pageErrors/);
});

test("Preview reporter emits structured totals and rejects skipped tests", () => {
  assert.match(reporter, /CI_TEST_REPORT_PATH/);
  assert.match(reporter, /total/);
  assert.match(reporter, /passed/);
  assert.match(reporter, /failed/);
  assert.match(reporter, /skipped/);
  assert.match(reporter, /flaky/);
  assert.match(reporter, /interrupted/);
  assert.match(reporter, /status: "failed"/);
});
