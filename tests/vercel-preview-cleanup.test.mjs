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
const BASE_REPO = "MarcSaad-Hadidi/Vistaire";

function gitMeta(ref, sha, fullName = BASE_REPO) {
  const [org, repo] = fullName.split("/");
  return {
    githubCommitRef: ref,
    githubCommitSha: sha,
    githubCommitOrg: org,
    githubCommitRepo: repo,
  };
}

function deployment(overrides = {}) {
  return {
    uid: "dpl_default",
    projectId: PROJECT_ID,
    target: null,
    readyState: "READY",
    createdAt: NOW - DEFAULT_GRACE_MS - 1,
    meta: gitMeta("feature/example", "sha-default"),
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
      repo: { full_name: BASE_REPO },
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
    deployment({ uid: "missing-sha", meta: { ...gitMeta("feature/example", "sha"), githubCommitSha: undefined } }),
    deployment({ uid: "missing-repo", meta: { githubCommitRef: "feature/example", githubCommitSha: "sha" } }),
    deployment({ uid: "building", readyState: "BUILDING" }),
    deployment({ uid: "young", createdAt: NOW - DEFAULT_GRACE_MS + 1 }),
  ];

  const result = classifyDeployments({
    deployments: inputs,
    openPullRequests: [],
    closedPullRequests: [],
    expectedProjectId: PROJECT_ID,
    nowMs: NOW,
    graceMs: DEFAULT_GRACE_MS,
  });

  assert.deepEqual(result.deleteCandidates, []);
  assert.equal(result.decisions.length, inputs.length);
  assert.ok(result.decisions.every((decision) => decision.action === "keep"));
  assert.equal(result.decisions.find((decision) => decision.uid === "missing-sha")?.reason, "missing-git-sha");
  assert.equal(result.decisions.find((decision) => decision.uid === "missing-repo")?.reason, "missing-git-repository");
});

test("classifier preserves the latest preview for an open PR and deletes only older superseded previews", () => {
  const old = deployment({ uid: "old", createdAt: NOW - 3 * DEFAULT_GRACE_MS, meta: gitMeta("feature/example", "sha-old") });
  const latest = deployment({ uid: "latest", createdAt: NOW - 2 * DEFAULT_GRACE_MS, meta: gitMeta("feature/example", "sha-new") });

  const result = classifyDeployments({
    deployments: [old, latest],
    openPullRequests: [openPr()],
    closedPullRequests: [],
    expectedProjectId: PROJECT_ID,
    nowMs: NOW,
    graceMs: DEFAULT_GRACE_MS,
  });

  assert.deepEqual(result.deleteCandidates.map((item) => item.uid), ["old"]);
  assert.equal(result.decisions.find((item) => item.uid === "latest")?.reason, "latest-open-pr-preview");
});

test("branch fallback is scoped to the PR head repository when forks share a branch name", () => {
  const sharedRef = "feature/shared";
  const forkA = "fork-a/Vistaire";
  const forkB = "fork-b/Vistaire";
  const deployments = [
    deployment({ uid: "fork-a-preview", createdAt: NOW - 3 * DEFAULT_GRACE_MS, meta: gitMeta(sharedRef, "sha-a-old", forkA) }),
    deployment({ uid: "fork-b-preview", createdAt: NOW - 2 * DEFAULT_GRACE_MS, meta: gitMeta(sharedRef, "sha-b-old", forkB) }),
  ];
  const openPullRequests = [
    openPr({ number: 10, head: { ref: sharedRef, sha: "sha-a-head", repo: { full_name: forkA } } }),
    openPr({ number: 11, head: { ref: sharedRef, sha: "sha-b-head", repo: { full_name: forkB } } }),
  ];

  const result = classifyDeployments({
    deployments,
    openPullRequests,
    closedPullRequests: [],
    expectedProjectId: PROJECT_ID,
    nowMs: NOW,
    graceMs: DEFAULT_GRACE_MS,
  });

  assert.deepEqual(result.deleteCandidates, []);
  assert.deepEqual(result.decisions.map((decision) => decision.reason), ["latest-open-pr-preview", "latest-open-pr-preview"]);
});

