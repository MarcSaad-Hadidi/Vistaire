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
const BASE_REPOSITORY = "MarcSaad-Hadidi/Vistaire";

function gitMeta(ref = "feature/example", sha = "sha-default", repository = BASE_REPOSITORY) {
  const [org, repo] = repository.split("/");
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
    meta: gitMeta(),
    ...overrides,
  };
}

function pullRequest({ number = 42, state = "open", ref = "feature/example", sha = "sha-head", repository = BASE_REPOSITORY, closedAt = null } = {}) {
  return {
    number,
    state,
    closed_at: closedAt,
    head: {
      ref,
      sha,
      repo: { full_name: repository },
    },
  };
}

function cleanupEnv() {
  return {
    VERCEL_TOKEN: "vercel-test-token",
    VERCEL_TEAM_ID: "team_test",
    VERCEL_PROJECT_ID: PROJECT_ID,
    GITHUB_TOKEN: "github-test-token",
    GITHUB_REPOSITORY: BASE_REPOSITORY,
  };
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status });
}

test("classifier keeps production, ambiguous, incomplete, active, promoted, and young deployments", () => {
  const inputs = [
    deployment({ uid: "production", target: "production" }),
    deployment({ uid: "custom", target: "staging" }),
    deployment({ uid: "ambiguous", target: undefined }),
    deployment({ uid: "wrong-project", projectId: "prj_other" }),
    deployment({ uid: "missing-branch", meta: { ...gitMeta(), githubCommitRef: undefined } }),
    deployment({ uid: "missing-sha", meta: { ...gitMeta(), githubCommitSha: undefined } }),
    deployment({ uid: "missing-repository", meta: { githubCommitRef: "feature/example", githubCommitSha: "sha" } }),
    deployment({ uid: "active", readyState: "BUILDING" }),
    deployment({ uid: "promoted", readySubstate: "PROMOTED" }),
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
  assert.ok(result.decisions.every((decision) => decision.action === "keep"));
});

test("classifier preserves latest Preview for an open PR and may delete only the superseded Preview", () => {
  const older = deployment({ uid: "older", createdAt: NOW - 3 * DEFAULT_GRACE_MS, meta: gitMeta("feature/example", "sha-old") });
  const latest = deployment({ uid: "latest", createdAt: NOW - 2 * DEFAULT_GRACE_MS, meta: gitMeta("feature/example", "sha-head") });

  const result = classifyDeployments({
    deployments: [older, latest],
    openPullRequests: [pullRequest()],
    closedPullRequests: [],
    expectedProjectId: PROJECT_ID,
    nowMs: NOW,
    graceMs: DEFAULT_GRACE_MS,
  });

  assert.deepEqual(result.deleteCandidates.map((item) => item.uid), ["older"]);
  assert.equal(result.decisions.find((item) => item.uid === "latest")?.reason, "latest-open-pr-preview");
});

test("branch fallback is scoped to the PR head repository", () => {
  const result = classifyDeployments({
    deployments: [
      deployment({ uid: "fork-a", meta: gitMeta("feature/shared", "old-a", "fork-a/Vistaire") }),
      deployment({ uid: "fork-b", meta: gitMeta("feature/shared", "old-b", "fork-b/Vistaire") }),
    ],
    openPullRequests: [
      pullRequest({ number: 10, ref: "feature/shared", sha: "head-a", repository: "fork-a/Vistaire" }),
      pullRequest({ number: 11, ref: "feature/shared", sha: "head-b", repository: "fork-b/Vistaire" }),
    ],
    closedPullRequests: [],
    expectedProjectId: PROJECT_ID,
    nowMs: NOW,
    graceMs: DEFAULT_GRACE_MS,
  });

  assert.deepEqual(result.deleteCandidates, []);
  assert.deepEqual(result.decisions.map((item) => item.reason), ["latest-open-pr-preview", "latest-open-pr-preview"]);
});

test("equal head SHAs on different branches in the same repository remain separate open PRs", () => {
  const sharedSha = "same-commit";
  const result = classifyDeployments({
    deployments: [
      deployment({ uid: "branch-a", createdAt: NOW - 3 * DEFAULT_GRACE_MS, meta: gitMeta("feature/a", sharedSha) }),
      deployment({ uid: "branch-b", createdAt: NOW - 2 * DEFAULT_GRACE_MS, meta: gitMeta("feature/b", sharedSha) }),
    ],
    openPullRequests: [
      pullRequest({ number: 20, ref: "feature/a", sha: sharedSha }),
      pullRequest({ number: 21, ref: "feature/b", sha: sharedSha }),
    ],
    closedPullRequests: [],
    expectedProjectId: PROJECT_ID,
    nowMs: NOW,
    graceMs: DEFAULT_GRACE_MS,
  });

  assert.deepEqual(result.deleteCandidates, []);
  assert.deepEqual(result.decisions.map((item) => item.reason), ["latest-open-pr-preview", "latest-open-pr-preview"]);
});

test("a closed PR Preview remains protected until 60 minutes after closed_at", () => {
  const result = classifyDeployments({
    deployments: [deployment({ uid: "closed-recently", createdAt: NOW - 3 * DEFAULT_GRACE_MS, meta: gitMeta("feature/closed", "closed-sha") })],
    openPullRequests: [],
    closedPullRequests: [pullRequest({
      number: 77,
      state: "closed",
      ref: "feature/closed",
      sha: "closed-sha",
      closedAt: new Date(NOW - 30 * 60 * 1000).toISOString(),
    })],
    expectedProjectId: PROJECT_ID,
    nowMs: NOW,
    graceMs: DEFAULT_GRACE_MS,
  });

  assert.deepEqual(result.deleteCandidates, []);
  assert.equal(result.decisions[0]?.reason, "closed-pr-grace-period");
});

test("dry-run never sends DELETE", async () => {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    requests.push({ method: options.method ?? "GET", pathname: parsed.pathname });
    if (parsed.hostname === "api.vercel.com") {
      return jsonResponse({ deployments: [deployment({ uid: "dry-run" })], pagination: { next: null } });
    }
    if (parsed.hostname === "api.github.com") return jsonResponse([]);
    throw new Error(`unexpected ${parsed}`);
  };

  const result = await runCleanup({ mode: "dry-run", env: cleanupEnv(), fetchImpl, nowMs: NOW });
  assert.equal(result.deleteCandidates, 1);
  assert.equal(result.deleted, 0);
  assert.equal(requests.some((request) => request.method === "DELETE"), false);
});

