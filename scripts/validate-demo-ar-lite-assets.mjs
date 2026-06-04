import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as fflate from "fflate";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC_DIR = join(ROOT, "public");
const DEMO_DIR = join(PUBLIC_DIR, "models", "demo");
const DEMO_DATA = join(ROOT, "lib", "demoMenuData.ts");

const GLB_GOOD_BYTES = 12 * 1024 * 1024;
const GLB_MAX_BYTES = 15 * 1024 * 1024;
const USDZ_MAX_BYTES = 5 * 1024 * 1024;

const SOURCE_ASSETS = new Map([
  ["homard-bisque", { sourceGlb: "homard-bisque-meshy.glb", sourceUsdz: "homard-bisque.usdz" }],
  [
    "ravioles-romarin",
    { sourceGlb: "ravioles-chevre-miel-meshy.glb", sourceUsdz: "" }
  ],
  [
    "canette-aux-figues",
    { sourceGlb: "canette-aux-figues-meshy.glb", sourceUsdz: "" }
  ],
  ["bar-ligne", { sourceGlb: "bar-de-ligne-meshy.glb", sourceUsdz: "" }],
  ["pave-boeuf", { sourceGlb: "pave-boeuf-meshy.glb", sourceUsdz: "" }],
  [
    "souffle-chocolat",
    { sourceGlb: "souffle-chocolat-meshy.glb", sourceUsdz: "" }
  ]
]);

const AR_GLB_ASSETS = new Map([
  [
    "homard-bisque",
    { url: "/models/demo/ar-lite/homard-bisque-ar-lite-meshy.glb" }
  ],
  [
    "ravioles-romarin",
    { url: "/models/demo/ar-lite/ravioles-chevre-miel-ar-lite-meshy.glb" }
  ],
  [
    "canette-aux-figues",
    { url: "/models/demo/ar-lite/canette-aux-figues-ar-lite-meshy.glb" }
  ],
  ["bar-ligne", { url: "/models/demo/ar-lite/bar-de-ligne-ar-lite-meshy.glb" }],
  ["pave-boeuf", { url: "/models/demo/ar-lite/pave-boeuf-ar-lite-meshy.glb" }],
  [
    "souffle-chocolat",
    { url: "/models/demo/ar-lite/souffle-chocolat-ar-lite-meshy.glb" }
  ]
]);

