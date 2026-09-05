import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const checkerPath = join(repoRoot, "scripts", "ci", "check-npm-audit-baseline.mjs");

function normalizedHash(value) {
  return createHash("sha256")
    .update(`${JSON.stringify(value, null, 2)}\n`.replace(/\r\n/g, "\n"))
    .digest("hex");
}

function makeReport({ packageName = "fixture-package", severity = "high", advisoryId = "GHSA-aaaa-bbbb-cccc", nodes = [], include = false } = {}) {
  return {
    auditReportVersion: 2,
    vulnerabilities: include
      ? {
          [packageName]: {
            name: packageName,
            severity,
            isDirect: false,
            via: [
              {
                source: 123456,
                name: packageName,
                dependency: packageName,
                title: "Fixture advisory",
                url: `https://github.com/advisories/${advisoryId}`,
                severity,
                range: "*",
              },
            ],
            effects: [],
            range: "*",
            nodes,
            fixAvailable: true,
          },
        }
      : {},
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 0,
        high: include && severity === "high" ? 1 : 0,
        critical: include && severity === "critical" ? 1 : 0,
        total: include ? 1 : 0,
      },
      dependencies: {
        prod: 0,
        dev: 0,
        optional: 0,
        peer: 0,
        peerOptional: 0,
        total: 0,
      },
    },
  };
}

function makeBaseline({ lockfileHash, entries = [] }) {
  return {
    schema_version: 1,
    owner: "Vistaire maintainers",
    lockfile_sha256: lockfileHash,
    entries,
  };
}

function makeEntry({ advisoryId = "GHSA-aaaa-bbbb-cccc", packageName = "fixture-package", dependencyPath = "node_modules/fixture-package", scope = "dev", severity = "high", expiresOn = "2099-01-01" } = {}) {
  return {
    advisory_id: advisoryId,
    package: packageName,
    dependency_path: dependencyPath,
    scope,
    severity,
    exploitability: "Synthetic fixture used to verify the CI security policy.",
    owner: "Vistaire maintainers",
    issue: "#fixture",
    reason: "Synthetic fixture only.",
    expires_on: expiresOn,
  };
}

function runFixture({ packageLock, report, baseline }) {
  const directory = mkdtempSync(join(tmpdir(), "vistaire-audit-baseline-"));
  try {
    writeFileSync(join(directory, "package-lock.json"), `${JSON.stringify(packageLock, null, 2)}\n`);
    writeFileSync(join(directory, "npm-audit.json"), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(join(directory, "baseline.json"), `${JSON.stringify(baseline, null, 2)}\n`);

    return spawnSync(process.execPath, [checkerPath, "npm-audit.json", "baseline.json"], {
      cwd: directory,
      encoding: "utf8",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("a changed lockfile does not fail when the complete audit contains no high or critical advisory", () => {
  const packageLock = {
    name: "fixture",
    lockfileVersion: 3,
    packages: { "": { name: "fixture" } },
  };
  const result = runFixture({
    packageLock,
    report: makeReport(),
    baseline: makeBaseline({ lockfileHash: "0".repeat(64) }),
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /lockfile hash differs from the recorded audit baseline/i);
  assert.match(result.stdout, /"baseline_lockfile_match": false/);
});

test("a baselined high advisory still passes after an unrelated lockfile change when package, path, severity, and dev scope match", () => {
  const dependencyPath = "node_modules/fixture-package";
  const packageLock = {
    name: "fixture",
    lockfileVersion: 3,
    packages: {
      "": { name: "fixture" },
      [dependencyPath]: { version: "1.0.0", dev: true },
    },
  };
  const result = runFixture({
    packageLock,
    report: makeReport({ include: true, nodes: [dependencyPath] }),
    baseline: makeBaseline({
      lockfileHash: "1".repeat(64),
      entries: [makeEntry({ dependencyPath })],
    }),
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"advisories_baselined": 1/);
});

test("a baselined dev advisory fails closed if the current lockfile moves it into runtime scope", () => {
  const dependencyPath = "node_modules/fixture-package";
  const packageLock = {
    name: "fixture",
    lockfileVersion: 3,
    packages: {
      "": { name: "fixture" },
      [dependencyPath]: { version: "1.0.0" },
    },
  };
  const result = runFixture({
    packageLock,
    report: makeReport({ include: true, nodes: [dependencyPath] }),
    baseline: makeBaseline({
      lockfileHash: normalizedHash(packageLock),
      entries: [makeEntry({ dependencyPath, scope: "dev" })],
    }),
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unbaselined high\/critical npm advisories detected/);
  assert.match(result.stderr, /runtime/);
});

test("an expired exemption blocks only when its advisory is still present in the current audit", () => {
  const dependencyPath = "node_modules/fixture-package";
  const packageLock = {
    name: "fixture",
    lockfileVersion: 3,
    packages: {
      "": { name: "fixture" },
      [dependencyPath]: { version: "1.0.0", dev: true },
    },
  };
  const activeResult = runFixture({
    packageLock,
    report: makeReport({ include: true, nodes: [dependencyPath] }),
    baseline: makeBaseline({
      lockfileHash: normalizedHash(packageLock),
      entries: [makeEntry({ dependencyPath, expiresOn: "2000-01-01" })],
    }),
  });
  assert.notEqual(activeResult.status, 0);
  assert.match(activeResult.stderr, /baseline expired/i);

  const staleResult = runFixture({
    packageLock,
    report: makeReport(),
    baseline: makeBaseline({
      lockfileHash: normalizedHash(packageLock),
      entries: [makeEntry({ dependencyPath, expiresOn: "2000-01-01" })],
    }),
  });
  assert.equal(staleResult.status, 0, staleResult.stderr);
  assert.match(staleResult.stderr, /stale npm audit baseline entry/i);
});