test("manual apply requires exact confirmation before any API call", async () => {
  let requests = 0;
  await assert.rejects(
    runCleanup({
      mode: "apply",
      confirmation: "wrong",
      eventName: "workflow_dispatch",
      env: {},
      fetchImpl: async () => {
        requests += 1;
        throw new Error("must not run");
      },
    }),
    /exact confirmation phrase/
  );
  assert.equal(requests, 0);
});

test("runner enables automatic apply only for schedule and closed PR events", () => {
  assert.equal(resolveCleanupRequest({ GITHUB_EVENT_NAME: "schedule" }).mode, "apply");
  assert.equal(resolveCleanupRequest({ GITHUB_EVENT_NAME: "pull_request", VERCEL_CLEANUP_EVENT_ACTION: "closed" }).mode, "apply");
  assert.equal(resolveCleanupRequest({ GITHUB_EVENT_NAME: "workflow_dispatch" }).mode, "dry-run");
  assert.throws(() => resolveCleanupRequest({ GITHUB_EVENT_NAME: "push" }), /Unsupported/);
});

test("all deployment alias pages are checked before DELETE", async () => {
  const requests = [];
  const candidate = deployment({ uid: "paginated-alias", meta: gitMeta("closed/paginated", "sha-page") });
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    const method = options.method ?? "GET";
    requests.push({ method, pathname: parsed.pathname, until: parsed.searchParams.get("until") });
    if (parsed.hostname === "api.vercel.com" && parsed.pathname === "/v7/deployments") {
      return jsonResponse({ deployments: [candidate], pagination: { next: null } });
    }
    if (parsed.hostname === "api.github.com") return jsonResponse([]);
    if (parsed.pathname === `/v9/projects/${PROJECT_ID}/domains`) {
      return jsonResponse({ domains: [{ name: "vistaire.ca", verified: true }], pagination: { next: null } });
    }
    if (parsed.pathname === "/v2/deployments/paginated-alias/aliases" && !parsed.searchParams.has("until")) {
      return jsonResponse({ aliases: [{ alias: "preview.vercel.app" }], pagination: { next: 123 } });
    }
    if (parsed.pathname === "/v2/deployments/paginated-alias/aliases" && parsed.searchParams.get("until") === "123") {
      return jsonResponse({ aliases: [{ alias: "vistaire.ca" }], pagination: { next: null } });
    }
    if (method === "DELETE") throw new Error("must be protected");
    throw new Error(`unexpected ${method} ${parsed}`);
  };

  const result = await runCleanup({
    mode: "apply",
    confirmation: "DELETE-VERCEL-PREVIEWS",
    eventName: "workflow_dispatch",
    env: cleanupEnv(),
    fetchImpl,
    nowMs: NOW,
  });

  assert.equal(result.deleted, 0);
  assert.equal(result.protectedProductionAliases, 1);
  assert.equal(requests.filter((request) => request.pathname.endsWith("/aliases")).length, 2);
});

test("production domain inventory is refreshed immediately before every candidate removal", async () => {
  const candidateA = deployment({ uid: "candidate-a", meta: gitMeta("closed/a", "sha-a") });
  const candidateB = deployment({ uid: "candidate-b", meta: gitMeta("closed/b", "sha-b") });
  let domainReads = 0;
  const deleted = [];

  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    const method = options.method ?? "GET";
    if (parsed.hostname === "api.vercel.com" && parsed.pathname === "/v7/deployments") {
      return jsonResponse({ deployments: [candidateA, candidateB], pagination: { next: null } });
    }
    if (parsed.hostname === "api.github.com") return jsonResponse([]);
    if (parsed.pathname === `/v9/projects/${PROJECT_ID}/domains`) {
      domainReads += 1;
      const domains = domainReads === 1
        ? [{ name: "vistaire.ca", verified: true }]
        : [{ name: "vistaire.ca", verified: true }, { name: "new-production.example", verified: true }];
      return jsonResponse({ domains, pagination: { next: null } });
    }
    if (parsed.pathname === "/v2/deployments/candidate-a/aliases") {
      return jsonResponse({ aliases: [{ alias: "preview-a.vercel.app" }], pagination: { next: null } });
    }
    if (parsed.pathname === "/v2/deployments/candidate-b/aliases") {
      return jsonResponse({ aliases: [{ alias: "new-production.example" }], pagination: { next: null } });
    }
    if (method === "DELETE") {
      deleted.push(parsed.pathname);
      return jsonResponse({ state: "DELETED" });
    }
    throw new Error(`unexpected ${method} ${parsed}`);
  };

  const result = await runCleanup({
    mode: "apply",
    confirmation: "DELETE-VERCEL-PREVIEWS",
    eventName: "workflow_dispatch",
    env: cleanupEnv(),
    fetchImpl,
    nowMs: NOW,
  });

  assert.equal(domainReads, 2);
  assert.deepEqual(deleted, ["/v13/deployments/candidate-a"]);
  assert.equal(result.deleted, 1);
  assert.equal(result.protectedProductionAliases, 1);
});
