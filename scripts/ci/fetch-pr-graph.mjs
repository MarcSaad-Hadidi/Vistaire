#!/usr/bin/env node

/**
 * Fetch the smallest bounded commit graph needed by the PR classifier.  A
 * failure is reported, but intentionally does not fail the job: the
 * classifier will then be unable to compute a merge-base and will select the
 * exhaustive matrix (fail closed).
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const event = String(process.env.GITHUB_EVENT_NAME ?? "").toLowerCase();
if (event !== "pull_request") process.exit(0);

function readPayload() {
  const payloadPath = process.env.GITHUB_EVENT_PATH;
  if (!payloadPath || !existsSync(payloadPath)) return {};
  try {
    return JSON.parse(readFileSync(payloadPath, "utf8"));
  } catch {
    return {};
  }
}

function report(message) {
  process.stderr.write(`${message}\n`);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) appendFileSync(summary, `- ${message}\n`);
}

const payload = readPayload();
const baseSha = payload.pull_request?.base?.sha;
const headSha = payload.pull_request?.head?.sha;
const pullNumber = payload.pull_request?.number;
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";
if (!/^[0-9a-f]{40}$/i.test(String(baseSha)) || !/^[0-9a-f]{40}$/i.test(String(headSha)) ||
    !/^\d+$/.test(String(pullNumber)) || !token) {
  report("PR graph unavailable: malformed payload or missing read token; classifier will use full CI.");
  process.exit(0);
}

const pullRef = `refs/pull/${pullNumber}/head`;
// GitHub accepts the short-lived Actions token through HTTP Basic auth.  Keep
// the encoded value in the child environment so neither Git's argv nor its
// normal command log can expose the raw token.
const basicAuth = Buffer.from(`${token}:x-oauth-basic`, "utf8").toString("base64");
const git = (args, options = {}) => {
  const { env: extraEnv, ...execOptions } = options;
  return execFileSync("git", args, {
    stdio: "inherit",
    ...execOptions,
    // Keep the token out of Git's process arguments and therefore out of
    // ordinary process-list/diagnostic output on a shared runner.
    env: {
      ...process.env,
      ...extraEnv,
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "http.extraheader",
      GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basicAuth}`
    }
  });
};
const hasMergeBase = () => {
  try {
    execFileSync("git", ["merge-base", baseSha, headSha], {
      stdio: ["ignore", "ignore", "ignore"]
    });
    return true;
  } catch {
    return false;
  }
};

try {
  git(["fetch", "--no-tags", "--filter=blob:none", "--depth=1", "origin", baseSha, pullRef]);
  if (hasMergeBase()) {
    report("PR graph ready: merge-base found after depth 1 fetch.");
    process.exit(0);
  }

  // Deepen only until the merge-base is present.  A bounded cap prevents a
  // pathological history from silently turning the classifier checkout into
  // a full clone; exhausting the cap intentionally falls back to full CI.
  for (const increment of [32, 128, 512, 2048]) {
    git(["fetch", "--no-tags", "--filter=blob:none", `--deepen=${increment}`, "origin", baseSha, pullRef]);
    if (hasMergeBase()) {
      report(`PR graph ready: merge-base found after additional depth ${increment}.`);
      process.exit(0);
    }
  }
  report("PR graph incomplete: merge-base not found within bounded history; classifier will use full CI.");
} catch {
  report("PR graph fetch failed; classifier will use full CI.");
}
