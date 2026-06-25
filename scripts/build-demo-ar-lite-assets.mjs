import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { NullEngine, Scene, TransformNode, Vector3 } from "@babylonjs/core";
import { AppendSceneAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import "@babylonjs/loaders/glTF/index.js";
import { GLTF2Export } from "@babylonjs/serializers/glTF/2.0/glTFSerializer.js";
import { resolveGltfTransformCliPath } from "./shared/gltf-transform-cli.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function resolveWorkspaceRoot(value, fallback) {
  const root = value?.trim();
  if (!root) return fallback;
  return isAbsolute(root) ? root : join(ROOT, root);
}

const ASSET_ROOT = resolveWorkspaceRoot(
  process.env.VISTAIRE_MESHY_ASSET_ROOT,
  join(ROOT, "public", "models", "demo")
);
const DEMO_DIR = ASSET_ROOT;
const AR_LITE_DIR = join(DEMO_DIR, "ar-lite");
const WORK_DIR = join(AR_LITE_DIR, ".tmp-build");
const ONLY_PROFILE = process.env.VISTAIRE_MESHY_ONLY?.trim() || "";

const GLB_IDEAL_BYTES = 8 * 1024 * 1024;
const GLB_GOOD_BYTES = 12 * 1024 * 1024;
const GLB_MAX_BYTES = 15 * 1024 * 1024;

const PROFILES = [
  {
    slug: "homard-bisque",
    source: "homard-bisque-meshy.glb",
    output: "homard-bisque-ar-lite-meshy.glb",
    simplifyRatio: 0.52,
    simplifyError: 0.0012,
    jpegQuality: 80,
    balancedSimplifyRatio: 0.38,
    balancedSimplifyError: 0.0009,
    finalJpegQuality: 76,
    targetMaxDimMeters: 0.21,
    note:
      "Core Scene Viewer-compatible GLB: no Meshopt, no quantization, 2048 JPEG textures, balanced final geometry pass."
  },
  {
    slug: "ravioles-romarin",
    source: "ravioles-chevre-miel-meshy.glb",
    output: "ravioles-chevre-miel-ar-lite-meshy.glb",
    simplifyRatio: 0.55,
    simplifyError: 0.001,
    jpegQuality: 82,
    balancedSimplifyRatio: 0.42,
    balancedSimplifyError: 0.0008,
    finalJpegQuality: 78,
    targetMaxDimMeters: 0.2,
    note: "Ravioles AR-lite from Meshy compressed source."
  },
  {
    slug: "canette-aux-figues",
    source: "canette-aux-figues-meshy.glb",
    output: "canette-aux-figues-ar-lite-meshy.glb",
    simplifyRatio: 0.56,
    simplifyError: 0.001,
    jpegQuality: 82,
    balancedSimplifyRatio: 0.44,
    balancedSimplifyError: 0.0008,
    finalJpegQuality: 78,
    targetMaxDimMeters: 0.22,
    note: "Canette AR-lite from Meshy compressed source."
  },
  {
    slug: "bar-ligne",
    source: "bar-de-ligne-meshy.glb",
    output: "bar-de-ligne-ar-lite-meshy.glb",
    simplifyRatio: 0.56,
    simplifyError: 0.001,
    jpegQuality: 82,
    balancedSimplifyRatio: 0.44,
    balancedSimplifyError: 0.0008,
    finalJpegQuality: 78,
    targetMaxDimMeters: 0.2,
    note: "Bar de ligne AR-lite from Meshy compressed source."
  },
  {
    slug: "pave-boeuf",
    source: "pave-boeuf-meshy.glb",
    output: "pave-boeuf-ar-lite-meshy.glb",
    simplifyRatio: 0.56,
    simplifyError: 0.001,
    jpegQuality: 82,
    balancedSimplifyRatio: 0.44,
    balancedSimplifyError: 0.0008,
    finalJpegQuality: 78,
    targetMaxDimMeters: 0.2,
    note: "Pave boeuf AR-lite from Meshy compressed source."
  },
  {
    slug: "souffle-chocolat",
    source: "souffle-chocolat-meshy.glb",
    output: "souffle-chocolat-ar-lite-meshy.glb",
    simplifyRatio: 0.58,
    simplifyError: 0.0009,
    jpegQuality: 82,
    balancedSimplifyRatio: 0.45,
    balancedSimplifyError: 0.0007,
    finalJpegQuality: 78,
    targetMaxDimMeters: 0.18,
    note:
      "Souffle AR-lite source for iOS Quick Look; tuned to stay closer to the Meshopt web preview."
  },
  {
    slug: "tartare-saumon",
    source: "tartare-saumon-meshy.glb",
    output: "tartare-saumon-ar-lite-meshy.glb",
    simplifyRatio: 0.56,
    simplifyError: 0.001,
    jpegQuality: 82,
    balancedSimplifyRatio: 0.44,
    balancedSimplifyError: 0.0008,
    finalJpegQuality: 78,
    targetMaxDimMeters: 0.19,
    note: "Tartare AR-lite from Meshy compressed source."
  },
  {
    slug: "tarte-citron-basilic",
    source: "tarte-citron-basilic-meshy.glb",
    output: "tarte-citron-basilic-ar-lite-meshy.glb",
    simplifyRatio: 0.58,
    simplifyError: 0.0009,
    jpegQuality: 82,
    balancedSimplifyRatio: 0.45,
    balancedSimplifyError: 0.0007,
    finalJpegQuality: 78,
    targetMaxDimMeters: 0.18,
    note: "Tarte citron AR-lite from Meshy compressed source."
  },
  {
    slug: "dejeuner-classique-maison",
    source: "dejeuner-classique-maison-meshy.glb",
    output: "dejeuner-classique-maison-ar-lite-meshy.glb",
    simplifyRatio: 0.58,
    simplifyError: 0.0009,
    jpegQuality: 82,
    balancedSimplifyRatio: 0.45,
    balancedSimplifyError: 0.0007,
    finalJpegQuality: 78,
    targetMaxDimMeters: 0.2,
    note: "Dejeuner classique AR-lite from Meshy compressed source (Trouvable)."
  }
];

