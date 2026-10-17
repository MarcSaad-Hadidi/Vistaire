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
function setOutput(name, value) {
  const output = process.env.GITHUB_OUTPUT;
  if (output) appendFileSync(output, `${name}=${String(value)}\n`);
}

if (event !== "pull_request") {
  setOutput("merge_base_depth", "");
  process.exit(0);
}

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
setOutput("merge_base_depth", "");
if (!/^[0-9a-f]{40}$/i.test(String(baseSha)) || !/^[0-9a-f]{40}$/i.test(String(headSha)) ||
    !/^\d+$/.test(String(pullNumber))) {
  report("PR graph unavailable: malformed payload; classifier will use full CI.");
  process.exit(0);
}

const pullRef = `refs/pull/${pullNumber}/head`;
// Vistaire is public: bounded metadata fetches need no credential. PR-owned
// helpers must remain token-free; an unavailable remote still fails closed.
const git = (args, options = {}) => {
  const { env: extraEnv, ...execOptions } = options;
  return execFileSync("git", args, {
    stdio: "inherit",
    ...execOptions,
    env: {
      ...process.env,
      ...extraEnv,
      GIT_TERMINAL_PROMPT: "0"
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
    setOutput("merge_base_depth", "1");
    report("PR graph ready: merge-base found after depth 1 fetch.");
    process.exit(0);
  }

  // Deepen only until the merge-base is present.  A bounded cap prevents a
  // pathological history from silently turning the classifier checkout into
  // a full clone; exhausting the cap intentionally falls back to full CI.
  for (const increment of [32, 128, 512, 2048]) {
    git(["fetch", "--no-tags", "--filter=blob:none", `--deepen=${increment}`, "origin", baseSha, pullRef]);
    if (hasMergeBase()) {
      setOutput("merge_base_depth", String(1 + increment));
      report(`PR graph ready: merge-base found after additional depth ${increment}.`);
      process.exit(0);
    }
  }
  report("PR graph incomplete: merge-base not found within bounded history; classifier will use full CI.");
} catch {
  report("PR graph fetch failed; classifier will use full CI.");
}
