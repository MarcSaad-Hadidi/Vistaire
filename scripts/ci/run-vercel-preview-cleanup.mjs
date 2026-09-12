import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { runCleanup, DEFAULT_GRACE_MS } from "./vercel-preview-cleanup.mjs";

function readGraceMs(env) {
  const value = Number(env.VERCEL_CLEANUP_GRACE_MS ?? DEFAULT_GRACE_MS);
  if (!Number.isInteger(value) || value < DEFAULT_GRACE_MS) {
    throw new Error(`VERCEL_CLEANUP_GRACE_MS must be an integer >= ${DEFAULT_GRACE_MS}`);
  }
  return value;
}

export function resolveCleanupRequest(env) {
  const eventName = env.GITHUB_EVENT_NAME ?? "";
  const eventAction = env.VERCEL_CLEANUP_EVENT_ACTION ?? "";
  const requestedMode = env.VERCEL_CLEANUP_MODE ?? "";
  const confirmation = env.VERCEL_CLEANUP_CONFIRMATION ?? "";

  if (eventName === "schedule") {
    return { mode: "apply", confirmation: "", eventName, eventAction: "" };
  }
  if (eventName === "pull_request" && eventAction === "closed") {
    return { mode: "apply", confirmation: "", eventName, eventAction };
  }
  if (eventName === "workflow_dispatch") {
    const mode = requestedMode || "dry-run";
    return { mode, confirmation, eventName, eventAction: "" };
  }
  throw new Error("Unsupported Vercel cleanup event");
}

function summaryLines(summary) {
  return [
    "## Vercel Preview Cleanup",
    `- Mode: ${summary.mode}`,
    `- Inspected deployments: ${summary.inspected}`,
    `- Open pull requests: ${summary.openPullRequests}`,
    `- Classifier delete candidates: ${summary.deleteCandidates}`,
    `- Verified production domains: ${summary.productionDomainCount}`,
    `- Candidates protected by production aliases: ${summary.protectedProductionAliases}`,
    `- Completed removals: ${summary.deleted}`,
    "- Minimum deployment age: 60 minutes",
    "- Production, custom-target, promoted and ambiguous deployments are never directly eligible",
    "",
    "### Decisions",
    ...Object.entries(summary.reasons ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([reason, count]) => `- ${reason}: ${count}`),
    "",
  ];
}

export async function runFromEnvironment({ env = process.env, fetchImpl = fetch, nowMs = Date.now() } = {}) {
  const request = resolveCleanupRequest(env);
  const summary = await runCleanup({
    ...request,
    env,
    fetchImpl,
    nowMs,
    graceMs: readGraceMs(env),
  });
  if (env.GITHUB_STEP_SUMMARY) {
    await appendFile(env.GITHUB_STEP_SUMMARY, `${summaryLines(summary).join("\n")}\n`, "utf8");
  }
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runFromEnvironment()
    .then((summary) => console.log(JSON.stringify(summary, null, 2)))
    .catch((error) => {
      console.error(`Vercel preview cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
}
