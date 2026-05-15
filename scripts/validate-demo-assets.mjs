import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as fflate from "fflate";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DEMO_DATA = join(ROOT, "lib", "demoMenuData.ts");
const NEXT_CONFIG = join(ROOT, "next.config.ts");
const PUBLIC_DIR = join(ROOT, "public");
const USDZ_SCENE_INSPECTOR = join(__dirname, "inspect-usdz-scene.py");
const PYTHON_BIN = findOpenUsdPython();

const MIN_USDZ_BYTES = 10 * 1024;
const MAX_PRODUCTION_IOS_USDZ_BYTES = 5 * 1024 * 1024;
const LARGE_USDZ_BYTES = 25 * 1024 * 1024;
const HUGE_USDZ_BYTES = 60 * 1024 * 1024;
const SOUFFLE_WITH_PLATE_GLB_SHA256 =
  "6aaab33a629b79ecf7f01bcedc03534528cc49ebb50064772e57cec9ecb1fc79";
const SOUFFLE_WITH_PLATE_MIN_USDZ_BYTES = 5 * 1024 * 1024;
const WEB_GLB_EXPECTATIONS = new Map([
  [
    "ravioles-romarin",
    {
      url: "/models/demo/ravioles-chevre-miel-meshopt-6b812a04.glb",
      sha256: "6b812a046c383581aaf642e74e2e2f5d2eac4594b23ec8c4148a64fec0f62fd6"
    }
  ],
  [
    "homard-bisque",
    {
      url: "/models/demo/homard-bisque-meshopt-73be7175.glb",
      sha256: "73be717526e94964c581de1e2bcf983e826a2ea16ee71044e10651b8eb6b69c3"
    }
  ],
  [
    "souffle-chocolat",
    {
      url: "/models/demo/souffle-chocolat-meshopt-76eb0faa.glb",
      sha256: "76eb0faa401dc853d0c8c27835a9083dbc006377f07c65f1284281144f943608"
    }
  ]
]);
const CORE_ASSET_EXPECTATIONS = new Map([
  [
    "ravioles-romarin",
    {
      model3dUrl: "/models/demo/ravioles-chevre-miel.glb",
      modelSha256: "c665ca403a9543296383a8234310b01c58e5bfce47efa9fa1bae39caa28847b0",
      usdzUrl: "/models/demo/ravioles-chevre-miel.usdz",
      usdzSha256: "b22994f9ce416d9342bcbea0d9d0ba71a4005c258ecd33cca7210a844ec11d53"
    }
  ],
  [
    "homard-bisque",
    {
      model3dUrl: "/models/demo/homard-bisque.glb",
      modelSha256: "ff7a4377c0cdfb3deba984f4514942e8e392ba2a3e9ab83d93e62071777c0f14",
      usdzUrl: "/models/demo/homard-bisque.usdz",
      usdzSha256: "099ba9e974b7a63519f52b017198385a748e18845c59312e7490c28d4f88b18b"
    }
  ],
  [
    "souffle-chocolat",
    {
      model3dUrl: "/models/demo/souffle-chocolat.glb",
      modelSha256: SOUFFLE_WITH_PLATE_GLB_SHA256,
      usdzUrl: "/models/demo/souffle-chocolat.usdz?v=plate-source-20260511",
      usdzSha256: "8fbdd7dc6d60e2c75da334c665ae30953328df426c64fedc6a5be68895e5284f"
    }
  ],
  [
    "cocktail-maison-elyse",
    {
      model3dUrl: "/models/demo/maison-elyse-n1.glb",
      modelSha256: "7f12cd7bc6f47ec97f6cef3b65c453bbef537aa7c095289899c51782e48eebef",
      usdzUrl: "/models/demo/maison-elyse-n1.usdz",
      usdzSha256: "0c3f6233e237cc27c26d0784927059ef0ea7ba15e83b92e9a472a3dd2961213a"
    }
  ]
]);
const ACTIVE_PUBLIC_USDZ_FILES = new Set([
  "homard-bisque-ios-quicklook-ultra.usdz",
  "homard-bisque.usdz",
  "maison-elyse-n1.usdz",
  "ravioles-chevre-miel.usdz",
  "souffle-chocolat-ios-quicklook-ultra.usdz",
  "souffle-chocolat.usdz"
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
const MESHOPT_DECODER_EXPECTATION = {
  url: "/model-viewer/meshopt-decoder-74188840.js",
  sha256: "74188840936594a7161be0bb8822927279ec72ed9e4585e482f2c47c40d1aa80"
};
const sceneInspectionCache = new Map();

function canImportOpenUsd(command) {
  const result = spawnSync(command, ["-c", "from pxr import Usd, UsdGeom, UsdShade"], {
    encoding: "utf8",
    stdio: "ignore"
  });
  return result.status === 0;
}

function findOpenUsdPython() {
  const candidates = [
    process.env.USDZ_VALIDATION_PYTHON,
    "E:\\5.1\\python\\bin\\python.exe",
    "python"
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.includes("\\") && !existsSync(candidate)) continue;
    if (canImportOpenUsd(candidate)) return candidate;
  }

  return process.env.USDZ_VALIDATION_PYTHON ?? "python";
}

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
  const path = url.split(/[?#]/)[0];
  return join(PUBLIC_DIR, path.replace(/^\//, ""));
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function checkFileHash(filePath, expectedHash, label) {
  if (!existsSync(filePath)) {
    fail(`${label} fichier public introuvable: ${filePath}`);
    return;
  }

  const actualHash = sha256File(filePath);
  if (actualHash !== expectedHash) {
    fail(
      `${label} hash inattendu: public ${actualHash.slice(
        0,
        12
      )}, attendu ${expectedHash.slice(0, 12)}`
    );
    return;
  }

  ok(`${label} hash attendu`);
}

function checkExpectedWebGlb(dish, label) {
  const expected = WEB_GLB_EXPECTATIONS.get(dish.slug);
  if (!expected) return;

  if (dish.webModel3dUrl !== expected.url) {
    fail(`${label} webModel3dUrl inattendu: ${dish.webModel3dUrl || "(absent)"}`);
    return;
  }

  ok(`${label} pointe vers ${expected.url}`);
  checkFileHash(assetPath(expected.url), expected.sha256, `${label} webModel3dUrl Meshopt`);
}

function checkApprovedArUsdz(dish, label) {
  const expected = APPROVED_IOS_QUICK_LOOK_USDZ.get(dish.slug);
  if (!expected) {
    if (dish.arUsdzUrl) {
      fail(`${label} declare un arUsdzUrl non approuve: ${dish.arUsdzUrl}`);
    } else {
      ok(`${label} ne declare pas d'arUsdzUrl iPhone production actif`);
    }
    return;
  }

  if (dish.arUsdzUrl !== expected.url) {
    fail(`${label} arUsdzUrl inattendu: ${dish.arUsdzUrl || "(absent)"}`);
    return;
  }

  ok(`${label} arUsdzUrl pointe vers ${expected.url}`);
  if (/[?#]/.test(dish.arUsdzUrl)) {
    fail(`${label} arUsdzUrl contient une query string ou un hash`);
  } else {
    ok(`${label} arUsdzUrl stable sans query string/hash`);
  }
  if (!dish.arUsdzUrl.startsWith("/models/demo/ar-lite/") || !dish.arUsdzUrl.endsWith(".usdz")) {
    fail(`${label} arUsdzUrl doit pointer vers /models/demo/ar-lite/*.usdz`);
  } else {
    ok(`${label} arUsdzUrl dans /models/demo/ar-lite/*.usdz`);
  }

  const arUsdzPath = assetPath(dish.arUsdzUrl);
  if (!existsSync(arUsdzPath)) {
    fail(`${label} arUsdzUrl fichier introuvable: ${arUsdzPath}`);
    return;
  }

  const size = statSync(arUsdzPath).size;
  if (size > MAX_PRODUCTION_IOS_USDZ_BYTES) {
    fail(`${label} arUsdzUrl depasse 5 MiB: ${formatSize(size)}`);
  } else {
    ok(`${label} arUsdzUrl respecte le budget iPhone <= 5 MiB`);
  }
  checkFileHash(arUsdzPath, expected.sha256, `${label} arUsdzUrl approuve`);
  inspectUsdz(arUsdzPath, `${label} arUsdzUrl USDZ production`);
  checkUsdzCenteredAndGrounded(arUsdzPath, `${label} arUsdzUrl stabilite AR`);
}

function checkExpectedCoreAssets(dishes) {
  for (const [slug, expected] of CORE_ASSET_EXPECTATIONS) {
    const dish = dishes.find((item) => item.slug === slug);
    if (!dish) {
      fail(`plat attendu absent: ${slug}`);
      continue;
    }

    if (dish.model3dUrl !== expected.model3dUrl) {
      fail(`${slug} model3dUrl original modifie: ${dish.model3dUrl || "(absent)"}`);
    } else {
      ok(`${slug} model3dUrl original conserve`);
      checkFileHash(assetPath(expected.model3dUrl), expected.modelSha256, `${slug} GLB original`);
    }

    if (dish.usdzUrl !== expected.usdzUrl) {
      fail(`${slug} usdzUrl actif modifie: ${dish.usdzUrl || "(absent)"}`);
    } else {
      ok(`${slug} usdzUrl actif conserve`);
      checkFileHash(assetPath(expected.usdzUrl), expected.usdzSha256, `${slug} USDZ actif`);
    }

    if (!WEB_GLB_EXPECTATIONS.has(slug) && dish.webModel3dUrl) {
      fail(`${slug} declare un webModel3dUrl inattendu: ${dish.webModel3dUrl}`);
    }
  }
}

function checkMinimumSize(filePath, minBytes, label) {
  if (!existsSync(filePath)) {
    fail(`${label} fichier introuvable: ${filePath}`);
    return;
  }
  const size = statSync(filePath).size;
  if (size < minBytes) {
    fail(
      `${label} trop petit: ${formatSize(size)} (attendu au moins ${formatSize(minBytes)})`
    );
    return;
  }
  ok(`${label} taille compatible (${formatSize(size)})`);
}

function checkUsdzGeometryCountAtLeast(filePath, minCount, label) {
  if (!existsSync(filePath)) {
    fail(`${label} fichier introuvable: ${filePath}`);
    return;
  }

  let zip;
  try {
    zip = fflate.unzipSync(readFileSync(filePath));
  } catch (error) {
    fail(`${label} ZIP illisible: ${error.message}`);
    return;
  }

  const geometryCount = Object.keys(zip).filter((name) =>
    /geometries\/.*\.usd[ac]$/i.test(name)
  ).length;

  if (geometryCount < minCount) {
    fail(`${label} geometries USD: ${geometryCount}, attendu au moins ${minCount}`);
    return;
  }

  ok(`${label} geometries USD: ${geometryCount}`);
}

function countUsdzGeometryLayers(filePath, label) {
  try {
    const zip = fflate.unzipSync(readFileSync(filePath));
    return Object.keys(zip).filter((name) => /geometries\/.*\.usd[ac]$/i.test(name)).length;
  } catch (error) {
    fail(`${label} ZIP illisible: ${error.message}`);
    return 0;
  }
}

function inspectUsdzScene(filePath, label) {
  if (sceneInspectionCache.has(filePath)) return sceneInspectionCache.get(filePath);

  const result = spawnSync(PYTHON_BIN, [USDZ_SCENE_INSPECTOR, filePath], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });

  if (result.status !== 0) {
    fail(
      `${label} inspection OpenUSD impossible. Installez usd-core ou configurez USDZ_VALIDATION_PYTHON. ${
        result.stderr || result.error?.message || "Erreur inconnue"
      }`.trim()
    );
    sceneInspectionCache.set(filePath, null);
    return null;
  }

  try {
    const stats = JSON.parse(result.stdout);
    sceneInspectionCache.set(filePath, stats);
    return stats;
  } catch (error) {
    fail(`${label} inspection OpenUSD JSON illisible: ${error.message}`);
    sceneInspectionCache.set(filePath, null);
    return null;
  }
}

function parseUsdPoints(text) {
  const pointsBlock = text.match(/point3f\[\]\s+points\s*=\s*\[([\s\S]*?)\]/);
  if (!pointsBlock) return [];

  return [
    ...pointsBlock[1].matchAll(
      /\((-?\d+(?:\.\d+)?(?:e[-+]?\d+)?),\s*(-?\d+(?:\.\d+)?(?:e[-+]?\d+)?),\s*(-?\d+(?:\.\d+)?(?:e[-+]?\d+)?)\)/gi
    )
  ].map((match) => [Number(match[1]), Number(match[2]), Number(match[3])]);
}

function getUsdzGeometrySummaries(filePath, label) {
  let zip;
  try {
    zip = fflate.unzipSync(readFileSync(filePath));
  } catch (error) {
    fail(`${label} ZIP illisible: ${error.message}`);
    return [];
  }

  return Object.entries(zip)
    .filter(([name]) => /geometries\/.*\.usda$/i.test(name))
    .map(([name, bytes]) => ({
      name,
      points: parseUsdPoints(Buffer.from(bytes).toString("utf8"))
    }))
    .filter((entry) => entry.points.length > 0)
    .map((entry) => {
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (const point of entry.points) {
        for (let axis = 0; axis < 3; axis += 1) {
          min[axis] = Math.min(min[axis], point[axis]);
          max[axis] = Math.max(max[axis], point[axis]);
        }
      }
      return {
        ...entry,
        min,
        max,
        size: max.map((value, axis) => value - min[axis])
      };
    });
}

function checkUsdzUsesSourcePlateGeometry(filePath, label) {
  const summaries = getUsdzGeometrySummaries(filePath, label);
  if (summaries.length === 0 && countUsdzGeometryLayers(filePath, label) > 0) {
    const scene = inspectUsdzScene(filePath, label);
    if (!scene) return;
    if (scene.sourcePlateMeshCount < 2) {
      fail(`${label} assiette source absente (${scene.sourcePlateMeshCount}/2)`);
      return;
    }
    ok(`${label} assiette source conservee (${scene.sourcePlateMeshCount} pieces)`);
    return;
  }

  const sourcePlateParts = summaries.filter(
    (entry) =>
      entry.points.length > 1000 &&
      entry.points.length < 10_000 &&
      entry.size[0] > 0.12 &&
      entry.size[2] > 0.12
  );

  if (sourcePlateParts.length < 2) {
    fail(`${label} assiette source absente (${sourcePlateParts.length}/2)`);
    return;
  }

  ok(`${label} assiette source conservee (${sourcePlateParts.length} pieces)`);
}

function checkUsdzCenteredAndGrounded(filePath, label) {
  const summaries = getUsdzGeometrySummaries(filePath, label);
  if (summaries.length === 0) {
    if (countUsdzGeometryLayers(filePath, label) > 0) {
      const scene = inspectUsdzScene(filePath, label);
      if (!scene) return;
      const min = scene.bounds.min;
      const max = scene.bounds.max;
      const centerX = (min[0] + max[0]) / 2;
      const centerZ = (min[2] + max[2]) / 2;
      if (Math.abs(min[1]) > 0.0005) {
        fail(`${label} base AR pas au sol: minY=${min[1].toFixed(5)}m`);
        return;
      }
      if (Math.abs(centerX) > 0.006 || Math.abs(centerZ) > 0.006) {
        fail(
          `${label} pivot AR decentre: centerX=${centerX.toFixed(5)}m centerZ=${centerZ.toFixed(
            5
          )}m`
        );
        return;
      }
      ok(`${label} pivot centre et base au sol`);
    }
    return;
  }

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const entry of summaries) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], entry.min[axis]);
      max[axis] = Math.max(max[axis], entry.max[axis]);
    }
  }

  const centerX = (min[0] + max[0]) / 2;
  const centerZ = (min[2] + max[2]) / 2;
  if (Math.abs(min[1]) > 0.0005) {
    fail(`${label} base AR pas au sol: minY=${min[1].toFixed(5)}m`);
    return;
  }
  if (Math.abs(centerX) > 0.006 || Math.abs(centerZ) > 0.006) {
    fail(
      `${label} pivot AR decentre: centerX=${centerX.toFixed(5)}m centerZ=${centerZ.toFixed(5)}m`
    );
    return;
  }

  ok(`${label} pivot centre et base au sol`);
}

