import {
  listOpenPullRequests,
  listProductionProjectDomains,
  listVercelDeployments,
} from "./vercel-preview-cleanup-read.mjs";
import { removeVercelPreview } from "./vercel-preview-cleanup-write.mjs";

export const DEFAULT_GRACE_MS = 60 * 60 * 1000;
export const MANUAL_APPLY_CONFIRMATION = "DELETE-VERCEL-PREVIEWS";

const TERMINAL_STATES = new Set(["READY", "ERROR", "CANCELED", "BLOCKED"]);
const ACTIVE_STATES = new Set(["BUILDING", "INITIALIZING", "QUEUED"]);

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function timestamp(value) {
  return Number.isFinite(value) && value >= 0 ? Number(value) : null;
}

function deploymentState(deployment) {
  return text(deployment?.readyState) ?? text(deployment?.state);
}

function gitBranch(deployment) {
  return text(deployment?.meta?.githubCommitRef);
}

function gitSha(deployment) {
  return text(deployment?.meta?.githubCommitSha);
}

function normalizeOpenPullRequests(openPullRequests) {
  const result = [];
  for (const pullRequest of openPullRequests ?? []) {
    if (pullRequest?.state !== "open") continue;
    const branch = text(pullRequest?.head?.ref);
    const sha = text(pullRequest?.head?.sha);
    if (!branch || !sha || !Number.isInteger(pullRequest?.number)) continue;
    result.push({ number: pullRequest.number, branch, sha });
  }
  return result;
}

function matchOpenPullRequest(deployment, openPullRequests) {
  const branch = gitBranch(deployment);
  const sha = gitSha(deployment);
  if (!branch || !sha) return null;
  const shaMatch = openPullRequests.find((pullRequest) => pullRequest.sha === sha);
  if (shaMatch) return shaMatch;
  return openPullRequests.find((pullRequest) => pullRequest.branch === branch) ?? null;
}

function newerDeployment(left, right) {
  const leftCreated = timestamp(left?.createdAt ?? left?.created) ?? -1;
  const rightCreated = timestamp(right?.createdAt ?? right?.created) ?? -1;
  if (leftCreated !== rightCreated) return leftCreated > rightCreated ? left : right;
  return String(left?.uid ?? "").localeCompare(String(right?.uid ?? "")) >= 0 ? left : right;
}

export function classifyDeployments({
  deployments,
  openPullRequests,
  expectedProjectId,
  nowMs = Date.now(),
  graceMs = DEFAULT_GRACE_MS,
}) {
  if (!Array.isArray(deployments)) throw new Error("deployments must be an array");
  if (!Array.isArray(openPullRequests)) throw new Error("openPullRequests must be an array");
  if (!text(expectedProjectId)) throw new Error("expectedProjectId is required");
  if (!Number.isFinite(nowMs) || !Number.isFinite(graceMs) || graceMs < 0) {
    throw new Error("nowMs and graceMs must be finite and graceMs must be non-negative");
  }

  const normalizedPullRequests = normalizeOpenPullRequests(openPullRequests);
  const latestByOpenPr = new Map();

  for (const deployment of deployments) {
    if (deployment?.projectId !== expectedProjectId) continue;
    if (deployment?.target !== null) continue;
    if (!text(deployment?.uid) || !gitBranch(deployment) || !gitSha(deployment)) continue;
    if (timestamp(deployment?.createdAt ?? deployment?.created) === null) continue;
    const pullRequest = matchOpenPullRequest(deployment, normalizedPullRequests);
    if (!pullRequest) continue;
    const current = latestByOpenPr.get(pullRequest.number);
    latestByOpenPr.set(pullRequest.number, current ? newerDeployment(current, deployment) : deployment);
  }

  const decisions = [];
  const deleteCandidates = [];

  for (const deployment of deployments) {
    const uid = text(deployment?.uid) ?? "<unknown>";
    let decision;

    if (deployment?.projectId !== expectedProjectId) {
      decision = { uid, action: "keep", reason: "project-mismatch" };
    } else if (deployment?.target === "production") {
      decision = { uid, action: "keep", reason: "production-target" };
    } else if (deployment?.target !== null) {
      decision = { uid, action: "keep", reason: "non-preview-or-ambiguous-target" };
    } else if (!text(deployment?.uid)) {
      decision = { uid, action: "keep", reason: "missing-deployment-id" };
    } else if (!gitBranch(deployment)) {
      decision = { uid, action: "keep", reason: "missing-git-branch" };
    } else if (!gitSha(deployment)) {
      decision = { uid, action: "keep", reason: "missing-git-sha" };
    } else if (String(deployment?.readySubstate ?? "").toUpperCase() === "PROMOTED") {
      decision = { uid, action: "keep", reason: "promoted-preview" };
    } else {
      const createdAt = timestamp(deployment?.createdAt ?? deployment?.created);
      const state = deploymentState(deployment);
      const pullRequest = matchOpenPullRequest(deployment, normalizedPullRequests);
      const latest = pullRequest ? latestByOpenPr.get(pullRequest.number) : null;

      if (createdAt === null) {
        decision = { uid, action: "keep", reason: "missing-created-at" };
      } else if (latest?.uid === deployment.uid) {
        decision = { uid, action: "keep", reason: "latest-open-pr-preview" };
      } else if (ACTIVE_STATES.has(state)) {
        decision = { uid, action: "keep", reason: "active-preview" };
      } else if (!TERMINAL_STATES.has(state)) {
        decision = { uid, action: "keep", reason: "unknown-or-nonterminal-state" };
      } else if (nowMs - createdAt < graceMs) {
        decision = { uid, action: "keep", reason: "grace-period" };
      } else if (pullRequest) {
        decision = { uid, action: "delete", reason: "superseded-open-pr-preview", deployment };
      } else {
        decision = { uid, action: "delete", reason: "stale-preview-without-open-pr", deployment };
      }
    }

    decisions.push(decision);
    if (decision.action === "delete") deleteCandidates.push(decision.deployment);
  }

  return { decisions, deleteCandidates };
}