function createOwnerProfile(slug) {
  return {
    slug,
    source: `${slug}-meshy.glb`,
    output: `${slug}-ar-lite-meshy.glb`,
    simplifyRatio: 0.58,
    simplifyError: 0.0009,
    jpegQuality: 82,
    balancedSimplifyRatio: 0.45,
    balancedSimplifyError: 0.0007,
    finalJpegQuality: 78,
    targetMaxDimMeters: 0.2,
    note: "Owner AR-lite profile from uploaded Meshy-compatible GLB."
  };
}

function selectProfiles() {
  if (!ONLY_PROFILE) return PROFILES;
  const profile = PROFILES.find((item) => item.slug === ONLY_PROFILE);
  return [profile ?? createOwnerProfile(ONLY_PROFILE)];
}

function gltfTransformBin() {
  return resolveGltfTransformCliPath();
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`);
  }
}

function formatSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function classifyGlb(bytes) {
  if (bytes <= GLB_IDEAL_BYTES) return "ideal";
  if (bytes <= GLB_GOOD_BYTES) return "good";
  if (bytes <= GLB_MAX_BYTES) return "maximum-premium";
  return "over-budget";
}

function checkBudget(filePath, label) {
  const bytes = statSync(filePath).size;
  const bucket = classifyGlb(bytes);
  const message = `${label}: ${formatSize(bytes)} (${bucket})`;
  if (bytes > GLB_MAX_BYTES) {
    throw new Error(`${message}; exceeds ${formatSize(GLB_MAX_BYTES)}`);
  }
  if (bytes > GLB_GOOD_BYTES) {
    console.warn(`WARN ${message}; accepted only for visual fidelity`);
    return;
  }
  console.log(`OK ${message}`);
}

function assertSourceExists(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Source GLB not found: ${filePath}`);
  }
}

function getRenderableMeshes(scene) {
  return scene.meshes.filter((mesh) => mesh.getTotalVertices() > 0);
}

function forcePositiveScales(scene) {
  for (const node of [...scene.transformNodes, ...scene.meshes]) {
    if (!("scaling" in node) || !node.scaling) continue;
    node.scaling = new Vector3(
      Math.abs(node.scaling.x),
      Math.abs(node.scaling.y),
      Math.abs(node.scaling.z)
    );
  }
}

function normalizeSceneForAr(scene, targetMaxDimMeters) {
  const meshes = getRenderableMeshes(scene);
  if (meshes.length === 0) return;

  const group = new TransformNode("ar-lite-normalize-root", scene);
  for (const node of scene.rootNodes) {
    if (node === group) continue;
    if (node instanceof TransformNode) node.setParent(group);
  }

  const boundsBefore = group.getHierarchyBoundingVectors(true);
  const center = boundsBefore.min.add(boundsBefore.max).scale(0.5);
  group.position.subtractInPlace(new Vector3(center.x, 0, center.z));

  const boundsCentered = group.getHierarchyBoundingVectors(true);
  const size = boundsCentered.max.subtract(boundsCentered.min);
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  group.scaling = group.scaling.scale(targetMaxDimMeters / maxDim);

  const boundsScaled = group.getHierarchyBoundingVectors(true);
  group.position.y -= boundsScaled.min.y;
}