function extractDishes() {
  const source = readText(DEMO_DATA);
  const blocks = source.match(/\{\s*id:\s*"dish-[\s\S]*?\n  \}/g) ?? [];
  return blocks
    .map((block) => ({
      slug: block.match(/slug:\s*"([^"]+)"/)?.[1] ?? "",
      name: block.match(/name:\s*"([^"]+)"/)?.[1] ?? "",
      model3dUrl: block.match(/model3dUrl:\s*"([^"]*)"/)?.[1] ?? "",
      webModel3dUrl: block.match(/webModel3dUrl:\s*"([^"]*)"/)?.[1] ?? "",
      arModel3dUrl: block.match(/arModel3dUrl:\s*"([^"]*)"/)?.[1] ?? "",
      usdzUrl: block.match(/usdzUrl:\s*"([^"]*)"/)?.[1] ?? "",
      arUsdzUrl: block.match(/arUsdzUrl:\s*"([^"]*)"/)?.[1] ?? ""
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

  const textUsdNames = usdNames.filter((name) =>
    Buffer.from(zip[name]).subarray(0, 8).toString("utf8").startsWith("#usda")
  );
  if (textUsdNames.length === 0) {
    const scene = inspectUsdzScene(filePath, label);
    if (!scene) return;
    if (scene.meshCount === 0) {
      fail(`${label} ne contient pas de geometrie USD binaire`);
      return;
    }
    ok(`${label} contient de la geometrie USD binaire (${scene.meshCount} meshes)`);

    if (scene.materialCount === 0 || scene.shaderCount === 0) {
      fail(
        `${label} materiaux/shaders USD binaires absents: ${scene.materialCount} materiaux, ${scene.shaderCount} shaders`
      );
      return;
    }
    if (scene.meshMaterialBindingCount < scene.meshCount) {
      fail(
        `${label} material bindings incomplets: ${scene.meshMaterialBindingCount}/${scene.meshCount} meshes`
      );
      return;
    }
    if (scene.textureCount === 0) {
      fail(`${label} ne contient aucune texture USD resolue`);
      return;
    }
    if (scene.unresolvedTextures.length > 0) {
      fail(`${label} textures USD non resolues: ${scene.unresolvedTextures.join(", ")}`);
      return;
    }
    ok(
      `${label} materiaux USD binaires: ${scene.materialCount}, shaders: ${scene.shaderCount}, textures resolues: ${scene.textureCount}`
    );
    return;
  }

  const usdText = textUsdNames
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
const dishesWithWebGlb = dishes.filter((dish) => dish.webModel3dUrl);
const dishesWithUsdz = dishes.filter((dish) => dish.usdzUrl);
const nextConfig = readText(NEXT_CONFIG);
const homard = dishes.find((dish) => dish.slug === "homard-bisque");
const ravioles = dishes.find((dish) => dish.slug === "ravioles-romarin");
const souffle = dishes.find((dish) => dish.slug === "souffle-chocolat");

