import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

import * as fflate from "fflate";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC_DIR = join(ROOT, "public");
const DEMO_DATA = join(ROOT, "lib", "demoMenuData.ts");

export const MAX_PRODUCTION_IOS_USDZ_BYTES = 5 * 1024 * 1024;

const NON_PRODUCTION_APPROVAL_MARKER =
  /\b(?:not\s+production[-\s]?approved|non[-\s]?production[-\s]?approved|production[-\s]?approved\s*[:=]\s*false)\b/i;

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

function isGitLfsPointer(bytes) {
  return bytes
    .subarray(0, 64)
    .toString("utf8")
    .startsWith("version https://git-lfs.github.com/spec/v1");
}

function assetPath(url) {
  const clean = url.split(/[?#]/)[0];
  const relative = clean.replace(/^\/+/, "");
  const fullPath = normalize(join(PUBLIC_DIR, relative));
  const publicRoot = normalize(PUBLIC_DIR);

  if (fullPath !== publicRoot && !fullPath.startsWith(`${publicRoot}${sep}`)) {
    fail(`arUsdzUrl escapes public/: ${url}`);
    return null;
  }

  return fullPath;
}

function readActiveArUsdzUrls() {
  const source = readFileSync(DEMO_DATA, "utf8");
  const dishPattern = /\{\s*id:\s*"dish-[\s\S]*?\n  \}/g;
  const dishes = [];

  for (const match of source.matchAll(dishPattern)) {
    const block = match[0];
    const slug = block.match(/slug:\s*"([^"]+)"/)?.[1] ?? "(unknown-slug)";
    const name = block.match(/name:\s*"([^"]+)"/)?.[1] ?? slug;
    const arUsdzUrl = block.match(/arUsdzUrl:\s*"([^"]+)"/)?.[1] ?? "";

    if (!arUsdzUrl) continue;

    dishes.push({
      slug,
      name,
      arUsdzUrl,
      isProductionApproved: !NON_PRODUCTION_APPROVAL_MARKER.test(block)
    });
  }

  return dishes;
}

function readUsdzFile(filePath, label) {
  if (!filePath) return null;
  if (!existsSync(filePath)) {
    fail(`${label} missing: ${filePath}`);
    return null;
  }

  const stats = statSync(filePath);
  if (stats.size <= 0) {
    fail(`${label} is empty`);
    return null;
  }

  const bytes = readFileSync(filePath);
  if (isGitLfsPointer(bytes)) {
    fail(`${label} is a Git LFS pointer, not a hydrated USDZ`);
    return null;
  }

  ok(`${label} exists (${formatSize(stats.size)})`);
  return bytes;
}

