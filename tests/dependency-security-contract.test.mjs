import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const [packageJson, packageLock] = await Promise.all([
  readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../package-lock.json", import.meta.url), "utf8").then(JSON.parse),
]);

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

function rangeFloor(range) {
  const match = /(\d+\.\d+\.\d+)/.exec(String(range));
  assert.ok(match, `expected a semver range with a concrete floor, received ${range}`);
  return match[1];
}

function hasVulnerableBraceExpansionVersion(version) {
  const [major] = versionTuple(version);
  if (major === 1) return compareVersions(version, "1.1.18") < 0;
  if (major === 2) return compareVersions(version, "2.1.4") < 0;
  if (major === 3) return compareVersions(version, "3.0.3") < 0;
  if (major === 4) return true;
  if (major === 5) return compareVersions(version, "5.0.9") < 0;
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
  assert.equal(packageJson.overrides?.["minimatch@3.1.5"]?.["brace-expansion"], "1.1.18");
  assert.equal(packageJson.overrides?.["minimatch@9.0.9"]?.["brace-expansion"], "2.1.4");
  assert.equal(packageJson.overrides?.["minimatch@10.2.5"]?.["brace-expansion"], "5.0.9");

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

test("PostCSS stays above the current advisory ceiling in declarations and the full lockfile", () => {
  const declaredRange = packageJson.devDependencies?.postcss;
  const lockedRootRange = packageLock.packages?.[""].devDependencies?.postcss;

  assert.equal(hasVulnerablePostcssVersion(rangeFloor(declaredRange)), false);
  assert.equal(hasVulnerablePostcssVersion(rangeFloor(lockedRootRange)), false);

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
