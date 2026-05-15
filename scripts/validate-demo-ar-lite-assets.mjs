import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, normalize, sep } from "node:path";
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
const USDZ_MAX_BYTES = 5 * 1024 * 1024;

const SOURCE_ASSETS = new Map([
  ["homard-bisque", { sourceGlb: "homard-bisque.glb", sourceUsdz: "homard-bisque.usdz" }],
  [
    "ravioles-romarin",
    { sourceGlb: "ravioles-chevre-miel.glb", sourceUsdz: "ravioles-chevre-miel.usdz" }
  ],
  [
    "souffle-chocolat",
    { sourceGlb: "souffle-chocolat.glb", sourceUsdz: "souffle-chocolat.usdz" }
  ]
]);

const AR_GLB_ASSETS = new Map([
  [
    "homard-bisque",
    { url: "/models/demo/ar-lite/homard-bisque-ar-lite.glb" }
  ]
]);

const APPROVED_IOS_QUICK_LOOK_USDZ = new Map([
  [
    "homard-bisque",
    {
      url: "/models/demo/ar-lite/homard-bisque-ios-quicklook-ultra.usdz",
      sha256: "2bc1c0e6f33b807417bd03e931ae552a724935b8b193c419cdbf989337a18a13"
    }
  ],
  [
    "souffle-chocolat",
    {
      url: "/models/demo/ar-lite/souffle-chocolat-ios-quicklook-ultra.usdz",
      sha256: "1ab81a3e292e0f290441028e20b7f2fb56e547c07851e2818abb651c8acfcea5"
    }
  ]
]);

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
  const clean = url.split(/[?#]/)[0].replace(/^\/+/, "");
  const fullPath = normalize(join(PUBLIC_DIR, clean));
  const publicRoot = normalize(PUBLIC_DIR);
  if (fullPath !== publicRoot && !fullPath.startsWith(`${publicRoot}${sep}`)) {
    fail(`asset escapes public/: ${url}`);
    return null;
  }
  return fullPath;
}

function isGitLfsPointer(bytes) {
  return bytes
    .subarray(0, 64)
    .toString("utf8")
    .startsWith("version https://git-lfs.github.com/spec/v1");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function checkFile(path, label) {
  if (!path || !existsSync(path)) {
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

function checkStableArUsdzUrl(url, label) {
  if (/[?#]/.test(url)) {
    fail(`${label} must be a stable URL without query string/hash`);
  } else {
    ok(`${label} uses stable URL`);
  }
  if (!url.startsWith("/models/demo/ar-lite/") || !url.endsWith(".usdz")) {
    fail(`${label} must be a /models/demo/ar-lite/*.usdz production URL`);
  } else {
    ok(`${label} lives under /models/demo/ar-lite/*.usdz`);
  }
}

function checkUsdz(filePath, label, expectedSha256) {
  const bytes = checkFile(filePath, label);
  if (!bytes) return;
  if (bytes.subarray(0, 2).toString("utf8") !== "PK") {
    fail(`${label} invalid ZIP/USDZ signature`);
    return;
  }
  if (expectedSha256) {
    const actual = sha256(bytes);
    if (actual !== expectedSha256) {
      fail(`${label} sha256 mismatch: ${actual}`);
    } else {
      ok(`${label} sha256 matches approved asset`);
    }
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
  const imageEntries = names.filter((name) => /\.(?:png|jpe?g)$/i.test(name));
  if (usdEntries.length === 0) fail(`${label} has no USD layers`);
  if (geometryEntries.length === 0) fail(`${label} has no geometry layers`);
  if (imageEntries.length === 0) fail(`${label} has no texture images`);
  if (names.some((name) => /\.usda$/i.test(name) && Buffer.from(zip[name]).toString("utf8").includes("undefined"))) {
    fail(`${label} contains undefined USDA references`);
  }
  ok(
    `${label} USD layers=${usdEntries.length}, geometry layers=${geometryEntries.length}, textures=${imageEntries.length}`
  );

  const size = statSync(filePath).size;
  if (size > USDZ_MAX_BYTES) {
    fail(`${label} above max iOS USDZ budget: ${formatSize(size)}`);
  } else {
    ok(`${label} within production iOS USDZ budget`);
  }
}

function readDishes() {
  const source = readFileSync(DEMO_DATA, "utf8");
  const blocks = source.match(/\{\s*id:\s*"dish-[\s\S]*?\n  \}/g) ?? [];
  return blocks.map((block) => ({
    slug: block.match(/slug:\s*"([^"]+)"/)?.[1] ?? "",
    arModel3dUrl: block.match(/arModel3dUrl:\s*"([^"]*)"/)?.[1] ?? "",
    arUsdzUrl: block.match(/arUsdzUrl:\s*"([^"]*)"/)?.[1] ?? ""
  }));
}

function checkDishData(dishes) {
  for (const [slug, asset] of AR_GLB_ASSETS) {
    const dish = dishes.find((item) => item.slug === slug);
    if (!dish) {
      fail(`${slug} missing from demoMenuData.ts`);
      continue;
    }
    if (dish.arModel3dUrl !== asset.url) {
      fail(`${slug} arModel3dUrl mismatch: ${dish.arModel3dUrl || "(absent)"}`);
    } else {
      ok(`${slug} declares approved arModel3dUrl`);
    }
  }

  for (const [slug, asset] of APPROVED_IOS_QUICK_LOOK_USDZ) {
    const dish = dishes.find((item) => item.slug === slug);
    if (!dish) {
      fail(`${slug} missing from demoMenuData.ts`);
      continue;
    }
    if (dish.arUsdzUrl !== asset.url) {
      fail(`${slug} arUsdzUrl mismatch: ${dish.arUsdzUrl || "(absent)"}`);
    } else {
      ok(`${slug} declares approved arUsdzUrl`);
      checkStableArUsdzUrl(dish.arUsdzUrl, `${slug} arUsdzUrl`);
    }
  }

  for (const dish of dishes.filter((item) => item.arUsdzUrl)) {
    if (!APPROVED_IOS_QUICK_LOOK_USDZ.has(dish.slug)) {
      fail(`${dish.slug} declares unapproved arUsdzUrl: ${dish.arUsdzUrl}`);
    }
  }
}

function checkNoPublicCandidates() {
  const candidateDir = join(AR_LITE_DIR, "_candidates");
  if (existsSync(candidateDir)) {
    fail(`temporary candidate folder must not remain in public: ${candidateDir}`);
  }
}

const dishes = readDishes();
checkDishData(dishes);

for (const [slug, asset] of SOURCE_ASSETS) {
  checkFile(join(DEMO_DIR, asset.sourceGlb), `${slug} original GLB ${asset.sourceGlb}`);
  checkFile(join(DEMO_DIR, asset.sourceUsdz), `${slug} original USDZ ${asset.sourceUsdz}`);
}

for (const [slug, asset] of AR_GLB_ASSETS) {
  checkGlb(assetPath(asset.url), `${slug} AR-lite GLB ${basename(asset.url)}`);
}

for (const [slug, asset] of APPROVED_IOS_QUICK_LOOK_USDZ) {
  checkUsdz(
    assetPath(asset.url),
    `${slug} AR-lite USDZ ${basename(asset.url)}`,
    asset.sha256
  );
}

checkNoPublicCandidates();

if (process.exitCode) {
  console.error("AR-lite demo asset validation failed.");
  process.exit(process.exitCode);
}

console.log("AR-lite demo asset validation completed.");