const APPROVED_IOS_QUICK_LOOK_USDZ = new Map([
  [
    "ravioles-romarin",
    {
      url: "/models/demo/ar-lite/ravioles-chevre-miel-ios-quicklook-meshy.usdz",
      sha256: "9b34710b096d5841ad1d132f34e6e72d57f1d62947461e162dc33e587c01f46a"
    }
  ],
  [
    "homard-bisque",
    {
      url: "/models/demo/ar-lite/homard-bisque-ios-quicklook-meshy.usdz",
      sha256: "addff79da4a4e4b487949e4981a7e19cfcd39c82f1d4c36784d3c2a9d039c1e4"
    }
  ],
  [
    "canette-aux-figues",
    {
      url: "/models/demo/ar-lite/canette-aux-figues-ios-quicklook-meshy.usdz",
      sha256: "ee59fc87f9d82fd25ade110785902c5010067e04bb3d0d95daaa6cc7bda2e022"
    }
  ],
  [
    "bar-ligne",
    {
      url: "/models/demo/ar-lite/bar-de-ligne-ios-quicklook-meshy.usdz",
      sha256: "609863e9d20b06e3cb346adf10419bfb6b2f7a0ce1dcd57f7ad5b7ffcc8e5fb6"
    }
  ],
  [
    "pave-boeuf",
    {
      url: "/models/demo/ar-lite/pave-boeuf-ios-quicklook-meshy.usdz",
      sha256: "4c039567bf3311f9f1412ee865a875236087e01c98b51f27dadc21493e77fda4"
    }
  ],
  [
    "souffle-chocolat",
    {
      url: "/models/demo/ar-lite/souffle-chocolat-ios-quicklook-meshy.usdz",
      sha256: "d30e1134ccb10484c513fc26b293c8b902ae23662d63ce1fd291777e56f9f3ef"
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

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function formatSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function assetPath(url) {
  const clean = url.split("?")[0].split("#")[0];
  if (!clean.startsWith("/models/demo/")) {
    throw new Error(`Unexpected asset URL: ${url}`);
  }
  const relative = clean.replace(/^\/+/, "").split("/");
  return join(PUBLIC_DIR, ...relative);
}

function checkFile(path, label) {
  if (!existsSync(path)) {
    fail(`${label} missing: ${path}`);
    return false;
  }
  const bytes = statSync(path).size;
  ok(`${label} exists (${formatSize(bytes)})`);
  return true;
}

function checkFileHash(path, expectedSha256, label) {
  if (!checkFile(path, label)) return;
  const actual = sha256File(path);
  if (actual !== expectedSha256) {
    fail(`${label} sha256 mismatch (expected ${expectedSha256}, got ${actual})`);
    return;
  }
  ok(`${label} sha256 matches approved asset`);
}

function readGlbJson(path) {
  const buffer = readFileSync(path);
  const jsonLength = buffer.readUInt32LE(12);
  const jsonStart = 20;
  return JSON.parse(buffer.toString("utf8", jsonStart, jsonStart + jsonLength));
}

function checkGlbHasNoRequiredExtensions(path, label) {
  if (!existsSync(path)) return;
  const json = readGlbJson(path);
  const required = json.extensionsRequired ?? [];
  if (required.length > 0) {
    fail(`${label} requires glTF extensions: ${required.join(", ")}`);
    return;
  }
  ok(`${label} has no required glTF extensions`);
}

function checkGlbBudget(path, label) {
  if (!existsSync(path)) return;
  const bytes = statSync(path).size;
  if (bytes > GLB_MAX_BYTES) {
    fail(`${label} exceeds ${formatSize(GLB_MAX_BYTES)} (${formatSize(bytes)})`);
    return;
  }
  if (bytes > GLB_GOOD_BYTES) {
    warn(`${label} above good AR GLB budget (${formatSize(bytes)})`);
    ok(`${label} within maximum-premium AR GLB budget`);
    return;
  }
  ok(`${label} within good AR GLB budget`);
}

function inspectUsdz(path) {
  const buffer = readFileSync(path);
  const files = {};
  const entries = fflate.unzipSync(new Uint8Array(buffer));
  for (const [name, data] of Object.entries(entries)) {
    files[name] = data;
  }
  const usdaNames = Object.keys(files).filter((name) => name.endsWith("usda") || name.endsWith("usd"));
  const geometryLayers = usdaNames.filter((name) => /geom|mesh/i.test(name)).length;
  const textureNames = Object.keys(files).filter((name) => /\.(jpg|jpeg|png)$/i.test(name));
  return {
    layerCount: usdaNames.length,
    geometryLayers: geometryLayers || usdaNames.length,
    textures: textureNames.length
  };
}

function checkUsdz(path, expectedSha256, label) {
  if (!checkFile(path, label)) return;
  checkFileHash(path, expectedSha256, label);
  const bytes = statSync(path).size;
  if (bytes > USDZ_MAX_BYTES) {
    fail(`${label} exceeds production iOS USDZ budget (${formatSize(bytes)})`);
    return;
  }
  const summary = inspectUsdz(path);
  ok(
    `${label} USD layers=${summary.layerCount}, geometry layers=${summary.geometryLayers}, textures=${summary.textures}`
  );
  ok(`${label} within production iOS USDZ budget`);
}

function parseDemoMenuDishes(source) {
  const dishes = [];
  const dishBlocks = source.matchAll(
    /\{\s*id:\s*"dish-[^"]+",[\s\S]*?slug:\s*"([^"]+)"[\s\S]*?\}/g
  );
  for (const match of dishBlocks) {
    const block = match[0];
    const slug = match[1];
    const readField = (name) => {
      const fieldMatch = block.match(new RegExp(`${name}:\\s*"([^"]*)"`));
      return fieldMatch?.[1] ?? "";
    };
    dishes.push({
      slug,
      arModel3dUrl: readField("arModel3dUrl"),
      arUsdzUrl: readField("arUsdzUrl")
    });
  }
  return dishes;
}

const demoSource = readFileSync(DEMO_DATA, "utf8");
const dishes = parseDemoMenuDishes(demoSource);

for (const [slug, asset] of AR_GLB_ASSETS) {
  const dish = dishes.find((entry) => entry.slug === slug);
  if (!dish?.arModel3dUrl) {
    fail(`${slug} missing arModel3dUrl in demoMenuData.ts`);
    continue;
  }
  if (dish.arModel3dUrl !== asset.url) {
    fail(`${slug} arModel3dUrl mismatch: ${dish.arModel3dUrl}`);
    continue;
  }
  ok(`${slug} declares approved arModel3dUrl`);
}

for (const [slug, asset] of APPROVED_IOS_QUICK_LOOK_USDZ) {
  const dish = dishes.find((entry) => entry.slug === slug);
  if (!dish?.arUsdzUrl) {
    fail(`${slug} missing arUsdzUrl in demoMenuData.ts`);
    continue;
  }
  if (dish.arUsdzUrl !== asset.url) {
    fail(`${slug} arUsdzUrl mismatch: ${dish.arUsdzUrl}`);
    continue;
  }
  if (/[?#]/.test(dish.arUsdzUrl)) {
    fail(`${slug} arUsdzUrl must be stable without query/hash`);
    continue;
  }
  if (!dish.arUsdzUrl.startsWith("/models/demo/ar-lite/") || !dish.arUsdzUrl.endsWith(".usdz")) {
    fail(`${slug} arUsdzUrl must live under /models/demo/ar-lite/*.usdz`);
    continue;
  }
  ok(`${slug} declares approved arUsdzUrl`);
  ok(`${slug} arUsdzUrl uses stable URL`);
  ok(`${slug} arUsdzUrl lives under /models/demo/ar-lite/*.usdz`);
}

for (const [slug, asset] of SOURCE_ASSETS) {
  const glbPath = join(DEMO_DIR, asset.sourceGlb);
  checkFile(glbPath, `${slug} original GLB ${asset.sourceGlb}`);
  if (asset.sourceUsdz) {
    const usdzPath = join(DEMO_DIR, asset.sourceUsdz);
    checkFile(usdzPath, `${slug} original USDZ ${asset.sourceUsdz}`);
  } else {
    ok(`${slug} original USDZ lourd retire du tree public de deploiement`);
  }
}

for (const [slug, asset] of AR_GLB_ASSETS) {
  const glbPath = assetPath(asset.url);
  const label = `${slug} AR-lite GLB ${basename(glbPath)}`;
  checkGlbHasNoRequiredExtensions(glbPath, label);
  checkGlbBudget(glbPath, label);
}

for (const [slug, asset] of APPROVED_IOS_QUICK_LOOK_USDZ) {
  const usdzPath = assetPath(asset.url);
  checkUsdz(usdzPath, asset.sha256, `${slug} AR-lite USDZ ${basename(usdzPath)}`);
}

console.log("AR-lite demo asset validation completed.");
process.exit(process.exitCode ?? 0);
