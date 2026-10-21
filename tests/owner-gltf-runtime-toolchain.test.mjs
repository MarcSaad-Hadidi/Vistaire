import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import nextConfig from "../next.config.ts";

const OWNER_PIPELINE_ROUTES = [
  "/api/owner/restaurants/*/dishes/*/model/glb",
  "/api/owner/restaurants/*/dishes/*/model/publish"
];

const RUNTIME_DEPENDENCIES = [
  "@babylonjs/core",
  "@babylonjs/loaders",
  "@babylonjs/serializers",
  "@gltf-transform/cli",
  "@gltf-transform/core",
  "@gltf-transform/functions",
  "fflate"
];

const TRACE_INCLUDES = [
  "scripts/shared/gltf-transform-cli.mjs",
  "scripts/shared/ios-quicklook-promotion.mjs",
  "scripts/owner/build-restaurant-meshy-dish.mjs",
  "scripts/build-demo-ar-lite-assets.mjs",
  "scripts/build-ios-quicklook-ultra-assets.mjs",
  "scripts/optimize-usdz-binary-layers.py"
];

const RUNTIME_TRACE_ROOT_PACKAGES = [
  "@babylonjs/core",
  "@babylonjs/loaders",
  "@babylonjs/serializers",
  "@gltf-transform/cli",
  "@gltf-transform/core",
  "@gltf-transform/extensions",
  "@gltf-transform/functions",
  "fflate"
];

const MODEL_LAB_ROUTE = "/api/owner/model-lab/optimize";
const MODEL_LAB_WORKER = "lib/owner/modelLab/optimizeWorker.mjs";
const MODEL_LAB_ROOT_PACKAGES = [
  "@gltf-transform/core",
  "@gltf-transform/extensions",
  "@gltf-transform/functions",
  "meshoptimizer",
  "sharp"
];

function packagePathForName(name) {
  return `node_modules/${name}`;
}

function dependencyPathForPackage(packages, packagePath, dependencyName) {
  const nestedPath = `${packagePath}/node_modules/${dependencyName}`;
  return packages[nestedPath] ? nestedPath : packagePathForName(dependencyName);
}

function collectRuntimePackageClosure(packageLock, roots) {
  const packages = packageLock.packages ?? {};
  const seen = new Set();
  const stack = roots.map(packagePathForName);

  while (stack.length > 0) {
    const packagePath = stack.pop();
    if (!packagePath || seen.has(packagePath)) continue;

    const packageEntry = packages[packagePath];
    assert.ok(packageEntry, `${packagePath} must exist in package-lock.json`);
    seen.add(packagePath);

    const dependencies = {
      ...(packageEntry.dependencies ?? {}),
      ...(packageEntry.optionalDependencies ?? {}),
      ...(packageEntry.peerDependencies ?? {})
    };
    for (const dependencyName of Object.keys(dependencies)) {
      if (dependencyName.startsWith("@types/")) continue;
      stack.push(dependencyPathForPackage(packages, packagePath, dependencyName));
    }
  }

  return [...seen].sort();
}

function traceIncludeCoversPackagePath(traceInclude, packagePath) {
  const prefix = traceInclude.replace(/\/\*\*\/\*$/, "");
  return packagePath === prefix || packagePath.startsWith(`${prefix}/`);
}

test("owner runtime GLB conversion packages are production dependencies", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));

  for (const dependency of RUNTIME_DEPENDENCIES) {
    assert.ok(
      packageJson.dependencies?.[dependency],
      `${dependency} must be available to Vercel request runtime`
    );
    assert.equal(
      packageJson.devDependencies?.[dependency],
      undefined,
      `${dependency} must not be dev-only because owner upload runs it at request runtime`
    );
  }
});

test("owner runtime child-process scripts and toolchain are explicitly traced", () => {
  for (const route of OWNER_PIPELINE_ROUTES) {
    const includes = nextConfig.outputFileTracingIncludes[route];
    assert.ok(includes);
    for (const include of TRACE_INCLUDES) {
      assert.ok(includes.includes(include), `${route} must trace ${include}`);
    }
    assert.ok(!includes.includes(MODEL_LAB_WORKER));
  }
  const modelLabIncludes = nextConfig.outputFileTracingIncludes[MODEL_LAB_ROUTE];
  assert.ok(modelLabIncludes.includes(MODEL_LAB_WORKER));
  assert.ok(!modelLabIncludes.some((include) => include.startsWith("scripts/")));
  for (const packagePath of ["node_modules/@babylonjs/core", "node_modules/@gltf-transform/cli"]) {
    assert.ok(!modelLabIncludes.some((include) => traceIncludeCoversPackagePath(include, packagePath)));
  }
  assert.deepEqual(nextConfig.outputFileTracingExcludes[MODEL_LAB_ROUTE], ["public/**/*"]);
});

