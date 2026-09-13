import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import "./vercel-preview-cleanup.test.mjs";
import { classifyDeployments, runCleanup } from "../scripts/ci/vercel-preview-cleanup.mjs";

const workflow = await readFile(
  new URL("../.github/workflows/workflow-security.yml", import.meta.url),
  "utf8"
);
const mediaBackfillWorkflow = await readFile(
  new URL("../.github/workflows/media-backfill.yml", import.meta.url),
  "utf8"
);
const vercelCleanupWorkflow = await readFile(
  new URL("../.github/workflows/vercel-preview-cleanup.yml", import.meta.url),
  "utf8"
);

test("workflow security gates are immutable, read-only, and explicit", () => {
  assert.match(workflow, /name: Workflow Security/);
  assert.match(workflow, /permissions:\s+contents: read/);
  assert.match(workflow, /devops-actions\/actionlint@[0-9a-f]{40}/);
  assert.match(workflow, /zizmorcore\/zizmor-action@[0-9a-f]{40}/);
  assert.match(workflow, /version: 1\.21\.0/);
  assert.match(workflow, /online-audits: false/);
  assert.match(workflow, /advanced-security: false/);
  assert.match(workflow, /npm audit --json/);
  assert.match(workflow, /check-npm-audit-baseline\.mjs/);
  assert.doesNotMatch(workflow, /npm audit fix/);
  for (const match of workflow.matchAll(/uses:\s*([^\s]+)@([^\s#]+)/g)) {
    assert.match(match[2], /^[0-9a-f]{40}$/, `${match[1]} must use a full commit SHA`);
  }
});

test("dish photo backfill is manual, main-only, and fail-closed for production apply", () => {
  assert.match(mediaBackfillWorkflow, /name: Dish Photo Derivative Backfill/);
  assert.match(mediaBackfillWorkflow, /^on:\s*\n\s*workflow_dispatch:/m);
  assert.doesNotMatch(mediaBackfillWorkflow, /^\s+(?:pull_request|push|schedule):/m);
  assert.match(mediaBackfillWorkflow, /permissions:\s+contents: read/);
  assert.match(mediaBackfillWorkflow, /default: dry-run/);
  assert.match(mediaBackfillWorkflow, /options:\s*\n\s*- dry-run\s*\n\s*- apply/);
  assert.match(mediaBackfillWorkflow, /APPLY-DISH-PHOTO-BACKFILL/);
  assert.match(mediaBackfillWorkflow, /github\.event_name == 'workflow_dispatch'/);
  assert.match(mediaBackfillWorkflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(mediaBackfillWorkflow, /persist-credentials: false/);
  assert.match(mediaBackfillWorkflow, /lfs: false/);
  assert.match(mediaBackfillWorkflow, /NEXT_PUBLIC_SUPABASE_URL: \$\{\{ secrets\.NEXT_PUBLIC_SUPABASE_URL \}\}/);
  assert.match(mediaBackfillWorkflow, /SUPABASE_SERVICE_ROLE_KEY: \$\{\{ secrets\.SUPABASE_SERVICE_ROLE_KEY \}\}/);
  assert.match(mediaBackfillWorkflow, /VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF: \$\{\{ vars\.VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF \}\}/);
  assert.match(mediaBackfillWorkflow, /VISTAIRE_MEDIA_BACKFILL_ALLOW_APPLY: \$\{\{ vars\.VISTAIRE_MEDIA_BACKFILL_ALLOW_APPLY \}\}/);
  assert.match(mediaBackfillWorkflow, /VISTAIRE_MEDIA_WRITES_ENABLED: \$\{\{ vars\.VISTAIRE_MEDIA_WRITES_ENABLED \}\}/);
  assert.match(mediaBackfillWorkflow, /--measure-only/);
  assert.match(mediaBackfillWorkflow, /--apply --confirm-production/);
  assert.match(mediaBackfillWorkflow, /--measure-report=/);
  assert.match(mediaBackfillWorkflow, /--verify-only/);
  assert.doesNotMatch(mediaBackfillWorkflow, /VISTAIRE_MEDIA_BACKFILL_ALLOW_APPLY=1/);
  assert.doesNotMatch(mediaBackfillWorkflow, /VISTAIRE_MEDIA_WRITES_ENABLED=true/);
  assert.doesNotMatch(mediaBackfillWorkflow, /continue-on-error/);
  for (const match of mediaBackfillWorkflow.matchAll(/uses:\s*([^\s]+)@([^\s#]+)/g)) {
    assert.match(match[2], /^[0-9a-f]{40}$/, `${match[1]} must use a full commit SHA`);
  }
});

test("production apply is restricted to one explicit canary restaurant", () => {
  assert.match(mediaBackfillWorkflow, /canary_restaurant_id:/);
  assert.match(mediaBackfillWorkflow, /CANARY_RESTAURANT_ID: \$\{\{ inputs\.canary_restaurant_id \}\}/);
  assert.match(mediaBackfillWorkflow, /Apply blocked: canary restaurant is required/);
  assert.match(mediaBackfillWorkflow, /Apply blocked: canary restaurant id must be a UUID/);
  assert.equal(
    (mediaBackfillWorkflow.match(/--restaurant-id="\$CANARY_RESTAURANT_ID"/g) ?? []).length,
    3,
    "measure, apply, and verify must all use the exact canary restaurant"
  );
  const applyBlock = mediaBackfillWorkflow.slice(
    mediaBackfillWorkflow.indexOf("- name: Apply measured derivative backfill"),
    mediaBackfillWorkflow.indexOf("- name: Verify derivative metadata and Storage objects after apply")
  );
  assert.match(applyBlock, /--restaurant-id="\$CANARY_RESTAURANT_ID"/);
  assert.doesNotMatch(applyBlock, /--dish-id=/);
});

test("Vercel cleanup classifier keeps production targets", () => {
  const result = classifyDeployments({
    deployments: [{ uid: "prod", projectId: "prj_vistaire", target: "production", readyState: "READY", createdAt: 0, meta: { githubCommitRef: "main" } }],
    openPullRequests: [],
    expectedProjectId: "prj_vistaire",
    nowMs: 10_000_000,
    graceMs: 3_600_000,
  });
  assert.deepEqual(result.deleteCandidates, []);
});

test("Vercel cleanup apply removes only an eligible stale preview after production-domain preflight", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    const method = options.method ?? "GET";
    calls.push({ pathname: parsed.pathname, method });
    if (parsed.hostname === "api.vercel.com" && parsed.pathname === "/v7/deployments") {
      return new Response(JSON.stringify({
        deployments: [
          { uid: "preview", projectId: "prj_vistaire", target: null, readyState: "READY", createdAt: 0, meta: { githubCommitRef: "closed/pr", githubCommitSha: "abc", githubCommitOrg: "MarcSaad-Hadidi", githubCommitRepo: "Vistaire" } },
          { uid: "prod", projectId: "prj_vistaire", target: "production", readyState: "READY", createdAt: 0, meta: { githubCommitRef: "main", githubCommitSha: "def", githubCommitOrg: "MarcSaad-Hadidi", githubCommitRepo: "Vistaire" } },
        ],
        pagination: { next: null },
      }), { status: 200 });
    }
    if (parsed.hostname === "api.github.com") return new Response(JSON.stringify([]), { status: 200 });
    if (parsed.hostname === "api.vercel.com" && parsed.pathname === "/v9/projects/prj_vistaire/domains") {
      return new Response(JSON.stringify({ domains: [{ name: "vistaire.ca", projectId: "prj_vistaire", verified: true }], pagination: { next: null } }), { status: 200 });
    }
    if (parsed.hostname === "api.vercel.com" && parsed.pathname === "/v2/deployments/preview/aliases") {
      return new Response(JSON.stringify({ aliases: [{ alias: "preview-unique.vercel.app", uid: "alias-preview", created: "2026-09-12T00:00:00Z" }], pagination: { next: null } }), { status: 200 });
    }
    if (parsed.hostname === "api.vercel.com" && parsed.pathname === "/v13/deployments/preview") {
      return new Response(JSON.stringify({ uid: "preview", state: "DELETED" }), { status: 200 });
    }
    throw new Error(`unexpected request ${method} ${parsed}`);
  };

  const result = await runCleanup({
    mode: "apply",
    confirmation: "DELETE-VERCEL-PREVIEWS",
    eventName: "workflow_dispatch",
    eventAction: "",
    env: {
      VERCEL_TOKEN: "vercel-test-token",
      VERCEL_TEAM_ID: "team_test",
      VERCEL_PROJECT_ID: "prj_vistaire",
      GITHUB_TOKEN: "github-test-token",
      GITHUB_REPOSITORY: "MarcSaad-Hadidi/Vistaire",
    },
    fetchImpl,
    nowMs: 10_000_000,
    graceMs: 3_600_000,
  });

  assert.equal(result.deleted, 1);
  assert.equal(result.protectedProductionAliases, 0);
  assert.equal(calls.filter((call) => call.method === "DELETE").length, 1);
  assert.equal(calls.some((call) => call.pathname.endsWith("/prod") && call.method === "DELETE"), false);
});

test("Vercel cleanup workflow only runs from trusted events with read-only GitHub permissions", () => {
  assert.match(vercelCleanupWorkflow, /name: Vercel Preview Cleanup/);
  assert.match(vercelCleanupWorkflow, /pull_request:\s*\n\s*branches: \[main\]\s*\n\s*types: \[closed\]/);
  assert.match(vercelCleanupWorkflow, /schedule:\s*\n\s*- cron:/);
  assert.match(vercelCleanupWorkflow, /workflow_dispatch:/);
  assert.doesNotMatch(vercelCleanupWorkflow, /pull_request_target/);
  assert.match(vercelCleanupWorkflow, /permissions:\s*\n\s*contents: read\s*\n\s*pull-requests: read/);
  assert.match(vercelCleanupWorkflow, /default: dry-run/);
  assert.match(vercelCleanupWorkflow, /VERCEL_CLEANUP_GRACE_MS: '3600000'/);
  assert.match(vercelCleanupWorkflow, /VERCEL_TOKEN: \$\{\{ secrets\.VERCEL_TOKEN \}\}/);
  assert.match(vercelCleanupWorkflow, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/);
  assert.match(vercelCleanupWorkflow, /persist-credentials: false/);
  assert.match(vercelCleanupWorkflow, /lfs: false/);
  assert.doesNotMatch(vercelCleanupWorkflow, /continue-on-error/);
  for (const match of vercelCleanupWorkflow.matchAll(/uses:\s*([^\s]+)@([^\s#]+)/g)) {
    assert.match(match[2], /^[0-9a-f]{40}$/, `${match[1]} must use a full commit SHA`);
  }
});