function bakeWorldTransforms(scene) {
  for (const mesh of getRenderableMeshes(scene)) {
    const world = mesh.computeWorldMatrix(true).clone();
    mesh.setParent(null);
    mesh.bakeTransformIntoVertices(world);
    mesh.position = Vector3.Zero();
    mesh.rotationQuaternion = null;
    mesh.rotation = Vector3.Zero();
    mesh.scaling = Vector3.One();
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo(true);
  }

  for (const mesh of [...scene.meshes]) {
    if (mesh.getTotalVertices() === 0) mesh.dispose(false, true);
  }

  for (const node of [...scene.transformNodes]) {
    if ((node.getChildren?.() ?? []).length === 0) node.dispose(false, true);
  }
}

async function normalizeGlbForAr(inputPath, outputPath, targetMaxDimMeters) {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  await AppendSceneAsync(new Uint8Array(readFileSync(inputPath)), scene, {
    pluginExtension: ".glb",
    name: inputPath
  });

  forcePositiveScales(scene);
  normalizeSceneForAr(scene, targetMaxDimMeters);
  bakeWorldTransforms(scene);

  const glb = await GLTF2Export.GLBAsync(scene, "ar-lite-normalized.glb", {
    exportWithoutWaitingForScene: true,
    removeNoopRootNodes: false
  });
  const blob = glb.files["ar-lite-normalized.glb"] ?? glb.glTFFiles?.["ar-lite-normalized.glb"];
  if (!blob || typeof blob === "string") {
    throw new Error(`Unable to export normalized GLB: ${outputPath}`);
  }

  writeFileSync(outputPath, Buffer.from(await blob.arrayBuffer()));
  scene.dispose();
  engine.dispose();
}

async function main() {
  const transform = gltfTransformBin();
  if (!existsSync(transform)) {
    throw new Error(`Missing glTF Transform CLI: ${transform}`);
  }

  mkdirSync(AR_LITE_DIR, { recursive: true });
  rmSync(WORK_DIR, { recursive: true, force: true });
  mkdirSync(WORK_DIR, { recursive: true });

  try {
    const profiles = selectProfiles();

    for (const profile of profiles) {
      const sourcePath = join(DEMO_DIR, profile.source);
      const preJpegPath = join(WORK_DIR, `${profile.slug}-prejpeg.glb`);
      const jpegPath = join(WORK_DIR, `${profile.slug}-jpeg.glb`);
      const normalizedPath = join(WORK_DIR, `${profile.slug}-normalized.glb`);
      const arCompatiblePath = join(WORK_DIR, `${profile.slug}-ar-compatible.glb`);
      const balancedGeometryPath = join(WORK_DIR, `${profile.slug}-balanced-geometry.glb`);
      const outputPath = join(AR_LITE_DIR, profile.output);

      assertSourceExists(sourcePath);
      console.log(`\nBuilding ${profile.output}`);
      console.log(profile.note);
      console.log(`Source ${profile.source}: ${formatSize(statSync(sourcePath).size)}`);

      run(process.execPath, [
        transform,
        "optimize",
        sourcePath,
        preJpegPath,
        "--compress",
        "false",
        "--texture-compress",
        "false",
        "--simplify",
        "true",
        "--simplify-ratio",
        String(profile.simplifyRatio),
        "--simplify-error",
        String(profile.simplifyError),
        "--simplify-lock-border",
        "true"
      ]);

      run(process.execPath, [
        transform,
        "jpeg",
        preJpegPath,
        jpegPath,
        "--quality",
        String(profile.jpegQuality),
        "--formats",
        "*"
      ]);

      await normalizeGlbForAr(jpegPath, normalizedPath, profile.targetMaxDimMeters);

      run(process.execPath, [
        transform,
        "optimize",
        normalizedPath,
        arCompatiblePath,
        "--compress",
        "false",
        "--texture-compress",
        "false",
        "--simplify",
        "false"
      ]);

      run(process.execPath, [
        transform,
        "optimize",
        arCompatiblePath,
        balancedGeometryPath,
        "--compress",
        "false",
        "--texture-compress",
        "false",
        "--simplify",
        "true",
        "--simplify-ratio",
        String(profile.balancedSimplifyRatio),
        "--simplify-error",
        String(profile.balancedSimplifyError),
        "--simplify-lock-border",
        "true"
      ]);

      run(process.execPath, [
        transform,
        "jpeg",
        balancedGeometryPath,
        outputPath,
        "--quality",
        String(profile.finalJpegQuality),
        "--formats",
        "*"
      ]);

      checkBudget(outputPath, profile.output);
    }
  } finally {
    rmSync(WORK_DIR, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
