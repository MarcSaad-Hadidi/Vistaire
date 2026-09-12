import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_GRACE_MS,
  classifyDeployments,
  runCleanup,
} from "../scripts/ci/vercel-preview-cleanup.mjs";
import { resolveCleanupRequest } from "../scripts/ci/run-vercel-preview-cleanup.mjs";

const NOW = Date.parse("2026-09-12T20:00:00Z");
const PROJECT_ID = "prj_vistaire";

function deployment(overrides = {}) {
  return {
    uid: "dpl_default",
    projectId: PROJECT_ID,
    target: null,
    readyState: "READY",
    createdAt: NOW - DEFAULT_GRACE_MS - 1,
    meta: {
      githubCommitRef: "feature/example",
      githubCommitSha: "sha-default",
    },
    ...overrides,
  };
}

function openPr(overrides = {}) {
  return {
    number: 42,
    state: "open",
    head: {
      ref: "feature/example",
      sha: "sha-new",
    },
    ...overrides,
  };
}

test("classifier never marks production, custom-target, ambiguous, incomplete, active, or young deployments for deletion", () => {
  const inputs = [
    deployment({ uid: "prod", target: "production" }),
    deployment({ uid: "staging", target: "staging" }),
    deployment({ uid: "ambiguous-target", target: undefined }),
    deployment({ uid: "wrong-project", projectId: "prj_other" }),
    deployment({ uid: "missing-git", meta: {} }),
    deployment({ uid: "missing-sha", meta: { githubCommitRef: "feature/example" } }),
    deployment({ uid: "building", readyState: "BUILDING" }),
    deployment({ uid: "young", createdAt: NOW - DEFAULT_GRACE_MS + 1 }),
  ];

  const result = classifyDeployments({
    deployments: inputs,
    openPullRequests: [],
    expectedProjectId: PROJECT_ID,
    nowMs: NOW,
    graceMs: DEFAULT_GRACE_MS,
  });

  assert.deepEqual(result.deleteCandidates, []);
  assert.equal(result.decisions.length, inputs.length);
  assert.ok(result.decisions.every((decision) => decision.action === "keep"));
  assert.equal(result.decisions.find((decision) => decision.uid === "missing-sha")?.reason, "missing-git-sha");
});

test("classifier preserves the latest preview for an open PR and deletes only older superseded previews", () => {
  const old = deployment({ uid: "old", createdAt: NOW - 3 * DEFAULT_GRACE_MS, meta: { githubCommitRef: "feature/example", githubCommitSha: "sha-old" } });
  const latest = deployment({ uid: "latest", createdAt: NOW - 2 * DEFAULT_GRACE_MS, meta: { githubCommitRef: "feature/example", githubCommitSha: "sha-new" } });

  const result = classifyDeployments({
    deployments: [old, latest],
    openPullRequests: [openPr()],
    expectedProjectId: PROJECT_ID,
    nowMs: NOW,
    graceMs: DEFAULT_GRACE_MS,
  });

  assert.deepEqual(result.deleteCandidates.map((item) => item.uid), ["old"]);
  assert.equal(result.decisions.find((item) => item.uid === "latest")?.reason, "latest-open-pr-preview");
});

test("classifier allows stale terminal previews with no open PR to become delete candidates", () => {
  const stale = [
    deployment({ uid: "ready-orphan", readyState: "READY", meta: { githubCommitRef: "closed/ready", githubCommitSha: "sha-1" } }),
    deployment({ uid: "error-orphan", readyState: "ERROR", meta: { githubCommitRef: "closed/error", githubCommitSha: "sha-2" } }),
    deployment({ uid: "canceled-orphan", readyState: "CANCELED", meta: { githubCommitRef: "closed/canceled", githubCommitSha: "sha-3" } }),
    deployment({ uid: "blocked-orphan", readyState: "BLOCKED", meta: { githubCommitRef: "closed/blocked", githubCommitSha: "sha-4" } }),
  ];

  const result = classifyDeployments({
    deployments: stale,
    openPullRequests: [],
    expectedProjectId: PROJECT_ID,
    nowMs: NOW,
    graceMs: DEFAULT_GRACE_MS,
  });

  assert.deepEqual(result.deleteCandidates.map((item) => item.uid).sort(), stale.map((item) => item.uid).sort());
});

test("dry-run never sends a Vercel DELETE request", async () => {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url: String(url), method: options.method ?? "GET" });
    const requestUrl = new URL(url);
    if (requestUrl.hostname === "api.vercel.com") {
      return new Response(JSON.stringify({ deployments: [deployment({ uid: "dry-run-candidate" })], pagination: { next: null } }), { status: 200 });
    }
    if (requestUrl.hostname === "api.github.com") {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    throw new Error(`unexpected URL ${url}`);
  };

  const result = await runCleanup({
    mode: "dry-run",
    confirmation: "",
    eventName: "workflow_dispatch",
    env: {
      VERCEL_TOKEN: "vercel-test-token",
      VERCEL_TEAM_ID: "team_test",
      VERCEL_PROJECT_ID: PROJECT_ID,
      GITHUB_TOKEN: "github-test-token",
      GITHUB_REPOSITORY: "MarcSaad-Hadidi/Vistaire",
    },
    fetchImpl,
    nowMs: NOW,
  });

  assert.equal(result.deleteCandidates, 1);
  assert.equal(result.deleted, 0);
  assert.equal(requests.some((request) => request.method === "DELETE"), false);
});

test("runner selects apply only for trusted automatic events and defaults manual runs to dry-run", () => {
  assert.deepEqual(resolveCleanupRequest({ GITHUB_EVENT_NAME: "schedule" }), {
    mode: "apply",
    confirmation: "",
    eventName: "schedule",
    eventAction: "",
  });
  assert.deepEqual(resolveCleanupRequest({ GITHUB_EVENT_NAME: "pull_request", VERCEL_CLEANUP_EVENT_ACTION: "closed" }), {
    mode: "apply",
    confirmation: "",
    eventName: "pull_request",
    eventAction: "closed",
  });
  assert.deepEqual(resolveCleanupRequest({ GITHUB_EVENT_NAME: "workflow_dispatch" }), {
    mode: "dry-run",
    confirmation: "",
    eventName: "workflow_dispatch",
    eventAction: "",
  });
  assert.throws(() => resolveCleanupRequest({ GITHUB_EVENT_NAME: "push" }), /Unsupported Vercel cleanup event/);
});

test("manual apply requires the exact confirmation phrase before any API request", async () => {
  let requests = 0;
  await assert.rejects(
    runCleanup({
      mode: "apply",
      confirmation: "wrong",
      eventName: "workflow_dispatch",
      env: {},
      fetchImpl: async () => {
        requests += 1;
        throw new Error("should not be called");
      },
      nowMs: NOW,
    }),
    /exact confirmation phrase/
  );
  assert.equal(requests, 0);
});
