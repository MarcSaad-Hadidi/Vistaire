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
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";
setOutput("merge_base_depth", "");
if (!/^[0-9a-f]{40}$/i.test(String(baseSha)) || !/^[0-9a-f]{40}$/i.test(String(headSha)) ||
    !/^\d+$/.test(String(pullNumber)) || !token) {
  report("PR graph unavailable: malformed payload or missing read token; classifier will use full CI.");
  process.exit(0);
}

const pullRef = `refs/pull/${pullNumber}/head`;
// Override only the child process' remote URL. This avoids putting the token
// in Git's argv while remaining compatible with the Actions checkout's Git
// configuration, which may ignore transient HTTP headers after cleanup.
let authenticatedOrigin;
try {
  const origin = execFileSync("git", ["remote", "get-url", "origin"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();
  authenticatedOrigin = origin.replace(
    /^(https?:\/\/)(github\.com\/)/i,
    `$1x-access-token:${encodeURIComponent(token)}@$2`
  );
  if (authenticatedOrigin === origin) {
    report("PR graph unavailable: origin is not an HTTPS GitHub remote; classifier will use full CI.");
    process.exit(0);
  }
} catch {
  report("PR graph unavailable: origin remote could not be read; classifier will use full CI.");
  process.exit(0);
}

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
      GIT_CONFIG_KEY_0: "remote.origin.url",
      GIT_CONFIG_VALUE_0: authenticatedOrigin,
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