function checkStableProductionUrl(dish, label) {
  if (/[?#]/.test(dish.arUsdzUrl)) {
    fail(`${label} must use a stable URL without query string or hash`);
  } else {
    ok(`${label} has a stable URL without query string/hash`);
  }

  if (!dish.arUsdzUrl.startsWith("/models/demo/ar-lite/")) {
    fail(`${label} must live under /models/demo/ar-lite/`);
  } else {
    ok(`${label} lives under /models/demo/ar-lite/`);
  }
}

function assertZipContainer(bytes, label) {
  const localHeader = bytes.subarray(0, 4).toString("latin1");
  if (localHeader !== "PK\u0003\u0004") {
    fail(`${label} is not a ZIP/USDZ archive`);
    return false;
  }

  const hasEndOfCentralDirectory = bytes.includes(Buffer.from("504b0506", "hex"));
  if (!hasEndOfCentralDirectory) {
    fail(`${label} ZIP end-of-central-directory marker is missing`);
    return false;
  }

  return true;
}

function unzipUsdz(bytes, label) {
  if (!assertZipContainer(bytes, label)) return null;

  try {
    return fflate.unzipSync(bytes);
  } catch (error) {
    fail(`${label} unreadable USDZ ZIP: ${error.message}`);
    return null;
  }
}

function textFrom(bytes) {
  return Buffer.from(bytes).toString("latin1");
}

function hasUsdSignature(name, bytes) {
  const header = Buffer.from(bytes).subarray(0, 8);
  const ascii = header.toString("utf8");

  if (/\.usda$/i.test(name)) return ascii.startsWith("#usda");
  if (/\.usd$/i.test(name)) return ascii.startsWith("#usda") || ascii.startsWith("PXR-USDC");
  if (/\.usdc$/i.test(name)) return ascii.startsWith("PXR-USDC");
  return false;
}

function hasPngSignature(bytes) {
  return Buffer.from(bytes).subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
}

function hasJpegSignature(bytes) {
  return Buffer.from(bytes).subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"));
}

function inspectUsdzResources(zip, label) {
  const names = Object.keys(zip);
  if (names.length === 0) {
    fail(`${label} ZIP has no resources`);
    return;
  }

  const unsafeNames = names.filter(
    (name) => name.startsWith("/") || name.includes("\\") || name.split("/").includes("..")
  );
  if (unsafeNames.length > 0) {
    fail(`${label} has unsafe ZIP resource paths: ${unsafeNames.join(", ")}`);
  }

  for (const [name, bytes] of Object.entries(zip)) {
    if (name.endsWith("/")) continue;
    if (bytes.length === 0) fail(`${label} resource is empty: ${name}`);
  }

  const usdNames = names.filter((name) => /\.(?:usd|usda|usdc)$/i.test(name));
  const imageNames = names.filter((name) => /\.(?:png|jpe?g)$/i.test(name));

  if (usdNames.length === 0) {
    fail(`${label} has no USD/USD[A|C] resources`);
  } else {
    ok(`${label} USD resources=${usdNames.length}`);
  }

  for (const name of usdNames) {
    const bytes = zip[name];
    if (!hasUsdSignature(name, bytes)) {
      fail(`${label} invalid USD resource signature: ${name}`);
    }
  }

  for (const name of imageNames) {
    const bytes = zip[name];
    if (/\.png$/i.test(name) && !hasPngSignature(bytes)) {
      fail(`${label} invalid PNG signature: ${name}`);
    }
    if (/\.jpe?g$/i.test(name) && !hasJpegSignature(bytes)) {
      fail(`${label} invalid JPEG signature: ${name}`);
    }
  }

  if (imageNames.length > 0) {
    ok(`${label} texture images=${imageNames.length}`);
  }

  const usdText = usdNames.map((name) => textFrom(zip[name])).join("\n");
  const hasGeometryIndicator =
    /\bdef\s+Mesh\b/.test(usdText) ||
    /\bMesh\b/.test(usdText) ||
    /\bpoint3f\[\]\s+points\b/.test(usdText) ||
    /\bpoints\b/.test(usdText) ||
    /\bfaceVertexIndices\b/.test(usdText) ||
    usdNames.some((name) => /^geometries\//i.test(name));
  const hasMaterialIndicator =
    /\bdef\s+Material\b/.test(usdText) ||
    /\bMaterial\b/.test(usdText) ||
    /\bmaterial:binding\b/.test(usdText) ||
    /\bUsdPreviewSurface\b/.test(usdText);
  const referencedTextures = [
    ...usdText.matchAll(/(?:@|")([^@"\s]+\.(?:png|jpe?g))(?:@|")/gi)
  ].map((match) => basename(match[1]));
  const imageBasenames = new Set(imageNames.map((name) => basename(name)));

  if (!hasGeometryIndicator) {
    fail(`${label} has no geometry indicators in USD resources`);
  } else {
    ok(`${label} geometry indicators present`);
  }

  if (!hasMaterialIndicator) {
    fail(`${label} has no material indicators in USD resources`);
  } else {
    ok(`${label} material indicators present`);
  }

  if (referencedTextures.length > 0) {
    const missingTextures = referencedTextures.filter((name) => !imageBasenames.has(name));
    if (missingTextures.length > 0) {
      fail(`${label} references missing texture resources: ${missingTextures.join(", ")}`);
    } else {
      ok(`${label} referenced texture resources are present`);
    }
  } else if (imageNames.length > 0) {
    ok(`${label} texture resources present`);
  } else {
    warn(`${label} has no texture indicators; accepted only for intentionally untextured USDZ`);
  }

  if (/\bundefined\b/i.test(usdText)) {
    fail(`${label} contains undefined USD tokens/references`);
  }
}

function checkProductionBudget(bytes, dish, label) {
  const size = bytes.length;
  if (dish.isProductionApproved) {
    if (size > MAX_PRODUCTION_IOS_USDZ_BYTES) {
      fail(
        `${label} exceeds production iOS Quick Look budget: ${formatSize(size)} > ${formatSize(
          MAX_PRODUCTION_IOS_USDZ_BYTES
        )}`
      );
    } else {
      ok(`${label} within production iOS Quick Look budget`);
    }
    return;
  }

  if (size > MAX_PRODUCTION_IOS_USDZ_BYTES) {
    warn(
      `${label} exceeds ${formatSize(
        MAX_PRODUCTION_IOS_USDZ_BYTES
      )}, but is explicitly marked not production-approved`
    );
  } else {
    ok(`${label} marked not production-approved and within budget`);
  }
}

const activeArUsdzUrls = readActiveArUsdzUrls();

if (activeArUsdzUrls.length === 0) {
  fail("No active arUsdzUrl values found in lib/demoMenuData.ts");
}

for (const dish of activeArUsdzUrls) {
  const filePath = assetPath(dish.arUsdzUrl);
  const label = `${dish.slug} active arUsdzUrl ${basename(dish.arUsdzUrl.split(/[?#]/)[0])}`;
  checkStableProductionUrl(dish, label);
  const bytes = readUsdzFile(filePath, label);
  if (!bytes) continue;

  const zip = unzipUsdz(bytes, label);
  if (zip) inspectUsdzResources(zip, label);
  checkProductionBudget(bytes, dish, label);
}

if (process.exitCode) {
  console.error("iOS Quick Look USDZ budget validation failed.");
  process.exit(process.exitCode);
}

console.log("iOS Quick Look USDZ budget validation completed.");
