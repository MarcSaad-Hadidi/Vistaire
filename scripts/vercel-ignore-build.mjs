#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import process from "node:process";
import { pathToFileURL } from "node:url";

const SAFE_PREFIXES = ["docs/", "tests/", "e2e/", ".github/"];
const SAFE_FILES = new Set([
  "AGENTS.md",
  "README.md",
  "SECURITY.md",
  "design-qa.md"
]);

export function isVercelBuildSkippablePath(filePath) {
  const normalized = String(filePath ?? "").replaceAll("\\", "/").replace(/^\.\//, "");
  if (!normalized) return false;
  if (SAFE_FILES.has(normalized)) return true;
  return SAFE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function shouldSkipVercelBuild(filePaths) {
  return (
    Array.isArray(filePaths) &&
    filePaths.length > 0 &&
    filePaths.every((filePath) => isVercelBuildSkippablePath(filePath))
  );
}

function isCommitSha(value) {
  return /^[0-9a-f]{40}$/i.test(value ?? "") && !/^0{40}$/.test(value);
}

function readChangedPaths() {
  const previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA?.trim() ?? "";
  const currentSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim() ?? "";

  if (!isCommitSha(previousSha)) {
    console.log("Vercel build kept: VERCEL_GIT_PREVIOUS_SHA is unavailable or invalid.");
    return null;
  }

  const head = isCommitSha(currentSha) ? currentSha : "HEAD";

  try {
    const output = execFileSync("git", ["diff", "--name-only", previousSha, head], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });

    return output
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`Vercel build kept: unable to inspect changed files (${message}).`);
    return null;
  }
}

export function main() {
  const changedPaths = readChangedPaths();
  if (!changedPaths || !shouldSkipVercelBuild(changedPaths)) {
    if (changedPaths) {
      const runtimePaths = changedPaths.filter((filePath) => !isVercelBuildSkippablePath(filePath));
      console.log(
        `Vercel build kept: runtime/config changes detected (${runtimePaths.slice(0, 8).join(", ") || "none"}).`
      );
    }
    return 1;
  }

  console.log(`Vercel build skipped: ${changedPaths.length} docs/test-only file(s) changed.`);
  return 0;
}

const isCli = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  process.exitCode = main();
}
