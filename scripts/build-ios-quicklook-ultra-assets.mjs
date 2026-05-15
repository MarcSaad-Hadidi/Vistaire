import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { NullEngine, Scene, TransformNode, Vector3 } from "@babylonjs/core";
import { AppendSceneAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import "@babylonjs/loaders/glTF/index.js";
import { GLTF2Export } from "@babylonjs/serializers/glTF/2.0/glTFSerializer.js";
import { USDZExportAsync } from "@babylonjs/serializers";
import { Accessor, NodeIO } from "@gltf-transform/core";
import { dedup, prune, weld } from "@gltf-transform/functions";
import * as fflate from "fflate";

globalThis.fflate = fflate;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC_DIR = join(ROOT, "public");
const DEMO_DIR = join(PUBLIC_DIR, "models", "demo");
const AR_LITE_DIR = join(DEMO_DIR, "ar-lite");
const CANDIDATE_ROOT = join(ROOT, "asset-review", "3d-candidates", "ios-quicklook-ultra");
const WORK_ROOT = join(ROOT, "asset-review", "3d-candidates", ".ios-quicklook-work");
const GLTF_TRANSFORM_CLI = join(
  ROOT,
  "node_modules",
  "@gltf-transform",
  "cli",
  "bin",
  "cli.js"
);
const OPTIMIZER = join(__dirname, "optimize-usdz-binary-layers.py");

const MAX_PRODUCTION_IOS_USDZ_BYTES = 5 * 1024 * 1024;
const IDEAL_IOS_USDZ_BYTES = 3 * 1024 * 1024;

const DISHES = new Map([
  [
    "homard-bisque",
    {
      sourceGlb: "homard-bisque.glb",
      quickLookSourceGlb: "ar-lite/homard-bisque-ar-lite.glb",
      targetMaxDimMeters: 0.21,
      productionOutputs: {
        ultra: "homard-bisque-ios-quicklook-ultra.usdz",
        extreme: "homard-bisque-ios-quicklook-extreme.usdz"
      },
      visualPriorities:
        "Preserve lobster claws, shell silhouette, plated composition, realistic bisque/shell color, and table-grounded scale."
    }
  ],
  [
    "ravioles-chevre-miel",
    {
      sourceGlb: "ravioles-chevre-miel.glb",
      quickLookPreparation: "ravioles-visible-shell",
      targetMaxDimMeters: 0.2,
      productionOutputs: {
        ultra: "ravioles-chevre-miel-ios-quicklook-ultra.usdz",
        extreme: "ravioles-chevre-miel-ios-quicklook-extreme.usdz"
      },
      levelOverrides: {
        conservative: {
          simplifyRatio: 0.72,
          simplifyError: 0.01,
          componentMinTriangles: 20,
          textureSize: 1280,
          preJpegQuality: 84,
          finalJpegQuality: 78,
          risk:
            "Quality reference from the AR-only visible-shell source; expected to exceed the production iPhone budget."
        },
        balanced: {
          simplifyRatio: 0.56,
          simplifyError: 0.5,
          simplifyLockBorder: false,
          componentMinTriangles: 50,
          textureSize: 1024,
          preJpegQuality: 80,
          finalJpegQuality: 70,
          risk:
            "Balanced ravioles review candidate; inspect pasta folds, sauce/herb read, and premium color before considering stronger compression."
        },
        ultra: {
          simplifyRatio: 0.44,
          simplifyError: 0.2,
          simplifyLockBorder: false,
          componentMinTriangles: 100,
          textureSize: 896,
          preJpegQuality: 74,
          finalJpegQuality: 62,
          risk:
            "Production ravioles target from the visible-shell AR source; verify pasta identity, sauce highlights, plate composition, grounding, and phone-distance realism before promotion."
        },
        extreme: {
          simplifyRatio: 0.3,
          simplifyError: 1,
          simplifyLockBorder: false,
          componentMinTriangles: 200,
          textureSize: 640,
          preJpegQuality: 64,
          finalJpegQuality: 46,
          risk:
            "Aggressive weak-network ravioles candidate; only promote if it avoids low-poly, blurry, placeholder-like food."
        }
      },
      visualPriorities:
        "Preserve pasta folds, sauce gloss, plate composition, and warm realistic food color."
    }
  ],
  [
    "souffle-chocolat",
    {
      sourceGlb: "souffle-chocolat.glb",
      targetMaxDimMeters: 0.18,
      productionOutputs: {
        ultra: "souffle-chocolat-ios-quicklook-ultra.usdz",
        extreme: "souffle-chocolat-ios-quicklook-extreme.usdz"
      },
      levelOverrides: {
        ultra: {
          simplifyRatio: 0.17,
          simplifyError: 0.006,
          textureSize: 512,
          preJpegQuality: 60,
          finalJpegQuality: 36,
          risk:
            "Production target tuned for souffle; verify ramekin silhouette, souffle volume, and chocolate texture impression manually before promotion."
        }
      },
      visualPriorities:
        "Preserve souffle height, ramekin/plate silhouette, chocolate surface texture, and premium dessert color."
    }
  ]
]);

const LEVELS = [
  {
    key: "conservative",
    label: "Conservative",
    simplifyRatio: 0.8,
    simplifyError: 0.00065,
    simplifyLockBorder: true,
    textureSize: 1536,
    preJpegQuality: 86,
    finalJpegQuality: 82,
    targetBytes: 8 * 1024 * 1024,
    risk: "Highest fidelity comparison candidate; expected to exceed the production iPhone budget."
  },
  {
    key: "balanced",
    label: "Balanced",
    simplifyRatio: 0.58,
    simplifyError: 0.0011,
    simplifyLockBorder: true,
    textureSize: 1280,
    preJpegQuality: 82,
    finalJpegQuality: 76,
    targetBytes: 7 * 1024 * 1024,
    risk: "Visual comparison candidate; may still exceed 5 MiB but should expose the premium-quality baseline."
  },
  {
    key: "ultra",
    label: "Ultra",
    simplifyRatio: 0.22,
    simplifyError: 0.0045,
    simplifyLockBorder: true,
    textureSize: 640,
    preJpegQuality: 66,
    finalJpegQuality: 56,
    targetBytes: MAX_PRODUCTION_IOS_USDZ_BYTES,
    risk: "Production target; verify shell/claw silhouette and texture impression manually before promotion."
  },
  {
    key: "extreme",
    label: "Extreme",
    simplifyRatio: 0.01,
    simplifyError: 0.1,
    simplifyLockBorder: false,
    textureSize: 256,
    preJpegQuality: 40,
    finalJpegQuality: 30,
    targetBytes: IDEAL_IOS_USDZ_BYTES,
    risk: "Weak-network fallback; likely visible quality loss, only promote if it still reads premium on an iPhone."
  }
];

function levelsForDish(dish) {
  return LEVELS.map((level) => ({
    ...level,
    ...(dish.levelOverrides?.[level.key] ?? {})
  }));
}

function usage() {
  return [
    "Usage:",
    "  npm run demo:build-ios-ultra -- <dish-slug> [--promote ultra|extreme] [--quality-approved]",
    "",
    "Examples:",
    "  npm run demo:build-ios-ultra -- homard-bisque",
    "  npm run demo:build-ios-ultra -- homard-bisque --promote ultra --quality-approved",
    "",
    "The script builds candidates under asset-review/3d-candidates/ios-quicklook-ultra.",
    "It promotes a public production USDZ only when --promote and --quality-approved are both present."
  ].join("\n");
}

function parseArgs(argv) {
  const positional = [];
  const options = {
    promote: null,
    qualityApproved: false,
    keepWork: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--promote") {
      options.promote = argv[index + 1] ?? "";
      index += 1;
    } else if (arg.startsWith("--promote=")) {
      options.promote = arg.split("=")[1] ?? "";
    } else if (arg === "--quality-approved") {
      options.qualityApproved = true;
    } else if (arg === "--keep-work") {
      options.keepWork = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else if (arg === "--") {
      continue;
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}\n\n${usage()}`);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length !== 1) {
    throw new Error(`Expected exactly one dish slug.\n\n${usage()}`);
  }

  return { slug: positional[0], options };
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

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

function isGitLfsPointer(bytes) {
  return bytes
    .subarray(0, 64)
    .toString("utf8")
    .startsWith("version https://git-lfs.github.com/spec/v1");
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
    "Missing Pixar OpenUSD Python bindings. Set USDZ_OPTIMIZER_PYTHON to a Python that can import pxr."
  );
}

function assertSourceGlb(sourcePath) {
  if (!existsSync(sourcePath)) {
    throw new Error(`Source GLB not found: ${sourcePath}`);
  }
  const bytes = readFileSync(sourcePath);
  if (bytes.length === 0) throw new Error(`Source GLB is empty: ${sourcePath}`);
  if (isGitLfsPointer(bytes)) throw new Error(`Source GLB is a Git LFS pointer: ${sourcePath}`);
  if (bytes.subarray(0, 4).toString("utf8") !== "glTF") {
    throw new Error(`Source GLB has an invalid signature: ${sourcePath}`);
  }
}

function readGlbJson(bytes) {
  const jsonLength = bytes.readUInt32LE(12);
  const jsonType = bytes.readUInt32LE(16);
  if (jsonType !== 0x4e4f534a) {
    throw new Error("GLB first chunk is not JSON.");
  }
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8"));
}

function inspectGlb(filePath) {
  const bytes = readFileSync(filePath);
  const json = readGlbJson(bytes);
  const primitives = (json.meshes ?? []).flatMap((mesh) => mesh.primitives ?? []);
  const accessors = json.accessors ?? [];
  let triangles = 0;
  for (const primitive of primitives) {
    if (primitive.indices != null) {
      triangles += Math.floor((accessors[primitive.indices]?.count ?? 0) / 3);
    }
  }

  return {
    path: filePath,
    bytes: bytes.length,
    meshCount: json.meshes?.length ?? 0,
    primitiveCount: primitives.length,
    triangleCount: triangles,
    imageCount: json.images?.length ?? 0,
    textureCount: json.textures?.length ?? 0,
    materialCount: json.materials?.length ?? 0,
    requiredExtensions: json.extensionsRequired ?? []
  };
}

async function prepareRaviolesQuickLookSource(sourcePath, outputPath) {
  const io = new NodeIO();
  const document = await io.read(sourcePath);
  const root = document.getRoot();
  const nodes = root.listNodes();
  const expensiveDuplicate = nodes.find((node) => node.getName() === "geometry_0");
  const retainedFood = nodes.find((node) => node.getName() === "geometry_0.001");

  if (!expensiveDuplicate || !retainedFood) {
    throw new Error(
      "Ravioles AR source preparation expected geometry_0 and geometry_0.001 food shells."
    );
  }

  const removedMesh = expensiveDuplicate.getMesh();
  expensiveDuplicate.dispose();
  if (removedMesh) removedMesh.dispose();

  for (const material of root.listMaterials()) {
    const name = material.getName().toLowerCase();
    if (name.includes("material_0")) {
      material.setMetallicRoughnessTexture(null);
      material.setMetallicFactor(0);
      material.setRoughnessFactor(0.5);
    }
  }

  await document.transform(prune(), dedup(), weld({ tolerance: 1e-6 }));
  mkdirSync(dirname(outputPath), { recursive: true });
  await io.write(outputPath, document);

  const prepared = inspectGlb(outputPath);
  console.log(
    `Prepared ravioles AR source: ${formatSize(prepared.bytes)}, ${prepared.triangleCount.toLocaleString(
      "en-US"
    )} triangles, ${prepared.materialCount} materials, ${prepared.textureCount} texture(s)`
  );
}

async function prepareQuickLookSource({ dish, slug, sourcePath, workDir }) {
  if (dish.quickLookPreparation !== "ravioles-visible-shell") return sourcePath;

  const outputPath = join(workDir, "source", `${slug}-visible-shell-source.glb`);
  await prepareRaviolesQuickLookSource(sourcePath, outputPath);
  return outputPath;
}

function createDisjointSet(count) {
  const parent = new Int32Array(count);
  const size = new Int32Array(count);
  for (let index = 0; index < count; index += 1) {
    parent[index] = index;
    size[index] = 1;
  }

  function find(value) {
    let root = value;
    while (parent[root] !== root) root = parent[root];
    while (parent[value] !== value) {
      const next = parent[value];
      parent[value] = root;
      value = next;
    }
    return root;
  }

  function union(a, b) {
    let rootA = find(a);
    let rootB = find(b);
    if (rootA === rootB) return;
    if (size[rootA] < size[rootB]) {
      const temp = rootA;
      rootA = rootB;
      rootB = temp;
    }
    parent[rootB] = rootA;
    size[rootA] += size[rootB];
  }

  return { find, union };
}

function copyAccessorElements(document, buffer, sourceAccessor, orderedIndices, semantic) {
  const sourceArray = sourceAccessor.getArray();
  if (!sourceArray) {
    throw new Error(`Missing accessor array for ${semantic}.`);
  }

  const elementSize = sourceAccessor.getElementSize();
  const TargetArray = sourceArray.constructor;
  const targetArray = new TargetArray(orderedIndices.length * elementSize);

  for (let newIndex = 0; newIndex < orderedIndices.length; newIndex += 1) {
    const sourceIndex = orderedIndices[newIndex];
    for (let component = 0; component < elementSize; component += 1) {
      targetArray[newIndex * elementSize + component] =
        sourceArray[sourceIndex * elementSize + component];
    }
  }

  return document
    .createAccessor(`${sourceAccessor.getName() || semantic}-pruned`)
    .setArray(targetArray)
    .setType(sourceAccessor.getType())
    .setBuffer(buffer)
    .setNormalized(sourceAccessor.getNormalized());
}

function prunePrimitiveSmallComponents(document, buffer, primitive, minTriangles) {
  const indices = primitive.getIndices();
  const position = primitive.getAttribute("POSITION");
  if (!indices || !position) return null;

  const indexArray = indices.getArray();
  if (!indexArray) {
    throw new Error("Missing ravioles primitive indices during component pruning.");
  }

  const triangleCount = Math.floor(indexArray.length / 3);
  const vertexCount = position.getCount();
  const disjointSet = createDisjointSet(vertexCount);

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const a = indexArray[triangle * 3];
    const b = indexArray[triangle * 3 + 1];
    const c = indexArray[triangle * 3 + 2];
    disjointSet.union(a, b);
    disjointSet.union(a, c);
  }

  const componentTriangles = new Map();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const root = disjointSet.find(indexArray[triangle * 3]);
    componentTriangles.set(root, (componentTriangles.get(root) ?? 0) + 1);
  }

  const oldToNew = new Map();
  const newIndices = [];
  let removedTriangles = 0;

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const root = disjointSet.find(indexArray[triangle * 3]);
    if ((componentTriangles.get(root) ?? 0) < minTriangles) {
      removedTriangles += 1;
      continue;
    }

    for (let corner = 0; corner < 3; corner += 1) {
      const oldIndex = indexArray[triangle * 3 + corner];
      let newIndex = oldToNew.get(oldIndex);
      if (newIndex === undefined) {
        newIndex = oldToNew.size;
        oldToNew.set(oldIndex, newIndex);
      }
      newIndices.push(newIndex);
    }
  }

  if (removedTriangles === 0) {
    return {
      beforeTriangles: triangleCount,
      afterTriangles: triangleCount,
      removedTriangles: 0,
      afterVertices: vertexCount
    };
  }

  const orderedOldIndices = Array.from(oldToNew.keys());
  for (const semantic of primitive.listSemantics()) {
    const sourceAccessor = primitive.getAttribute(semantic);
    primitive.setAttribute(
      semantic,
      copyAccessorElements(document, buffer, sourceAccessor, orderedOldIndices, semantic)
    );
  }

  const IndexArray = orderedOldIndices.length > 65535 ? Uint32Array : Uint16Array;
  primitive.setIndices(
    document
      .createAccessor("indices-pruned")
      .setArray(new IndexArray(newIndices))
      .setType(Accessor.Type.SCALAR)
      .setBuffer(buffer)
  );

  return {
    beforeTriangles: triangleCount,
    afterTriangles: Math.floor(newIndices.length / 3),
    removedTriangles,
    afterVertices: orderedOldIndices.length
  };
}

async function pruneRaviolesSmallComponents(inputPath, outputPath, minTriangles) {
  const io = new NodeIO();
  const document = await io.read(inputPath);
  const root = document.getRoot();
  const buffer = root.listBuffers()[0] ?? document.createBuffer();
  const summaries = [];

  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const materialName = primitive.getMaterial()?.getName().toLowerCase() ?? "";
      if (!materialName.includes("material_0")) continue;

      const summary = prunePrimitiveSmallComponents(
        document,
        buffer,
        primitive,
        minTriangles
      );
      if (summary) summaries.push(summary);
    }
  }

  if (summaries.length === 0) {
    throw new Error("Ravioles component pruning found no food primitive to process.");
  }

  await document.transform(prune(), dedup(), weld({ tolerance: 1e-6 }));
  mkdirSync(dirname(outputPath), { recursive: true });
  await io.write(outputPath, document);

  const aggregate = summaries.reduce(
    (total, summary) => ({
      beforeTriangles: total.beforeTriangles + summary.beforeTriangles,
      afterTriangles: total.afterTriangles + summary.afterTriangles,
      removedTriangles: total.removedTriangles + summary.removedTriangles,
      afterVertices: total.afterVertices + summary.afterVertices
    }),
    { beforeTriangles: 0, afterTriangles: 0, removedTriangles: 0, afterVertices: 0 }
  );

  console.log(
    `Ravioles component pruning >=${minTriangles} tris: ${aggregate.beforeTriangles.toLocaleString(
      "en-US"
    )} -> ${aggregate.afterTriangles.toLocaleString("en-US")} food triangles`
  );
  return aggregate;
}

async function prepareCandidateSource({ dish, level, sourcePath, levelWork }) {
  if (
    dish.quickLookPreparation !== "ravioles-visible-shell" ||
    !level.componentMinTriangles
  ) {
    return { sourcePath, preparation: null };
  }

  const outputPath = join(
    levelWork,
    `source-min${level.componentMinTriangles}.glb`
  );
  const preparation = await pruneRaviolesSmallComponents(
    sourcePath,
    outputPath,
    level.componentMinTriangles
  );
  return {
    sourcePath: outputPath,
    preparation: {
      componentMinTriangles: level.componentMinTriangles,
      ...preparation
    }
  };
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

  const group = new TransformNode("ios-quicklook-normalize-root", scene);
  for (const node of scene.rootNodes) {
    if (node === group) continue;
    if (typeof node.setParent === "function") node.setParent(group);
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

function measureRenderableBounds(meshes) {
  let min = null;
  let max = null;
  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo(true);
    const box = mesh.getBoundingInfo().boundingBox;
    min = min ? Vector3.Minimize(min, box.minimumWorld) : box.minimumWorld.clone();
    max = max ? Vector3.Maximize(max, box.maximumWorld) : box.maximumWorld.clone();
  }
  return min && max ? { min, max } : null;
}

function centerBakedScene(scene) {
  const meshes = getRenderableMeshes(scene);
  const bounds = measureRenderableBounds(meshes);
  if (!bounds) return;

  const center = bounds.min.add(bounds.max).scale(0.5);
  const offset = new Vector3(-center.x, -bounds.min.y, -center.z);
  for (const mesh of meshes) {
    mesh.position.addInPlace(offset);
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo(true);
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
  centerBakedScene(scene);

  const glb = await GLTF2Export.GLBAsync(scene, "ios-quicklook-normalized.glb", {
    exportWithoutWaitingForScene: true,
    removeNoopRootNodes: false
  });
  const blob =
    glb.files["ios-quicklook-normalized.glb"] ??
    glb.glTFFiles?.["ios-quicklook-normalized.glb"];
  if (!blob || typeof blob === "string") {
    throw new Error(`Unable to export normalized GLB: ${outputPath}`);
  }

  writeFileSync(outputPath, Buffer.from(await blob.arrayBuffer()));
  scene.dispose();
  engine.dispose();
}

async function measureSceneBounds(glbPath) {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  await AppendSceneAsync(new Uint8Array(readFileSync(glbPath)), scene, {
    pluginExtension: ".glb",
    name: glbPath
  });

  const meshes = getRenderableMeshes(scene);
  if (meshes.length === 0) {
    scene.dispose();
    engine.dispose();
    return null;
  }

  let min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  let max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo(true);
    const bounds = mesh.getHierarchyBoundingVectors(true);
    min = Vector3.Minimize(min, bounds.min);
    max = Vector3.Maximize(max, bounds.max);
  }

  const size = max.subtract(min);
  const center = min.add(max).scale(0.5);
  scene.dispose();
  engine.dispose();
  return {
    min: { x: min.x, y: min.y, z: min.z },
    max: { x: max.x, y: max.y, z: max.z },
    center: { x: center.x, y: center.y, z: center.z },
    size: { x: size.x, y: size.y, z: size.z },
    grounded: Math.abs(min.y) <= 0.002,
    centeredXZ: Math.abs(center.x) <= 0.01 && Math.abs(center.z) <= 0.01
  };
}

async function convertGlbToUsdz(glbPath, usdzPath, modelFileName) {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  await AppendSceneAsync(new Uint8Array(readFileSync(glbPath)), scene, {
    pluginExtension: ".glb",
    name: glbPath
  });

  const bytes = await USDZExportAsync(scene, {
    includeAnchoringProperties: true,
    modelFileName
  });
  writeFileSync(usdzPath, Buffer.from(bytes));
  scene.dispose();
  engine.dispose();
}

function inspectUsdz(filePath) {
  const bytes = readFileSync(filePath);
  if (bytes.length === 0) throw new Error(`USDZ is empty: ${filePath}`);
  if (isGitLfsPointer(bytes)) throw new Error(`USDZ is a Git LFS pointer: ${filePath}`);
  if (bytes.subarray(0, 2).toString("utf8") !== "PK") {
    throw new Error(`USDZ has an invalid ZIP signature: ${filePath}`);
  }

  const zip = fflate.unzipSync(bytes);
  const entries = Object.entries(zip)
    .map(([name, data]) => ({ name, bytes: data.length }))
    .sort((a, b) => b.bytes - a.bytes);
  const names = entries.map((entry) => entry.name);
  const usdEntries = names.filter((name) => /\.usd[ac]?$/i.test(name));
  const geometryEntries = names.filter((name) => /(?:^|\/)geometries\/.*\.usd[ac]?$/i.test(name));
  const textureEntries = names.filter((name) => /\.(?:jpe?g|png|webp)$/i.test(name));

  return {
    path: filePath,
    bytes: bytes.length,
    validZip: true,
    usdLayerCount: usdEntries.length,
    geometryLayerCount: geometryEntries.length,
    textureCount: textureEntries.length,
    largestEntries: entries.slice(0, 8),
    valid:
      usdEntries.length > 0 &&
      geometryEntries.length > 0 &&
      textureEntries.length > 0
  };
}

function candidateRisk(level, glbInfo, usdzInfo, bounds) {
  const risks = [level.risk];
  if (glbInfo.requiredExtensions.length > 0) {
    risks.push(`Required GLB extensions remain: ${glbInfo.requiredExtensions.join(", ")}`);
  }
  if (glbInfo.triangleCount < 50_000) {
    risks.push("Triangle count is below the preferred 50k lower bound; inspect for low-poly silhouette damage.");
  }
  if (glbInfo.triangleCount > 90_000 && level.key === "ultra") {
    risks.push("Ultra candidate is above the preferred 90k triangle ceiling; size may be fragile.");
  }
  if (level.textureSize <= 768) {
    risks.push(`Texture cap is ${level.textureSize}px; inspect close-up food texture realism.`);
  }
  if (!usdzInfo.valid) {
    risks.push("USDZ package is missing expected geometry or texture entries.");
  }
  if (bounds && !bounds.grounded) {
    risks.push("Scene bounds are not grounded within tolerance.");
  }
  if (bounds && !bounds.centeredXZ) {
    risks.push("Scene bounds are not centered on X/Z within tolerance.");
  }
  if (usdzInfo.bytes > MAX_PRODUCTION_IOS_USDZ_BYTES) {
    risks.push("Above the 5 MiB production iPhone Quick Look ceiling.");
  }
  return risks;
}

function promotionOutputName(dish, levelKey) {
  const output = dish.productionOutputs[levelKey];
  if (!output) {
    throw new Error(`No production output name configured for level: ${levelKey}`);
  }
  return output;
}

async function buildCandidate({
  dish,
  slug,
  level,
  sourcePath,
  manifestSourcePath,
  candidateDir,
  workDir,
  optimizerPython
}) {
  const levelWork = join(workDir, level.key);
  const geometryGlb = join(levelWork, `${slug}-${level.key}-geometry.glb`);
  const resizedGlb = join(levelWork, `${slug}-${level.key}-${level.textureSize}.glb`);
  const preJpegGlb = join(levelWork, `${slug}-${level.key}-prejpeg.glb`);
  const normalizedGlb = join(levelWork, `${slug}-${level.key}-normalized.glb`);
  const compatibleGlb = join(levelWork, `${slug}-${level.key}-compatible.glb`);
  const finalGlb = join(candidateDir, `${slug}-ios-${level.key}.glb`);
  const rawUsdz = join(candidateDir, `${slug}-ios-${level.key}.raw.usdz`);
  const optimizedUsdz = join(candidateDir, `${slug}-ios-${level.key}.usdz`);

  mkdirSync(levelWork, { recursive: true });
  const prepared = await prepareCandidateSource({ dish, level, sourcePath, levelWork });
  const levelSourcePath = prepared.sourcePath;

  console.log(`\n${level.label}: generating GLB candidate`);
  run(process.execPath, [
    GLTF_TRANSFORM_CLI,
    "optimize",
    levelSourcePath,
    geometryGlb,
    "--compress",
    "false",
    "--texture-compress",
    "false",
    "--simplify",
    "true",
    "--simplify-ratio",
    String(level.simplifyRatio),
    "--simplify-error",
    String(level.simplifyError),
    "--simplify-lock-border",
    String(level.simplifyLockBorder),
    "--palette",
    "false"
  ]);

  run(process.execPath, [
    GLTF_TRANSFORM_CLI,
    "resize",
    geometryGlb,
    resizedGlb,
    "--width",
    String(level.textureSize),
    "--height",
    String(level.textureSize)
  ]);

  run(process.execPath, [
    GLTF_TRANSFORM_CLI,
    "jpeg",
    resizedGlb,
    preJpegGlb,
    "--quality",
    String(level.preJpegQuality),
    "--formats",
    "*"
  ]);

  await normalizeGlbForAr(preJpegGlb, normalizedGlb, dish.targetMaxDimMeters);

  run(process.execPath, [
    GLTF_TRANSFORM_CLI,
    "optimize",
    normalizedGlb,
    compatibleGlb,
    "--compress",
    "false",
    "--texture-compress",
    "false",
    "--simplify",
    "false",
    "--palette",
    "false"
  ]);

  run(process.execPath, [
    GLTF_TRANSFORM_CLI,
    "jpeg",
    compatibleGlb,
    finalGlb,
    "--quality",
    String(level.finalJpegQuality),
    "--formats",
    "*"
  ]);

  console.log(`${level.label}: converting GLB to USDZ`);
  await convertGlbToUsdz(finalGlb, rawUsdz, `${slug}-${level.key}.usda`);
  run(optimizerPython, [OPTIMIZER, rawUsdz, optimizedUsdz]);

  const glbInfo = inspectGlb(finalGlb);
  const bounds = await measureSceneBounds(finalGlb);
  const usdzInfo = inspectUsdz(optimizedUsdz);
  const risks = candidateRisk(level, glbInfo, usdzInfo, bounds);
  const candidate = {
    level: level.key,
    label: level.label,
    targetBytes: level.targetBytes,
    sourceGlb: manifestSourcePath,
    sourcePreparation: prepared.preparation,
    glbPath: finalGlb,
    usdzPath: optimizedUsdz,
    glb: glbInfo,
    usdz: usdzInfo,
    bounds,
    visualPriorities: dish.visualPriorities,
    risks,
    productionBudgetPass: usdzInfo.bytes <= MAX_PRODUCTION_IOS_USDZ_BYTES,
    idealBudgetPass: usdzInfo.bytes <= IDEAL_IOS_USDZ_BYTES
  };

  console.log(
    `${level.label}: USDZ ${formatSize(usdzInfo.bytes)}, GLB triangles ${glbInfo.triangleCount.toLocaleString("en-US")}`
  );
  return candidate;
}

function writeManifest(candidateDir, slug, sourcePath, candidates) {
  const manifest = {
    generatedAt: new Date().toISOString(),
    slug,
    sourceGlb: sourcePath,
    productionBudgetBytes: MAX_PRODUCTION_IOS_USDZ_BYTES,
    idealBudgetBytes: IDEAL_IOS_USDZ_BYTES,
    acceptanceRules: [
      "Original source assets stay untouched.",
      "Candidates are review artifacts and are not production-approved by default.",
      "Promotion requires <= 5 MiB, valid USDZ contents, centered/grounded GLB bounds, and manual visual approval.",
      "If no candidate preserves premium restaurant quality, keep the original active asset untouched and require artist optimization."
    ],
    candidates
  };
  const manifestPath = join(candidateDir, `${slug}-ios-quicklook-candidates.manifest.json`);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifestPath;
}

function promoteCandidate({ dish, levelKey, candidate, qualityApproved }) {
  if (candidate.failed) {
    throw new Error(
      `Refusing production promotion: ${candidate.label} candidate failed to build.`
    );
  }
  if (!qualityApproved) {
    throw new Error(
      "Refusing production promotion without --quality-approved. Manual visual review must reject cheap/cartoon/placeholder-looking candidates."
    );
  }
  if (!candidate.productionBudgetPass) {
    throw new Error(
      `Refusing production promotion: ${basename(candidate.usdzPath)} is ${formatSize(
        candidate.usdz.bytes
      )}, above ${formatSize(MAX_PRODUCTION_IOS_USDZ_BYTES)}.`
    );
  }
  if (!candidate.usdz.valid) {
    throw new Error("Refusing production promotion: USDZ validation failed.");
  }
  if (!candidate.bounds?.grounded || !candidate.bounds?.centeredXZ) {
    throw new Error("Refusing production promotion: candidate is not centered and grounded.");
  }

  const outputName = promotionOutputName(dish, levelKey);
  const productionPath = join(AR_LITE_DIR, outputName);
  mkdirSync(AR_LITE_DIR, { recursive: true });
  copyFileSync(candidate.usdzPath, productionPath);
  console.log(`\nPROMOTED ${basename(candidate.usdzPath)} -> ${productionPath}`);
  console.log(`Production size: ${formatSize(statSync(productionPath).size)}`);
  return productionPath;
}

async function main() {
  const { slug, options } = parseArgs(process.argv.slice(2));
  const dish = DISHES.get(slug);
  if (!dish) {
    throw new Error(`Unknown dish slug: ${slug}. Known slugs: ${[...DISHES.keys()].join(", ")}`);
  }
  if (!existsSync(GLTF_TRANSFORM_CLI)) {
    throw new Error(`Missing glTF Transform CLI: ${GLTF_TRANSFORM_CLI}`);
  }

  const originalSourcePath = join(DEMO_DIR, dish.quickLookSourceGlb ?? dish.sourceGlb);
  let sourcePath = originalSourcePath;
  assertSourceGlb(sourcePath);
  const optimizerPython = findOpenUsdPython();
  const candidateDir = join(CANDIDATE_ROOT, slug);
  const workDir = join(WORK_ROOT, slug);

  rmSync(candidateDir, { recursive: true, force: true });
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(candidateDir, { recursive: true });
  mkdirSync(workDir, { recursive: true });

  console.log(`Building iPhone Quick Look candidates for ${slug}`);
  console.log(`Source: ${sourcePath} (${formatSize(statSync(sourcePath).size)})`);
  if (dish.quickLookSourceGlb) {
    console.log(`Original source kept untouched: ${join(DEMO_DIR, dish.sourceGlb)}`);
  }
  console.log(`OpenUSD Python: ${optimizerPython}`);
  console.log(`Candidate directory: ${candidateDir}`);
  console.log(`Visual priorities: ${dish.visualPriorities}`);

  const candidates = [];
  const levels = levelsForDish(dish);
  try {
    sourcePath = await prepareQuickLookSource({ dish, slug, sourcePath, workDir });
    if (sourcePath !== originalSourcePath) {
      console.log(`AR-only prepared source: ${sourcePath} (${formatSize(statSync(sourcePath).size)})`);
      console.log(`Original source kept untouched: ${originalSourcePath}`);
    }

    for (const level of levels) {
      try {
        candidates.push(
          await buildCandidate({
            dish,
            slug,
            level,
            sourcePath,
            manifestSourcePath: originalSourcePath,
            candidateDir,
            workDir,
            optimizerPython
          })
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`\n${level.label}: failed; continuing to next candidate level.`);
        console.warn(message);
        candidates.push({
          level: level.key,
          label: level.label,
          targetBytes: level.targetBytes,
          sourceGlb: originalSourcePath,
          failed: true,
          error: message,
          visualPriorities: dish.visualPriorities,
          risks: [
            level.risk,
            "Candidate build failed before technical/visual approval; not production-approved."
          ],
          productionBudgetPass: false,
          idealBudgetPass: false
        });
      }
    }

    const manifestPath = writeManifest(candidateDir, slug, originalSourcePath, candidates);
    console.log(`\nWrote candidate manifest: ${manifestPath}`);
    console.log("\nCandidate summary:");
    for (const candidate of candidates) {
      if (candidate.failed) {
        console.log(`- ${candidate.label}: failed (${candidate.error})`);
        continue;
      }
      const flags = [
        candidate.productionBudgetPass ? "<=5MiB" : ">5MiB",
        candidate.idealBudgetPass ? "<=3MiB" : ">3MiB",
        candidate.usdz.valid ? "valid-usdz" : "invalid-usdz",
        candidate.bounds?.grounded ? "grounded" : "not-grounded",
        candidate.bounds?.centeredXZ ? "centered" : "not-centered"
      ].join(", ");
      console.log(
        `- ${candidate.label}: ${formatSize(candidate.usdz.bytes)} USDZ, ${candidate.glb.triangleCount.toLocaleString(
          "en-US"
        )} triangles (${flags})`
      );
    }

    if (options.promote) {
      const candidate = candidates.find((item) => item.level === options.promote);
      if (!candidate) {
        throw new Error(
          `Cannot promote unknown candidate level: ${options.promote}. Known levels: ${levels.map(
            (level) => level.key
          ).join(", ")}`
        );
      }
      promoteCandidate({
        dish,
        levelKey: options.promote,
        candidate,
        qualityApproved: options.qualityApproved
      });
    } else {
      console.log("\nNo production file was promoted. Review candidates before using --promote.");
    }
  } finally {
    if (!options.keepWork) rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