test("each owner runtime trace includes its own package-lock dependency closure", async () => {
  const packageLock = JSON.parse(await readFile("package-lock.json", "utf8"));
  for (const route of [...OWNER_PIPELINE_ROUTES, MODEL_LAB_ROUTE]) {
    const packageTraceIncludes = nextConfig.outputFileTracingIncludes[route];
    const runtimePackagePaths = collectRuntimePackageClosure(
      packageLock,
      route === MODEL_LAB_ROUTE ? MODEL_LAB_ROOT_PACKAGES : RUNTIME_TRACE_ROOT_PACKAGES
    );

    for (const reviewedPackagePath of [
      "node_modules/property-graph",
      "node_modules/ndarray",
      "node_modules/ndarray-pixels"
    ]) {
      assert.ok(
        runtimePackagePaths.includes(reviewedPackagePath),
        `${reviewedPackagePath} must be part of the checked runtime closure`
      );
    }

    const missingPackagePaths = runtimePackagePaths.filter(
      (packagePath) =>
        !packageTraceIncludes.some((traceInclude) =>
          traceIncludeCoversPackagePath(traceInclude, packagePath)
        )
    );
    assert.deepEqual(missingPackagePaths, [], route);
  }
});

test("owner runtime scripts resolve glTF Transform CLI through Node resolution", async () => {
  const scriptPaths = [
    "scripts/owner/build-restaurant-meshy-dish.mjs",
    "scripts/build-demo-ar-lite-assets.mjs",
    "scripts/build-ios-quicklook-ultra-assets.mjs"
  ];

  for (const scriptPath of scriptPaths) {
    const source = await readFile(scriptPath, "utf8");
    assert.match(source, /resolveGltfTransformCliPath/);
    assert.doesNotMatch(
      source,
      /node_modules["'][\s\S]*@gltf-transform["'][\s\S]*cli["'][\s\S]*bin["'][\s\S]*cli\.js/
    );
  }
});

test("owner runtime USDZ generation falls back when OpenUSD Python is unavailable", async () => {
  const iosBuilder = await readFile("scripts/build-ios-quicklook-ultra-assets.mjs", "utf8");

  assert.match(iosBuilder, /findOpenUsdPython\(\)[\s\S]*return null/);
  assert.match(iosBuilder, /OpenUSD unavailable[\s\S]*raw USDZ/);
  assert.match(iosBuilder, /copyFileSync\(rawUsdz, optimizedUsdz\)/);
  assert.doesNotMatch(iosBuilder, /throw new Error\(\s*"Missing Pixar OpenUSD Python bindings/);
});

test("owner runtime temp output skips the asset-review-only OpenUSD optimizer", async () => {
  const ownerBuilder = await readFile("scripts/owner/build-restaurant-meshy-dish.mjs", "utf8");
  const iosBuilder = await readFile("scripts/build-ios-quicklook-ultra-assets.mjs", "utf8");

  assert.match(ownerBuilder, /VISTAIRE_MESHY_SKIP_OPENUSD_OPTIMIZER/);
  assert.match(iosBuilder, /VISTAIRE_MESHY_SKIP_OPENUSD_OPTIMIZER/);
  assert.match(iosBuilder, /OpenUSD optimizer skipped[\s\S]*raw USDZ/);
});

test("owner Meshy builder requires a Quick Look promotion manifest", async () => {
  const ownerBuilder = await readFile("scripts/owner/build-restaurant-meshy-dish.mjs", "utf8");

  assert.match(ownerBuilder, /iosPromotionManifest/);
  assert.match(ownerBuilder, /Manifest promotion iOS Quick Look introuvable/);
  assert.match(ownerBuilder, /iosQuickLookPromotion\.selectedLevel/);
  assert.doesNotMatch(
    ownerBuilder,
    /iosQuickLookPromotion\s*=\s*existsSync[\s\S]*:\s*null/
  );
});
