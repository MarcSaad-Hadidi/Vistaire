import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { NullEngine, Scene } from "@babylonjs/core";
import { AppendSceneAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import "@babylonjs/loaders/glTF/index.js";
import { USDZExportAsync } from "@babylonjs/serializers";
import * as fflate from "fflate";

globalThis.fflate = fflate;

if (process.env.ALLOW_LEGACY_AR_LITE_USDZ_CONVERTER !== "1") {
  console.error(
    "This legacy converter can create oversized iPhone USDZ files. Use `npm run demo:build-ios-ultra -- <dish-slug>` instead."
  );
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DEMO_DIR = join(ROOT, "public", "models", "demo");
const AR_LITE_DIR = join(DEMO_DIR, "ar-lite");
const OPTIMIZER = join(__dirname, "optimize-usdz-binary-layers.py");
const GLTF_TRANSFORM_CLI = join(
  ROOT,
  "node_modules",
  "@gltf-transform",
  "cli",
  "bin",
  "cli.js"
);
const TEMP_ROOT = join(ROOT, "asset-review", "3d-candidates", "ar-lite-usdz-build");

const USDZ_GOOD_BYTES = 10 * 1024 * 1024;

const FILES = [
  {
    input: "homard-bisque-ar-lite.glb",
    output: "homard-bisque-ios-quicklook-v2.usdz",
    maxTextureSize: 1536
  }
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "inherit",
    ...options
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with status ${result.status}${
        result.error ? `: ${result.error.message}` : ""
      }`
    );
  }
}

function formatSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function copyWithRetry(source, destination) {
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      copyFileSync(source, destination);
      return;
    } catch (error) {
      lastError = error;
      sleep(250);
    }
  }
  throw lastError;
}

function checkBudget(filePath) {
  const bytes = statSync(filePath).size;
  if (bytes > USDZ_GOOD_BYTES) {
    throw new Error(`${filePath} is ${formatSize(bytes)}, above ${formatSize(USDZ_GOOD_BYTES)}`);
  }
  console.log(`OK ${filePath} ${formatSize(bytes)}`);
}

function canImportOpenUsd(command) {
  const result = spawnSync(command, ["-c", "from pxr import Sdf, Usd, UsdUtils"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "ignore"
  });
  return result.status === 0;
}

function findOpenUsdPython() {
  const candidates = [
    process.env.USDZ_OPTIMIZER_PYTHON,
    "E:\\5.1\\python\\bin\\python.exe",
    "python"
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.includes("\\") && !existsSync(candidate)) continue;
    if (canImportOpenUsd(candidate)) return candidate;
  }

  throw new Error(
    "Missing Pixar OpenUSD Python bindings. Install usd-core or set USDZ_OPTIMIZER_PYTHON to a Python that can import pxr."
  );
}

function resizeGlbTextures(asset, sourceGlb, tempDir) {
  if (!asset.maxTextureSize) return sourceGlb;

  const resizedGlb = join(
    tempDir,
    asset.input.replace(/\.glb$/i, `-${asset.maxTextureSize}.glb`)
  );
  run(process.execPath, [
    GLTF_TRANSFORM_CLI,
    "resize",
    sourceGlb,
    resizedGlb,
    "--width",
    String(asset.maxTextureSize),
    "--height",
    String(asset.maxTextureSize)
  ]);
  return resizedGlb;
}

async function convertGlbToUsdz(glbPath, usdzPath, name) {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const data = readFileSync(glbPath);

  await AppendSceneAsync(new Uint8Array(data), scene, {
    pluginExtension: ".glb",
    name
  });

  const bytes = await USDZExportAsync(scene, {
    includeAnchoringProperties: true,
    modelFileName: "model.usda"
  });

  writeFileSync(usdzPath, Buffer.from(bytes));
  console.log(`OK ${name} unoptimized USDZ ${formatSize(bytes.byteLength)}`);
  scene.dispose();
  engine.dispose();
}

async function main() {
  mkdirSync(AR_LITE_DIR, { recursive: true });
  mkdirSync(TEMP_ROOT, { recursive: true });
  const optimizerPython = findOpenUsdPython();

  for (const asset of FILES) {
    const glbPath = join(AR_LITE_DIR, asset.input);
    if (!existsSync(glbPath)) {
      throw new Error(`Missing AR-lite GLB: ${glbPath}`);
    }

    console.log(`\nConverting ar-lite/${asset.input} to ${asset.output}`);

    const publicUsdz = join(AR_LITE_DIR, asset.output);
    const tempDir = join(TEMP_ROOT, `${Date.now()}-${asset.output.replace(/[^a-z0-9.-]/gi, "-")}`);
    const unoptimizedUsdz = join(tempDir, asset.output.replace(/\.usdz$/i, ".unoptimized.usdz"));
    const optimizedUsdz = join(tempDir, asset.output);
    const backupUsdz = join(tempDir, `${asset.output}.backup`);

    mkdirSync(tempDir, { recursive: true });
    if (existsSync(publicUsdz)) {
      copyWithRetry(publicUsdz, backupUsdz);
    }
    try {
      const workingGlb = resizeGlbTextures(asset, glbPath, tempDir);
      await convertGlbToUsdz(workingGlb, unoptimizedUsdz, asset.output);
      run(optimizerPython, [OPTIMIZER, unoptimizedUsdz, optimizedUsdz]);
      copyWithRetry(optimizedUsdz, publicUsdz);
    } catch (error) {
      if (existsSync(backupUsdz)) {
        copyWithRetry(backupUsdz, publicUsdz);
      }
      throw error;
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }

    checkBudget(publicUsdz);
  }

  rmSync(TEMP_ROOT, { recursive: true, force: true });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
