#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const [, , reportPath = "npm-audit.json", baselinePath = "ci/npm-audit-baseline.json"] = process.argv;

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read JSON file ${path}: ${error.message}`);
  }
}

function normalizeSeverity(value) {
  return String(value ?? "").toLowerCase();
}

const report = readJson(reportPath);
const baseline = readJson(baselinePath);
const packageLock = readJson("package-lock.json");

if (report.auditReportVersion !== 2 || !report.vulnerabilities || !report.metadata?.vulnerabilities) {
  throw new Error("npm audit report is incomplete; refusing to publish an implicit pass");
}
if (!packageLock.packages || typeof packageLock.packages !== "object") {
  throw new Error("package-lock.json must expose the npm packages map so advisory scope can be verified");
}
if (!Array.isArray(baseline.entries)) throw new Error("npm audit baseline must contain an entries array");
if (!/^[a-f0-9]{64}$/i.test(String(baseline.lockfile_sha256 ?? ""))) {
  throw new Error("npm audit baseline must pin the audited package-lock hash");
}

const lockfileHash = createHash("sha256")
  .update(readFileSync("package-lock.json", "utf8").replace(/\r\n/g, "\n"))
  .digest("hex");
const baselineLockfileMatch = lockfileHash === String(baseline.lockfile_sha256).toLowerCase();
if (!baselineLockfileMatch) {
  console.warn("npm audit baseline lockfile hash differs from the recorded audit baseline; continuing with substantive advisory validation");
}

const today = new Date().toISOString().slice(0, 10);
const baselineById = new Map();
for (const entry of baseline.entries) {
  for (const field of ["advisory_id", "package", "dependency_path", "scope", "severity", "exploitability", "owner", "issue", "reason", "expires_on"]) {
    if (!entry[field]) throw new Error(`baseline entry is missing ${field}`);
  }
  if (!["runtime", "dev"].includes(String(entry.scope).toLowerCase())) {
    throw new Error(`baseline scope must be runtime or dev: ${entry.advisory_id}`);
  }
  if (!/^GHSA-[A-Za-z0-9-]+$/.test(entry.advisory_id) && !/^CVE-\d{4}-\d+$/.test(entry.advisory_id)) {
    throw new Error(`baseline advisory id is invalid: ${entry.advisory_id}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(entry.expires_on))) {
    throw new Error(`baseline expiry must use YYYY-MM-DD: ${entry.advisory_id}`);
  }
  if (baselineById.has(entry.advisory_id)) throw new Error(`duplicate npm audit baseline advisory: ${entry.advisory_id}`);
  baselineById.set(entry.advisory_id, entry);
}

function resolveScope(nodes) {
  if (!Array.isArray(nodes) || nodes.length === 0) return "runtime";
  return nodes.every((node) => packageLock.packages[node]?.dev === true) ? "dev" : "runtime";
}

const advisories = new Map();
for (const [packageName, vulnerability] of Object.entries(report.vulnerabilities)) {
  for (const via of vulnerability.via ?? []) {
    if (typeof via !== "object" || !via.url || !via.source) continue;
    const severity = normalizeSeverity(via.severity);
    if (!["high", "critical"].includes(severity)) continue;
    const advisoryId = via.url.split("/").pop();
    const dependencyPaths = Array.isArray(vulnerability.nodes) ? vulnerability.nodes : [];
    advisories.set(advisoryId, {
      advisoryId,
      packageName,
      dependencyPaths,
      severity,
      scope: resolveScope(dependencyPaths),
    });
  }
}

function matchesBaseline(advisory, entry) {
  return Boolean(
    entry &&
      entry.package === advisory.packageName &&
      normalizeSeverity(entry.severity) === advisory.severity &&
      String(entry.scope).toLowerCase() === advisory.scope &&
      advisory.dependencyPaths.includes(entry.dependency_path)
  );
}

const expired = [];
const unbaselined = [];
let advisoriesBaselined = 0;
for (const advisory of advisories.values()) {
  const entry = baselineById.get(advisory.advisoryId);
  if (!matchesBaseline(advisory, entry)) {
    unbaselined.push(advisory);
    continue;
  }
  if (entry.expires_on <= today) {
    expired.push(advisory.advisoryId);
    continue;
  }
  advisoriesBaselined += 1;
}

for (const entry of baseline.entries) {
  if (!advisories.has(entry.advisory_id)) {
    console.warn(`stale npm audit baseline entry is not present in the current audit: ${entry.advisory_id}`);
  }
}

if (expired.length > 0) {
  for (const advisoryId of expired) console.error(`npm audit baseline expired: ${advisoryId}`);
  process.exitCode = 1;
}

if (unbaselined.length > 0) {
  console.error("Unbaselined high/critical npm advisories detected:");
  for (const advisory of unbaselined) {
    const paths = advisory.dependencyPaths.length > 0 ? advisory.dependencyPaths.join(", ") : "unknown-path";
    console.error(`- ${advisory.advisoryId} (${advisory.packageName}, ${advisory.severity}, ${advisory.scope}, ${paths})`);
  }
  process.exitCode = 1;
}

const metadata = report.metadata.vulnerabilities;
console.log(JSON.stringify({
  audit_complete: true,
  baseline_lockfile_match: baselineLockfileMatch,
  high: metadata.high,
  critical: metadata.critical,
  advisories_seen: advisories.size,
  advisories_baselined: advisoriesBaselined,
  stale_baseline_entries: baseline.entries.filter((entry) => !advisories.has(entry.advisory_id)).length,
}, null, 2));