checkExpectedCoreAssets(dishes);

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
    fail("homard usdzUrl source pointe vers homard-bisque-ar-lite.usdz");
  } else {
    ok("homard usdzUrl source conserve l'USDZ original");
  }

  if (homard.arModel3dUrl !== "/models/demo/ar-lite/homard-bisque-ar-lite.glb") {
    fail(`homard arModel3dUrl inattendu: ${homard.arModel3dUrl || "(absent)"}`);
  } else {
    ok("homard arModel3dUrl pointe vers /models/demo/ar-lite/homard-bisque-ar-lite.glb");
  }

  if (homard.arUsdzUrl !== "/models/demo/ar-lite/homard-bisque-ios-quicklook-ultra.usdz") {
    fail(`homard arUsdzUrl inattendu: ${homard.arUsdzUrl || "(absent)"}`);
  } else {
    ok("homard arUsdzUrl pointe vers /models/demo/ar-lite/homard-bisque-ios-quicklook-ultra.usdz");
    const arUsdzPath = assetPath(homard.arUsdzUrl);
    if (statSync(arUsdzPath).size > MAX_PRODUCTION_IOS_USDZ_BYTES) {
      fail(`homard arUsdzUrl dÃ©passe 5 MiB: ${formatSize(statSync(arUsdzPath).size)}`);
    } else {
      ok("homard arUsdzUrl respecte le budget iPhone <= 5 MiB");
    }
    checkUsdzCenteredAndGrounded(arUsdzPath, "homard arUsdzUrl stabilite AR");
  }

  checkExpectedWebGlb(homard, "homard");
}

