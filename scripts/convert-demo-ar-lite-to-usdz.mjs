import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DEMO_DIR = join(ROOT, "public", "models", "demo");
const AR_LITE_DIR = join(DEMO_DIR, "ar-lite");
const OPTIMIZER = join(__dirname, "optimize-usdz-binary-layers.py");
const TEMP_ROOT = join(ROOT, "asset-review", "3d-candidates", "ar-lite-usdz-build");

const USDZ_GOOD_BYTES = 15 * 1024 * 1024;

const FILES = ["homard-bisque-ar-lite.glb"];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "inherit",
    ...options
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`);
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

async function main() {
  mkdirSync(AR_LITE_DIR, { recursive: true });
  mkdirSync(TEMP_ROOT, { recursive: true });
  const optimizerPython = findOpenUsdPython();

  for (const file of FILES) {
    const glbPath = join(AR_LITE_DIR, file);
    if (!existsSync(glbPath)) {
      throw new Error(`Missing AR-lite GLB: ${glbPath}`);
    }

    const nestedName = `ar-lite/${file}`;
    console.log(`\nConverting ${nestedName} to USDZ`);

    const usdzName = file.replace(/\.glb$/i, ".usdz");
    const publicUsdz = join(AR_LITE_DIR, usdzName);
    const tempDir = join(TEMP_ROOT, `${Date.now()}-${usdzName.replace(/[^a-z0-9.-]/gi, "-")}`);
    const optimizedUsdz = join(tempDir, usdzName);
    const backupUsdz = join(tempDir, `${usdzName}.backup`);

    mkdirSync(tempDir, { recursive: true });
    if (existsSync(publicUsdz)) {
      copyWithRetry(publicUsdz, backupUsdz);
    }
    try {
      run(process.execPath, [join(__dirname, "convert-demo-glb-to-usdz.mjs"), nestedName]);
      run(optimizerPython, [
        OPTIMIZER,
        publicUsdz,
        optimizedUsdz
      ]);
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
