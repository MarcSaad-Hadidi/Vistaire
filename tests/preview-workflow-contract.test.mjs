import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const previewWorkflow = await readFile(
  new URL("../.github/workflows/preview-smoke.yml", import.meta.url),
  "utf8"
);
const productionWorkflow = await readFile(
  new URL("../.github/workflows/production-smoke.yml", import.meta.url),
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
const requestPolicy = await readFile(
  new URL("../e2e/support/preview-request-policy.mjs", import.meta.url),
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
  assert.match(previewWorkflow, /github\.repository == 'MarcSaad-Hadidi\/Vistaire'/);
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

test("Preview smoke establishes access without forwarding the bypass secret", () => {
  assert.match(smokeSpec, /context\.request\.get/);
  assert.match(smokeSpec, /maxRedirects: 0/);
  assert.match(smokeSpec, /expectReadyMedia/);
  assert.match(smokeSpec, /readyState >= 2/);
  assert.match(smokeSpec, /error !== null/);
  assert.match(smokeSpec, /expect\(latest\.healthy/);
  assert.match(smokeSpec, /pendingMediaRequests/);
  assert.match(smokeSpec, /pendingCriticalRequests/);
  assert.match(smokeSpec, /requestfinished/);
  assert.match(smokeSpec, /page\.on\("requestfailed", \(request\) => \{\s*settleMediaRequest\(request\);/);
  assert.match(smokeSpec, /resourceType\(\) !== "media"/);
  assert.match(smokeSpec, /classifyFailedRequest/);
  assert.match(smokeSpec, /classifyFailedResponse/);
  assert.match(smokeSpec, /isMediaCurrentSrcCoherent/);
  assert.match(smokeSpec, /prefetchHeaders/);
  assert.match(smokeSpec, /isNavigationRequest/);
  assert.match(smokeSpec, /primaryNavigation/);
  assert.match(smokeSpec, /ignoredRequests/);
  assert.match(smokeSpec, /sanitizeDiagnosticUrl/);
  assert.match(
    smokeSpec,
    /issues\.finalize\(mediaState\);[\s\S]*expect\(issues\.failedResponses,/
  );
  assert.match(smokeSpec, /x-vercel-protection-bypass/);
  assert.match(smokeSpec, /x-vercel-set-bypass-cookie/);
  assert.match(smokeSpec, /redirect left the validated origin/);
  assert.doesNotMatch(smokeSpec, /context\.route/);
  assert.doesNotMatch(smokeSpec, /route\.continue/);
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
  assert.match(smokeSpec, /Keep raw URLs for every readiness decision/);
  assert.match(smokeSpec, /refreshIfFinalized\(\);/);
  assert.match(smokeSpec, /settle: \(\) => Promise<void>/);
  assert.match(smokeSpec, /await issues\.settle\(\);[\s\S]*issues\.finalize\(mediaState\);[\s\S]*await issues\.settle\(\);/);
  assert.doesNotMatch(smokeSpec, /mediaElement\.error\s*!==\s*null/);
  assert.doesNotMatch(smokeSpec, /pathname\s*===\s*["']\/["']/);
});

test("Preview request policy only ignores explicit benign cancellations", () => {
  assert.match(requestPolicy, /ERR_ABORTED/);
  assert.match(requestPolicy, /VERCEL_JWE_PATH/);
  assert.match(requestPolicy, /startsWith\("\/.well-known\/"\)/);
  assert.match(requestPolicy, /healthy-media-cancellation/);
  assert.match(requestPolicy, /allowCancellation === true/);
  assert.match(requestPolicy, /explicit-prefetch-cancellation/);
  assert.match(requestPolicy, /critical script or stylesheet cancellation is always blocking/);
  assert.match(requestPolicy, /same-origin request cancellation has no explicit benign classification/);
  assert.match(requestPolicy, /request left the validated Preview origin/);
  assert.match(requestPolicy, /pickPrefetchHeaders/);
  assert.match(requestPolicy, /pathname: sanitizePathname/);
  assert.doesNotMatch(requestPolicy, /\.well-known\/[^"]*\*/);
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

test("Production Smoke remains a separate trusted deployment check", () => {
  assert.match(productionWorkflow, /deployment_status:/);
  assert.match(productionWorkflow, /environment == 'Production'/);
  assert.match(productionWorkflow, /state == 'success'/);
  assert.match(productionWorkflow, /github\.repository == 'MarcSaad-Hadidi\/Vistaire'/);
  assert.match(productionWorkflow, /Production deployment must originate from main/);
  assert.match(productionWorkflow, /canonical Vistaire host/);
  assert.match(productionWorkflow, /ref: main/);
  assert.match(productionWorkflow, /persist-credentials: false/);
  assert.match(productionWorkflow, /e2e\/ci-smoke\.spec\.ts/);
  assert.doesNotMatch(productionWorkflow, /e2e\/preview-smoke\.spec\.ts/);
  assert.doesNotMatch(productionWorkflow, /VERCEL_AUTOMATION_BYPASS_SECRET/);
});