test("classifier allows stale terminal previews with no open PR to become delete candidates", () => {
  const stale = [
    deployment({ uid: "ready-orphan", readyState: "READY", meta: gitMeta("closed/ready", "sha-1") }),
    deployment({ uid: "error-orphan", readyState: "ERROR", meta: gitMeta("closed/error", "sha-2") }),
    deployment({ uid: "canceled-orphan", readyState: "CANCELED", meta: gitMeta("closed/canceled", "sha-3") }),
    deployment({ uid: "blocked-orphan", readyState: "BLOCKED", meta: gitMeta("closed/blocked", "sha-4") }),
  ];

  const result = classifyDeployments({
    deployments: stale,
    openPullRequests: [],
    closedPullRequests: [],
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
      GITHUB_REPOSITORY: BASE_REPO,
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

test("apply never deletes a Preview deployment when a production alias is on a later alias page", async () => {
  const requests = [];
  const candidate = deployment({ uid: "paginated-alias-preview", meta: gitMeta("closed/paginated", "paginated-sha") });
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    const method = options.method ?? "GET";
    requests.push({ pathname: parsed.pathname, method, until: parsed.searchParams.get("until") });
    if (parsed.hostname === "api.vercel.com" && parsed.pathname === "/v7/deployments") {
      return new Response(JSON.stringify({ deployments: [candidate], pagination: { next: null } }), { status: 200 });
    }
    if (parsed.hostname === "api.github.com") return new Response(JSON.stringify([]), { status: 200 });
    if (parsed.hostname === "api.vercel.com" && parsed.pathname === `/v9/projects/${PROJECT_ID}/domains`) {
      return new Response(JSON.stringify({ domains: [{ name: "vistaire.ca", projectId: PROJECT_ID, verified: true }], pagination: { next: null } }), { status: 200 });
    }
    if (parsed.hostname === "api.vercel.com" && parsed.pathname === "/v2/deployments/paginated-alias-preview/aliases" && !parsed.searchParams.has("until")) {
      return new Response(JSON.stringify({ aliases: [{ alias: "preview-only.vercel.app", uid: "alias-1", created: "2026-09-12T00:00:00Z" }], pagination: { next: 12345 } }), { status: 200 });
    }
    if (parsed.hostname === "api.vercel.com" && parsed.pathname === "/v2/deployments/paginated-alias-preview/aliases" && parsed.searchParams.get("until") === "12345") {
      return new Response(JSON.stringify({ aliases: [{ alias: "vistaire.ca", uid: "alias-prod", created: "2026-09-11T00:00:00Z" }], pagination: { next: null } }), { status: 200 });
    }
    if (method === "DELETE") throw new Error("production alias on later page must prevent deletion");
    throw new Error(`unexpected request ${method} ${parsed}`);
  };

  const result = await runCleanup({
    mode: "apply",
    confirmation: "DELETE-VERCEL-PREVIEWS",
    eventName: "workflow_dispatch",
    env: {
      VERCEL_TOKEN: "vercel-test-token",
      VERCEL_TEAM_ID: "team_test",
      VERCEL_PROJECT_ID: PROJECT_ID,
      GITHUB_TOKEN: "github-test-token",
      GITHUB_REPOSITORY: BASE_REPO,
    },
    fetchImpl,
    nowMs: NOW,
  });

  assert.equal(result.deleted, 0);
  assert.equal(result.protectedProductionAliases, 1);
  assert.equal(requests.filter((request) => request.pathname.endsWith("/aliases")).length, 2);
  assert.equal(requests.some((request) => request.method === "DELETE"), false);
});

test("apply never deletes a Preview deployment that currently serves a production domain", async () => {
  const requests = [];
  const promoted = deployment({ uid: "promoted-preview", meta: gitMeta("closed/promoted", "promoted-sha") });
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    const method = options.method ?? "GET";
    requests.push({ pathname: parsed.pathname, method });
    if (parsed.hostname === "api.vercel.com" && parsed.pathname === "/v7/deployments") {
      return new Response(JSON.stringify({ deployments: [promoted], pagination: { next: null } }), { status: 200 });
    }
    if (parsed.hostname === "api.github.com") return new Response(JSON.stringify([]), { status: 200 });
    if (parsed.hostname === "api.vercel.com" && parsed.pathname === `/v9/projects/${PROJECT_ID}/domains`) {
      return new Response(JSON.stringify({ domains: [{ name: "vistaire.ca", projectId: PROJECT_ID, verified: true }], pagination: { next: null } }), { status: 200 });
    }
    if (parsed.hostname === "api.vercel.com" && parsed.pathname === "/v2/deployments/promoted-preview/aliases") {
      return new Response(JSON.stringify({ aliases: [{ alias: "vistaire.ca", uid: "alias-prod", created: "2026-09-12T00:00:00Z" }], pagination: { next: null } }), { status: 200 });
    }
    if (method === "DELETE") throw new Error("promoted Preview must never be deleted");
    throw new Error(`unexpected request ${method} ${parsed}`);
  };

  const result = await runCleanup({
    mode: "apply",
    confirmation: "DELETE-VERCEL-PREVIEWS",
    eventName: "workflow_dispatch",
    env: {
      VERCEL_TOKEN: "vercel-test-token",
      VERCEL_TEAM_ID: "team_test",
      VERCEL_PROJECT_ID: PROJECT_ID,
      GITHUB_TOKEN: "github-test-token",
      GITHUB_REPOSITORY: BASE_REPO,
    },
    fetchImpl,
    nowMs: NOW,
  });

  assert.equal(result.deleteCandidates, 1);
  assert.equal(result.deleted, 0);
  assert.equal(result.protectedProductionAliases, 1);
  assert.equal(requests.some((request) => request.method === "DELETE"), false);
});

test("closed PR preview is protected until 60 minutes after the PR closes", () => {
  const oldPreview = deployment({
    uid: "recently-closed-pr-preview",
    createdAt: NOW - 3 * DEFAULT_GRACE_MS,
    meta: gitMeta("feature/recently-closed", "sha-closed"),
  });
  const result = classifyDeployments({
    deployments: [oldPreview],
    openPullRequests: [],
    closedPullRequests: [{
      number: 77,
      state: "closed",
      closed_at: new Date(NOW - 30 * 60 * 1000).toISOString(),
      head: { ref: "feature/recently-closed", sha: "sha-closed", repo: { full_name: BASE_REPO } },
    }],
    expectedProjectId: PROJECT_ID,
    nowMs: NOW,
    graceMs: DEFAULT_GRACE_MS,
  });

  assert.deepEqual(result.deleteCandidates, []);
  assert.equal(result.decisions[0]?.reason, "closed-pr-grace-period");
});
