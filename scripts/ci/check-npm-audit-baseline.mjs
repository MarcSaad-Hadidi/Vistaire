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

const report = readJson(reportPath);
const baseline = readJson(baselinePath);
if (report.auditReportVersion !== 2 || !report.vulnerabilities || !report.metadata?.vulnerabilities) {
  throw new Error("npm audit report is incomplete; refusing to publish an implicit pass");
}
if (!Array.isArray(baseline.entries)) throw new Error("npm audit baseline must contain an entries array");
if (!/^[a-f0-9]{64}$/i.test(String(baseline.lockfile_sha256 ?? ""))) {
  throw new Error("npm audit baseline must pin the audited package-lock hash");
}
const lockfileHash = createHash("sha256")
  .update(readFileSync("package-lock.json", "utf8").replace(/\r\n/g, "\n"))
  .digest("hex");
if (lockfileHash !== String(baseline.lockfile_sha256).toLowerCase()) {
  console.error(
    `package-lock.json changed since the audit baseline was recorded; expected=${String(baseline.lockfile_sha256).toLowerCase()} current=${lockfileHash}`
  );
  process.exitCode = 1;
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
  if (entry.expires_on <= today) throw new Error(`npm audit baseline expired: ${entry.advisory_id}`);
  if (baselineById.has(entry.advisory_id)) throw new Error(`duplicate npm audit baseline advisory: ${entry.advisory_id}`);
  baselineById.set(entry.advisory_id, entry);
}

const advisories = new Map();
for (const [packageName, vulnerability] of Object.entries(report.vulnerabilities)) {
  for (const via of vulnerability.via ?? []) {
    if (typeof via !== "object" || !via.url || !via.source) continue;
    if (!["high", "critical"].includes(String(via.severity).toLowerCase())) continue;
    const advisoryId = via.url.split("/").pop();
    advisories.set(advisoryId, {
      advisoryId,
      packageName,
      dependencyPath: vulnerability.nodes ?? [],
      severity: via.severity,
    });
  }
}

const unbaselined = [...advisories.values()].filter((advisory) => {
  const entry = baselineById.get(advisory.advisoryId);
  return !entry || entry.package !== advisory.packageName || entry.severity.toLowerCase() !== advisory.severity.toLowerCase();
});
if (unbaselined.length > 0) {
  console.error("Unbaselined high/critical npm advisories detected:");
  for (const advisory of unbaselined) console.error(`- ${advisory.advisoryId} (${advisory.packageName}, ${advisory.severity})`);
  process.exitCode = 1;
}

const metadata = report.metadata.vulnerabilities;
console.log(JSON.stringify({
  audit_complete: true,
  high: metadata.high,
  critical: metadata.critical,
  advisories_seen: advisories.size,
  advisories_baselined: [...advisories.keys()].filter((id) => baselineById.has(id)).length,
}, null, 2));
