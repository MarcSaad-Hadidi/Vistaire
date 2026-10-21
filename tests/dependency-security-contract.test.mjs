import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const [packageJson, packageLock] = await Promise.all([
  readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../package-lock.json", import.meta.url), "utf8").then(JSON.parse),
]);

test("the npm audit baseline pins the current canonical lockfile", async () => {
  const [lockfile, baseline] = await Promise.all([
    readFile(new URL("../package-lock.json", import.meta.url), "utf8"),
    readFile(new URL("../ci/npm-audit-baseline.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  const hash = createHash("sha256").update(lockfile.replace(/\r\n/g, "\n")).digest("hex");
  assert.equal(baseline.lockfile_sha256, hash,
    "Dependency changes require a fresh npm audit and a reviewed baseline refresh; see docs/ci-supply-chain.md");
});

function versionTuple(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(String(version));
  assert.ok(match, `expected a concrete package version, received ${version}`);
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  const a = versionTuple(left);
  const b = versionTuple(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function hasVulnerableBraceExpansionVersion(version) {
  const [major] = versionTuple(version);
  // First patched releases for GHSA-q2hr-2g5m-vwhr, which supersedes the earlier advisories.
  if (major === 1) return compareVersions(version, "1.1.21") < 0;
  if (major === 2) return compareVersions(version, "2.1.7") < 0;
  if (major === 3) return compareVersions(version, "3.0.9") < 0;
  if (major === 4) return true;
  if (major === 5) return compareVersions(version, "5.0.12") < 0;
  return false;
}

function hasVulnerablePostcssVersion(version) {
  const [major] = versionTuple(version);
  return major < 8 || (major === 8 && compareVersions(version, "8.5.22") <= 0);
}

function packageVersions(packageName) {
  const rootPath = `node_modules/${packageName}`;
  const suffix = `/${rootPath}`;
  return Object.entries(packageLock.packages ?? {})
    .filter(([packagePath]) => packagePath === rootPath || packagePath.endsWith(suffix))
    .map(([packagePath, packageEntry]) => ({ packagePath, version: packageEntry.version }));
}

test("dependency overrides pin every affected brace-expansion branch to a fixed release", () => {
  for (const minimatch of ["minimatch@3.1.5", "minimatch@9.0.9", "minimatch@10.2.5"]) {
    const override = packageJson.overrides?.[minimatch]?.["brace-expansion"];
    assert.ok(override, `${minimatch} must pin brace-expansion`);
    assert.equal(hasVulnerableBraceExpansionVersion(override), false, `${minimatch} pins vulnerable ${override}`);
  }

  const versions = packageVersions("brace-expansion");
  assert.ok(versions.length > 0, "package-lock.json must contain brace-expansion entries");
  for (const { packagePath, version } of versions) {
    assert.equal(
      hasVulnerableBraceExpansionVersion(version),
      false,
      `${packagePath} resolves vulnerable brace-expansion ${version}`,
    );
  }
});

test("PostCSS is pinned above the current advisory ceiling in the full lockfile", () => {
  assert.equal(packageJson.devDependencies?.postcss, "^8.5.28");
  assert.equal(packageLock.packages?.[""].devDependencies?.postcss, "^8.5.28");

  const versions = packageVersions("postcss");
  assert.ok(versions.length > 0, "package-lock.json must contain postcss entries");
  for (const { packagePath, version } of versions) {
    assert.equal(
      hasVulnerablePostcssVersion(version),
      false,
      `${packagePath} resolves vulnerable postcss ${version}`,
    );
  }
});