if (!ravioles) {
  fail("plat ravioles-romarin introuvable dans demoMenuData.ts");
} else {
  if (ravioles.model3dUrl !== "/models/demo/ravioles-chevre-miel.glb") {
    fail(`ravioles model3dUrl inattendu: ${ravioles.model3dUrl}`);
  } else {
    ok("ravioles pointe vers /models/demo/ravioles-chevre-miel.glb");
  }

  if (ravioles.usdzUrl !== "/models/demo/ravioles-chevre-miel.usdz") {
    fail(`ravioles usdzUrl inattendu: ${ravioles.usdzUrl}`);
  } else {
    ok("ravioles pointe vers /models/demo/ravioles-chevre-miel.usdz");
  }

  if (/lite/i.test(`${ravioles.model3dUrl} ${ravioles.usdzUrl}`)) {
    fail("ravioles pointe vers une version lite");
  } else {
    ok("ravioles ne pointe pas vers une version lite");
  }

  checkExpectedWebGlb(ravioles, "ravioles");
  checkApprovedArUsdz(ravioles, "ravioles");
}

if (!souffle) {
  fail("plat souffle-chocolat introuvable dans demoMenuData.ts");
} else {
  if (souffle.model3dUrl !== "/models/demo/souffle-chocolat.glb") {
    fail(`souffle model3dUrl inattendu: ${souffle.model3dUrl}`);
  } else {
    ok("souffle pointe vers /models/demo/souffle-chocolat.glb");
  }

  if (souffle.usdzUrl !== "/models/demo/souffle-chocolat.usdz?v=plate-source-20260511") {
    fail(`souffle usdzUrl inattendu: ${souffle.usdzUrl}`);
  } else {
    ok("souffle pointe vers /models/demo/souffle-chocolat.usdz avec cache-bust");
  }

  checkFileHash(
    assetPath(souffle.model3dUrl),
    SOUFFLE_WITH_PLATE_GLB_SHA256,
    "souffle GLB avec assiette"
  );
  checkMinimumSize(
    assetPath(souffle.usdzUrl),
    SOUFFLE_WITH_PLATE_MIN_USDZ_BYTES,
    "souffle USDZ avec assiette"
  );
  checkUsdzGeometryCountAtLeast(
    assetPath(souffle.usdzUrl),
    3,
    "souffle USDZ surface blanche AR"
  );
  checkUsdzUsesSourcePlateGeometry(
    assetPath(souffle.usdzUrl),
    "souffle USDZ surface blanche AR"
  );
  checkUsdzCenteredAndGrounded(
    assetPath(souffle.usdzUrl),
    "souffle USDZ stabilite AR"
  );

  checkExpectedWebGlb(souffle, "souffle");
  checkApprovedArUsdz(souffle, "souffle");
}

