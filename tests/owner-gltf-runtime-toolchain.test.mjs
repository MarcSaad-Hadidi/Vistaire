import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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
  "scripts/owner/build-restaurant-meshy-dish.mjs",
  "scripts/build-demo-ar-lite-assets.mjs",
  "scripts/build-ios-quicklook-ultra-assets.mjs",
  "scripts/optimize-usdz-binary-layers.py",
  "node_modules/@gltf-transform/cli/**/*",
  "node_modules/@gltf-transform/core/**/*",
  "node_modules/@gltf-transform/extensions/**/*",
  "node_modules/@gltf-transform/functions/**/*",
  "node_modules/@babylonjs/core/**/*",
  "node_modules/@babylonjs/loaders/**/*",
  "node_modules/@babylonjs/serializers/**/*",
  "node_modules/fflate/**/*"
];

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

test("owner runtime child-process scripts and toolchain are explicitly traced", async () => {
  const nextConfig = await readFile("next.config.ts", "utf8");

  assert.match(nextConfig, /outputFileTracingIncludes/);
  for (const route of OWNER_PIPELINE_ROUTES) {
    assert.match(nextConfig, new RegExp(route.replaceAll("*", "\\*").replaceAll("/", "\\/")));
  }
  for (const include of TRACE_INCLUDES) {
    assert.match(
      nextConfig,
      new RegExp(include.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `${include} must be traced into the owner model runtime function`
    );
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