function requiredEnv(env, name) {
  const value = text(env?.[name]);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function summarizeDecisions(decisions) {
  const reasons = {};
  for (const decision of decisions) reasons[decision.reason] = (reasons[decision.reason] ?? 0) + 1;
  return reasons;
}

function validateApplyAuthorization({ mode, confirmation, eventName, eventAction }) {
  if (mode === "dry-run") return;
  if (mode !== "apply") throw new Error("mode must be dry-run or apply");

  if (eventName === "workflow_dispatch") {
    if (confirmation !== MANUAL_APPLY_CONFIRMATION) {
      throw new Error("Manual apply requires the exact confirmation phrase");
    }
    return;
  }
  if (eventName === "schedule") return;
  if (eventName === "pull_request" && eventAction === "closed") return;
  throw new Error("Automatic apply is allowed only for schedule or closed pull_request events");
}

export async function runCleanup({
  mode = "dry-run",
  confirmation = "",
  eventName = "workflow_dispatch",
  eventAction = "",
  env = process.env,
  fetchImpl = fetch,
  nowMs = Date.now(),
  graceMs = DEFAULT_GRACE_MS,
}) {
  validateApplyAuthorization({ mode, confirmation, eventName, eventAction });

  const token = requiredEnv(env, "VERCEL_TOKEN");
  const teamId = requiredEnv(env, "VERCEL_TEAM_ID");
  const projectId = requiredEnv(env, "VERCEL_PROJECT_ID");
  const githubToken = requiredEnv(env, "GITHUB_TOKEN");
  const repository = requiredEnv(env, "GITHUB_REPOSITORY");

  const [deployments, openPullRequests] = await Promise.all([
    listVercelDeployments({ fetchImpl, token, teamId, projectId }),
    listOpenPullRequests({ fetchImpl, token: githubToken, repository }),
  ]);

  const classified = classifyDeployments({
    deployments,
    openPullRequests,
    expectedProjectId: projectId,
    nowMs,
    graceMs,
  });

  let deleted = 0;
  let protectedProductionAliases = 0;
  let productionDomainCount = 0;
  if (mode === "apply" && classified.deleteCandidates.length > 0) {
    const productionDomains = await listProductionProjectDomains({
      fetchImpl,
      token,
      teamId,
      projectId,
    });
    const verifiedProductionDomains = productionDomains.filter(
      (domain) => domain?.verified !== false && typeof domain?.name === "string" && domain.name.trim()
    );
    if (verifiedProductionDomains.length === 0) {
      throw new Error("No verified production domains were returned; refusing all Preview removals");
    }
    productionDomainCount = verifiedProductionDomains.length;

    for (const deployment of classified.deleteCandidates) {
      const removal = await removeVercelPreview({
        fetchImpl,
        token,
        teamId,
        projectId,
        deployment,
        productionDomains: verifiedProductionDomains,
      });
      if (removal.deleted) deleted += 1;
      if (removal.protectedProductionAlias) protectedProductionAliases += 1;
    }
  }

  return {
    mode,
    inspected: deployments.length,
    openPullRequests: openPullRequests.length,
    deleteCandidates: classified.deleteCandidates.length,
    deleted,
    protectedProductionAliases,
    productionDomainCount,
    reasons: summarizeDecisions(classified.decisions),
  };
}