const hasGenericUsdzHeaderRule =
  nextConfig.includes('source: "/models/demo/:path*.usdz"') ||
  nextConfig.includes("source: '/models/demo/:path*.usdz'");

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

for (const dish of dishesWithWebGlb) {
  const filePath = assetPath(dish.webModel3dUrl);
  const label = `${dish.slug} web GLB ${basename(filePath)}`;
  if (!existsSync(filePath)) {
    fail(`${label} manquant`);
    continue;
  }
  const size = statSync(filePath).size;
  if (size <= 0) fail(`${label} vide`);
  ok(`${label} existe (${formatSize(size)})`);
  checkSignature(filePath, "glTF", label);
}

checkFileHash(
  assetPath(MESHOPT_DECODER_EXPECTATION.url),
  MESHOPT_DECODER_EXPECTATION.sha256,
  "model-viewer Meshopt decoder"
);

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
  if (!hasGenericUsdzHeaderRule && !nextConfig.includes(fileName)) {
    fail(`${fileName} non couvert par les headers next.config.ts`);
  } else {
    ok(`${fileName} déclaré dans next.config.ts`);
  }
}

function walkFiles(dir) {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  });
}

for (const filePath of walkFiles(PUBLIC_DIR).filter((path) => path.endsWith(".usdz"))) {
  const fileName = basename(filePath);
  if (!ACTIVE_PUBLIC_USDZ_FILES.has(fileName)) {
    fail(`USDZ non actif dans public: ${filePath}`);
  }
}

if (!hasGenericUsdzHeaderRule) {
  fail("rÃ¨gle gÃ©nÃ©rique /models/demo/:path*.usdz absente de next.config.ts");
} else {
  ok("rÃ¨gle gÃ©nÃ©rique /models/demo/:path*.usdz configurÃ©e");
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
