import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as fflate from "fflate";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC_DIR = join(ROOT, "public");
const DEMO_DIR = join(PUBLIC_DIR, "models", "demo");
const AR_LITE_DIR = join(DEMO_DIR, "ar-lite");
const DEMO_DATA = join(ROOT, "lib", "demoMenuData.ts");

const GLB_GOOD_BYTES = 12 * 1024 * 1024;
const GLB_MAX_BYTES = 15 * 1024 * 1024;
const USDZ_GOOD_BYTES = 10 * 1024 * 1024;
const USDZ_MAX_BYTES = 15 * 1024 * 1024;

const ASSETS = [
  {
    slug: "homard-bisque",
    sourceGlb: "homard-bisque.glb",
    sourceUsdz: "homard-bisque.usdz",
    arGlbUrl: "/models/demo/ar-lite/homard-bisque-ar-lite.glb",
    arUsdzUrl: "/models/demo/ar-lite/homard-bisque-ios-quicklook-v2.usdz"
  }
];

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function warn(message) {
  console.warn(`WARN ${message}`);
}

function ok(message) {
  console.log(`OK ${message}`);
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function assetPath(url) {
  const clean = url.split(/[?#]/)[0].replace(/^\//, "");
  return join(PUBLIC_DIR, clean);
}

function isGitLfsPointer(bytes) {
  return bytes
    .subarray(0, 64)
    .toString("utf8")
    .startsWith("version https://git-lfs.github.com/spec/v1");
}

function checkFile(path, label) {
  if (!existsSync(path)) {
    fail(`${label} missing: ${path}`);
    return null;
  }
  const bytes = readFileSync(path);
  if (bytes.length === 0) fail(`${label} is empty`);
  if (isGitLfsPointer(bytes)) fail(`${label} is a Git LFS pointer`);
  ok(`${label} exists (${formatSize(bytes.length)})`);
  return bytes;
}

function readGlbJson(bytes, label) {
  if (bytes.subarray(0, 4).toString("utf8") !== "glTF") {
    fail(`${label} invalid GLB signature`);
    return null;
  }
  const jsonLength = bytes.readUInt32LE(12);
  const jsonType = bytes.readUInt32LE(16);
  if (jsonType !== 0x4e4f534a) {
    fail(`${label} first chunk is not JSON`);
    return null;
  }
  try {
    return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8"));
  } catch (error) {
    fail(`${label} GLB JSON parse failed: ${error.message}`);
    return null;
  }
}

function checkGlb(filePath, label) {
  const bytes = checkFile(filePath, label);
  if (!bytes) return;
  const json = readGlbJson(bytes, label);
  if (!json) return;

  const required = json.extensionsRequired ?? [];
  if (required.length > 0) {
    fail(`${label} has required extensions not suitable for Scene Viewer: ${required.join(", ")}`);
  } else {
    ok(`${label} has no required glTF extensions`);
  }

  const size = statSync(filePath).size;
  if (size > GLB_MAX_BYTES) {
    fail(`${label} above max AR GLB budget: ${formatSize(size)}`);
  } else if (size > GLB_GOOD_BYTES) {
    warn(`${label} above good AR GLB budget, accepted only for premium visual fidelity: ${formatSize(size)}`);
  } else {
    ok(`${label} within good AR GLB budget`);
  }
}

function checkUsdz(filePath, label) {
  const bytes = checkFile(filePath, label);
  if (!bytes) return;
  if (bytes.subarray(0, 2).toString("utf8") !== "PK") {
    fail(`${label} invalid ZIP/USDZ signature`);
    return;
  }

  let zip;
  try {
    zip = fflate.unzipSync(bytes);
  } catch (error) {
    fail(`${label} unreadable USDZ ZIP: ${error.message}`);
    return;
  }

  const names = Object.keys(zip);
  const usdEntries = names.filter((name) => /\.usd[ac]?$/i.test(name));
  const geometryEntries = names.filter((name) => /geometries\/.*\.usd[ac]?$/i.test(name));
  if (usdEntries.length === 0) fail(`${label} has no USD layers`);
  if (geometryEntries.length === 0) fail(`${label} has no geometry layers`);
  if (names.some((name) => /\.usda$/i.test(name) && Buffer.from(zip[name]).toString("utf8").includes("undefined"))) {
    fail(`${label} contains undefined USDA references`);
  }
  ok(`${label} USD layers=${usdEntries.length}, geometry layers=${geometryEntries.length}`);

  const size = statSync(filePath).size;
  if (size > USDZ_MAX_BYTES) {
    fail(`${label} above max iOS USDZ budget: ${formatSize(size)}`);
  } else if (size > USDZ_GOOD_BYTES) {
    warn(`${label} above ideal iOS USDZ budget, accepted for premium visual fidelity: ${formatSize(size)}`);
  } else {
    ok(`${label} within ideal iOS USDZ budget`);
  }
}

function readDishBlock(slug) {
  const source = readFileSync(DEMO_DATA, "utf8");
  const blocks = source.match(/\{\s*id:\s*"dish-[\s\S]*?\n  \}/g) ?? [];
  return blocks.find((block) => block.includes(`slug: "${slug}"`)) ?? "";
}

function checkDishData(asset) {
  const block = readDishBlock(asset.slug);
  if (!block) {
    fail(`${asset.slug} missing from demoMenuData.ts`);
    return;
  }
  for (const [field, value] of [
    ["arModel3dUrl", asset.arGlbUrl],
    ["arUsdzUrl", asset.arUsdzUrl]
  ]) {
    if (!block.includes(`${field}: "${value}"`)) {
      fail(`${asset.slug} missing ${field}: ${value}`);
    } else {
      ok(`${asset.slug} declares ${field}`);
    }
  }
}

function checkNoPublicCandidates() {
  const candidateDir = join(AR_LITE_DIR, "_candidates");
  if (existsSync(candidateDir)) {
    fail(`temporary candidate folder must not remain in public: ${candidateDir}`);
  }
}

for (const asset of ASSETS) {
  checkDishData(asset);
  checkFile(join(DEMO_DIR, asset.sourceGlb), `${asset.slug} original GLB ${asset.sourceGlb}`);
  checkFile(join(DEMO_DIR, asset.sourceUsdz), `${asset.slug} original USDZ ${asset.sourceUsdz}`);
  checkGlb(assetPath(asset.arGlbUrl), `${asset.slug} AR-lite GLB ${basename(asset.arGlbUrl)}`);
  checkUsdz(assetPath(asset.arUsdzUrl), `${asset.slug} AR-lite USDZ ${basename(asset.arUsdzUrl)}`);
}

checkNoPublicCandidates();

if (process.exitCode) {
  console.error("AR-lite demo asset validation failed.");
  process.exit(process.exitCode);
}

console.log("AR-lite demo asset validation completed.");
