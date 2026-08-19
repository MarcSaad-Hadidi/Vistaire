#!/usr/bin/env node

import { lstat, readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC_ARTIFACT_EXTENSIONS = new Set([".html", ".rsc", ".body", ".meta"]);
const CREDENTIAL_QUERY_KEYS = [
  "token",
  "signature",
  "expires",
  "x-amz-algorithm",
  "x-amz-credential",
  "x-amz-signature",
  "x-amz-security-token"
];

function normalizedRelative(root, file) {
  return relative(root, file).split(sep).join("/");
}

function markerPatterns() {
  const querySeparator = String.raw`(?:\?|&|&amp;|\\u0026)`;
  return [
    {
      marker: "signed-storage-path",
      pattern: /\/storage\/v1\/object\/sign\//i
    },
    ...CREDENTIAL_QUERY_KEYS.map((key) => ({
      marker: `credential-query:${key}`,
      pattern: new RegExp(`${querySeparator}${key.replace(/-/g, "\\-")}\\s*=`, "i")
    })),
    {
      marker: "trusted-owner-bypass-header",
      pattern: /x-vistaire-owner-e2e-authorized/i
    }
  ];
}

function validateSentinels(sentinels) {
  if (!Array.isArray(sentinels)) {
    throw new TypeError("public artifact sentinels must be a JSON array");
  }
  return sentinels.map((sentinel, index) => {
    if (typeof sentinel !== "string" || sentinel.length === 0) {
      throw new TypeError(`public artifact sentinel[${index}] must be a non-empty string`);
    }
    return sentinel;
  });
}

function scanText(file, text, sentinels) {
  const findings = [];
  for (const { marker, pattern } of markerPatterns()) {
    if (pattern.test(text)) findings.push({ file, marker });
  }
  sentinels.forEach((sentinel, index) => {
    if (text.includes(sentinel)) {
      findings.push({ file, marker: `sentinel[${index}]` });
    }
  });
  return findings;
}

async function publicArtifactFiles(nextRoot) {
  const appRoot = join(nextRoot, "server", "app");
  const appRootStat = await lstat(appRoot);
  if (!appRootStat.isDirectory()) {
    throw new Error(`${normalizedRelative(nextRoot, appRoot)} is not a directory`);
  }

  const files = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const target = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        files.push({ file: target, symlink: true });
      } else if (entry.isDirectory()) {
        await visit(target);
      } else if (
        entry.isFile() &&
        PUBLIC_ARTIFACT_EXTENSIONS.has(extname(entry.name).toLowerCase())
      ) {
        files.push({ file: target, symlink: false });
      }
    }
  }
  await visit(appRoot);
  files.push({ file: join(nextRoot, "prerender-manifest.json"), symlink: false });
  return files;
}

export async function scanPublicPrerenderArtifacts(root, sentinels = []) {
  const nextRoot = resolve(root);
  const checkedSentinels = validateSentinels(sentinels);
  const findings = [];
  for (const candidate of await publicArtifactFiles(nextRoot)) {
    const file = normalizedRelative(nextRoot, candidate.file);
    if (candidate.symlink) {
      findings.push({ file, marker: "unsafe-symlink" });
      continue;
    }
    const text = await readFile(candidate.file, "utf8");
    findings.push(...scanText(file, text, checkedSentinels));
  }
  return findings.sort(
    (left, right) =>
      left.file.localeCompare(right.file) || left.marker.localeCompare(right.marker)
  );
}

function sentinelsFromEnvironment() {
  const raw = process.env.VISTAIRE_PUBLIC_ARTIFACT_SENTINELS ?? "[]";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("VISTAIRE_PUBLIC_ARTIFACT_SENTINELS must be valid JSON");
  }
  return validateSentinels(parsed);
}

async function main() {
  const findings = await scanPublicPrerenderArtifacts(
    resolve(".next"),
    sentinelsFromEnvironment()
  );
  if (findings.length > 0) {
    for (const finding of findings) {
      process.stderr.write(`${finding.file}: ${finding.marker}\n`);
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write("Static public prerender artifacts: PASS\n");
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`Static public prerender artifacts: FAIL (${error.message})\n`);
    process.exitCode = 1;
  });
}
