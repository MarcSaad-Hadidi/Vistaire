import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as fflate from "fflate";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DEMO_DATA = join(ROOT, "lib", "demoMenuData.ts");
const NEXT_CONFIG = join(ROOT, "next.config.ts");
const PUBLIC_DIR = join(ROOT, "public");

const MIN_USDZ_BYTES = 10 * 1024;
const LARGE_USDZ_BYTES = 25 * 1024 * 1024;
const HUGE_USDZ_BYTES = 60 * 1024 * 1024;

function readText(path) {
  return readFileSync(path, "utf8");
}

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

function assetPath(url) {
  return join(PUBLIC_DIR, url.replace(/^\//, ""));
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function extractDishes() {
  const source = readText(DEMO_DATA);
  const blocks = source.match(/\{\s*id:\s*"dish-[\s\S]*?\n  \}/g) ?? [];
  return blocks
    .map((block) => ({
      slug: block.match(/slug:\s*"([^"]+)"/)?.[1] ?? "",
      name: block.match(/name:\s*"([^"]+)"/)?.[1] ?? "",
      model3dUrl: block.match(/model3dUrl:\s*"([^"]*)"/)?.[1] ?? "",
      usdzUrl: block.match(/usdzUrl:\s*"([^"]*)"/)?.[1] ?? ""
    }))
    .filter((dish) => dish.slug);
}

function checkSignature(filePath, expectedMagic, label) {
  const bytes = readFileSync(filePath);
  if (isGitLfsPointer(bytes)) {
    fail(`${label} est un pointeur Git LFS non hydraté`);
    return;
  }
  const magic = bytes.subarray(0, expectedMagic.length).toString("utf8");
  if (magic !== expectedMagic) {
    fail(`${label} signature invalide: attendu ${expectedMagic}, obtenu ${JSON.stringify(magic)}`);
    return;
  }
  ok(`${label} signature ${expectedMagic}`);
}

function isGitLfsPointer(bytes) {
  return bytes
    .subarray(0, 64)
    .toString("utf8")
    .startsWith("version https://git-lfs.github.com/spec/v1");
}

function inspectUsdz(filePath, label) {
  const raw = readFileSync(filePath);
  if (isGitLfsPointer(raw)) {
    fail(`${label} est un pointeur Git LFS non hydraté`);
    return;
  }

  let zip;
  try {
    zip = fflate.unzipSync(raw);
  } catch (error) {
    fail(`${label} ZIP illisible: ${error.message}`);
    return;
  }

  const names = Object.keys(zip);
  const usdNames = names.filter((name) => /\.usd[ac]?$/i.test(name));
  if (usdNames.length === 0) {
    fail(`${label} ne contient aucun fichier USDA/USDC`);
    return;
  }

  const usdText = usdNames
    .map((name) => Buffer.from(zip[name]).toString("utf8"))
    .join("\n");
  const hasGeometry =
    /\bdef\s+Mesh\b/.test(usdText) ||
    /\bpoint3f\[\]\s+points\b/.test(usdText) ||
    /\bint\[\]\s+faceVertexIndices\b/.test(usdText);
  const materialCount = (usdText.match(/\bdef\s+Material\b/g) ?? []).length;

  if (!hasGeometry || /\bundefined\b/.test(usdText)) {
    fail(`${label} ne contient pas de géométrie USD valide`);
  } else {
    ok(`${label} contient de la géométrie USD`);
  }

  if (materialCount === 0) {
    fail(`${label} ne contient aucun matériau USD`);
  } else {
    ok(`${label} matériaux USD: ${materialCount}`);
  }
}

const dishes = extractDishes();
const dishesWithGlb = dishes.filter((dish) => dish.model3dUrl);
const dishesWithUsdz = dishes.filter((dish) => dish.usdzUrl);
const nextConfig = readText(NEXT_CONFIG);
const homard = dishes.find((dish) => dish.slug === "homard-bisque");

if (!homard) {
  fail("plat homard-bisque introuvable dans demoMenuData.ts");
} else {
  if (homard.model3dUrl !== "/models/demo/homard-bisque.glb") {
    fail(`homard model3dUrl inattendu: ${homard.model3dUrl}`);
  } else {
    ok("homard pointe vers /models/demo/homard-bisque.glb");
  }

  if (homard.usdzUrl !== "/models/demo/homard-bisque.usdz") {
    fail(`homard usdzUrl inattendu: ${homard.usdzUrl}`);
  } else {
    ok("homard pointe vers /models/demo/homard-bisque.usdz");
  }

  if (homard.usdzUrl.includes("homard-bisque-ar-lite.usdz")) {
    fail("homard pointe vers homard-bisque-ar-lite.usdz");
  } else {
    ok("homard-bisque-ar-lite.usdz non utilisé par le plat homard");
  }
}

for (const dish of dishesWithGlb) {
  const filePath = assetPath(dish.model3dUrl);
  const label = `${dish.slug} GLB ${basename(filePath)}`;
  if (!existsSync(filePath)) {
    fail(`${label} manquant`);
    continue;
  }
  const size = statSync(filePath).size;
  if (size <= 0) fail(`${label} vide`);
  ok(`${label} existe (${formatSize(size)})`);
  checkSignature(filePath, "glTF", label);
}

for (const dish of dishesWithUsdz) {
  const filePath = assetPath(dish.usdzUrl);
  const label = `${dish.slug} USDZ ${basename(filePath)}`;
  if (!existsSync(filePath)) {
    fail(`${label} manquant`);
    continue;
  }
  const size = statSync(filePath).size;
  if (size <= 0) fail(`${label} vide`);
  if (size < MIN_USDZ_BYTES) warn(`${label} très petit (${formatSize(size)})`);
  if (size > LARGE_USDZ_BYTES) warn(`${label} volumineux pour mobile (${formatSize(size)})`);
  if (size > HUGE_USDZ_BYTES) warn(`${label} très gros pour Quick Look (${formatSize(size)})`);
  ok(`${label} existe (${formatSize(size)})`);
  checkSignature(filePath, "PK", label);
  inspectUsdz(filePath, label);

  const fileName = basename(filePath);
  if (!nextConfig.includes(fileName)) {
    fail(`${fileName} absent des headers next.config.ts`);
  } else {
    ok(`${fileName} déclaré dans next.config.ts`);
  }
}

if (!nextConfig.includes("model/vnd.usdz+zip")) {
  fail("Content-Type USDZ manquant dans next.config.ts");
} else {
  ok("Content-Type USDZ model/vnd.usdz+zip configuré");
}

if (!nextConfig.includes("Content-Disposition") || !nextConfig.includes("inline")) {
  fail("Content-Disposition inline USDZ manquant dans next.config.ts");
} else {
  ok("Content-Disposition inline configuré");
}

if (process.exitCode) {
  console.error("Validation demo assets échouée.");
  process.exit(process.exitCode);
}

console.log("Validation demo assets terminée.");
