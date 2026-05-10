/**
 * Convertit les GLB démo en USDZ pour Quick Look / ios-src (model-viewer).
 * Utilise Babylon.js (NullEngine) + fflate — fonctionne sur Windows sans Xcode.
 *
 * Prérequis : les fichiers .glb dans public/models/demo/
 *   npm run demo:generate-3d
 *
 * Puis :
 *   npm run demo:convert-usdz
 */
/* global globalThis */
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Color3,
  NullEngine,
  Matrix,
  PBRMaterial,
  Scene,
  TransformNode,
  Vector3,
  VertexBuffer,
  VertexData
} from "@babylonjs/core";
import { AppendSceneAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import "@babylonjs/loaders/glTF/index.js";
import { USDZExportAsync } from "@babylonjs/serializers";
import * as fflate from "fflate";

/** Babylon USDZ exporter attend `fflate` global (navigateur charge un script CDN sinon). */
globalThis.fflate = fflate;

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMO_DIR = join(__dirname, "..", "public", "models", "demo");

const FILES = [
  "ravioles-chevre-miel.glb",
  "homard-bisque.glb",
  "souffle-chocolat.glb",
  "maison-elyse-n1.glb"
];

const AR_EXPORT_CONFIG = {
  "ravioles-chevre-miel.glb": {
    targetMaxDimMeters: 0.21,
    yawDegrees: 0
  },
  "homard-bisque.glb": {
    targetMaxDimMeters: 0.21,
    yawDegrees: 180
  },
  "souffle-chocolat.glb": {
    targetMaxDimMeters: 0.17,
    yawDegrees: 0
  }
};

/**
 * Normalisation AR (USDZ only) :
 * - centre X/Z à l’origine,
 * - pose le bas du modèle à y=0 (sur la table),
 * - réduit la plus grande dimension à targetMaxDimMeters.
 */
function normalizeSceneForAr(scene, targetMaxDimMeters) {
  const meshes = scene.meshes.filter((m) => m.getTotalVertices() > 0);
  if (meshes.length === 0) return;

  const group = new TransformNode("ar-normalize-root", scene);

  for (const node of scene.rootNodes) {
    if (node === group) continue;
    if (node instanceof TransformNode) {
      node.setParent(group);
    }
  }

  const boundsBefore = group.getHierarchyBoundingVectors(true);
  const center = boundsBefore.min.add(boundsBefore.max).scale(0.5);
  group.position.subtractInPlace(new Vector3(center.x, 0, center.z));

  const boundsCentered = group.getHierarchyBoundingVectors(true);
  const size = boundsCentered.max.subtract(boundsCentered.min);
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = targetMaxDimMeters / maxDim;
  group.scaling = group.scaling.scale(scale);

  const boundsScaled = group.getHierarchyBoundingVectors(true);
  group.position.y -= boundsScaled.min.y;
}

function getRenderableMeshes(scene) {
  return scene.meshes.filter((m) => m.getTotalVertices() > 0);
}

function getSceneBounds(scene) {
  const meshes = getRenderableMeshes(scene);
  if (meshes.length === 0) return null;
  const bounds = scene.getWorldExtends((mesh) => meshes.includes(mesh));
  const size = bounds.max.subtract(bounds.min);
  return { min: bounds.min, max: bounds.max, size };
}

function formatVector(v) {
  return v.asArray().map((n) => Number(n.toFixed(5)));
}

function logBounds(label, bounds) {
  if (!bounds) {
    console.log(`${label}: aucun mesh exportable`);
    return;
  }
  console.log(
    `${label}: min=${JSON.stringify(formatVector(bounds.min))} max=${JSON.stringify(
      formatVector(bounds.max)
    )} size=${JSON.stringify(formatVector(bounds.size))}`
  );
}

function logRootTransforms(label, scene) {
  const transforms = scene.rootNodes.map((node) => {
    const rotation = node.rotationQuaternion
      ? node.rotationQuaternion.toEulerAngles()
      : node.rotation;
    return {
      name: node.name,
      position: formatVector(node.position),
      rotation: formatVector(rotation),
      scale: formatVector(node.scaling)
    };
  });
  console.log(`${label}: ${JSON.stringify(transforms)}`);
}

/**
 * Certains GLB optimisés ont un root mesh vide au-dessus du vrai mesh. L'export
 * USDZ Babylon peut alors référencer ce parent vide et écrire une géométrie
 * `undefined`. On bake les transforms monde sur les meshes rendus, puis on les
 * détache avant export.
 */
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
    if (mesh.getTotalVertices() === 0) {
      mesh.dispose(false, true);
    }
  }

  for (const node of [...scene.transformNodes]) {
    if ((node.getChildren?.() ?? []).length === 0) {
      node.dispose(false, true);
    }
  }
}

function rotateRenderableMeshesAroundY(scene, radians) {
  const rotation = Matrix.RotationY(radians);
  for (const mesh of getRenderableMeshes(scene)) {
    mesh.bakeTransformIntoVertices(rotation);
    mesh.refreshBoundingInfo(true);
  }
}

function isRaviolesPlateMesh(mesh) {
  const name = `${mesh.name} ${mesh.material?.name ?? ""}`.toLowerCase();
  return (
    name.includes("assiette") ||
    name.includes("rebord") ||
    name.includes("céramique") ||
    name.includes("ceramique")
  );
}

function tuneRaviolesArScene(scene) {
  const meshes = getRenderableMeshes(scene);
  const plateMeshes = meshes.filter(isRaviolesPlateMesh);
  const foodMeshes = meshes.filter((mesh) => !isRaviolesPlateMesh(mesh));
  if (plateMeshes.length === 0) return;

  const plateBounds = scene.getWorldExtends((mesh) => plateMeshes.includes(mesh));
  const plateSize = plateBounds.max.subtract(plateBounds.min);
  const tiltRatio =
    plateSize.y / Math.max(plateSize.x, plateSize.z, Number.EPSILON);
  const plateTopY = plateBounds.max.y;

  for (const material of scene.materials) {
    if (!material.name.toLowerCase().includes("céramique") && !material.name.toLowerCase().includes("ceramique")) {
      continue;
    }
    material.alpha = 1;
    material.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE;
    material.albedoColor = new Color3(0.96, 0.92, 0.84);
    material.metallic = 0;
    material.roughness = 0.58;
    material.backFaceCulling = false;
  }

  if (foodMeshes.length > 0) {
    const foodBounds = scene.getWorldExtends((mesh) => foodMeshes.includes(mesh));
    const targetFoodMinY = plateTopY + 0.002;
    const liftY = Math.max(0, targetFoodMinY - foodBounds.min.y);
    if (liftY > 0) {
      const lift = Matrix.Translation(0, liftY, 0);
      for (const mesh of foodMeshes) {
        mesh.bakeTransformIntoVertices(lift);
        mesh.refreshBoundingInfo(true);
      }
    }
    const adjustedFoodBounds = scene.getWorldExtends((mesh) =>
      foodMeshes.includes(mesh)
    );
    console.log(
      `ravioles food lift: beforeMinY=${Number(
        foodBounds.min.y.toFixed(5)
      )} plateTopY=${Number(plateTopY.toFixed(5))} liftY=${Number(
        liftY.toFixed(5)
      )} afterMinY=${Number(adjustedFoodBounds.min.y.toFixed(5))}`
    );
  }

  console.log(
    `ravioles plate plane check: size=${JSON.stringify(
      formatVector(plateSize)
    )} tiltRatio=${Number(tiltRatio.toFixed(5))}`
  );
}

function ensureMeshNormals(scene) {
  for (const mesh of getRenderableMeshes(scene)) {
    if (mesh.getVerticesData(VertexBuffer.NormalKind)) continue;
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    if (!positions || !indices) continue;

    const normals = [];
    VertexData.ComputeNormals(positions, indices, normals);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals);
    mesh.refreshBoundingInfo(true);
  }
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

function ensureUsdzContainsGeometry(bytes, usdzName) {
  const zip = fflate.unzipSync(new Uint8Array(bytes));
  const usdEntries = Object.entries(zip).filter(([name]) => /\.usd[ac]?$/i.test(name));
  const usdText = usdEntries
    .map(([, entryBytes]) => Buffer.from(entryBytes).toString("utf8"))
    .join("\n");
  const hasGeometry =
    /\bdef\s+Mesh\b/.test(usdText) ||
    /\bpoint3f\[\]\s+points\b/.test(usdText) ||
    /\bint\[\]\s+faceVertexIndices\b/.test(usdText);
  if (!hasGeometry || /\bundefined\b/.test(usdText)) {
    throw new Error(
      `${usdzName} ne contient pas de géométrie USD exportée correctement.`
    );
  }
}

async function convertOne(glbName) {
  const glbPath = join(DEMO_DIR, glbName);
  if (!existsSync(glbPath)) {
    console.error(`Fichier manquant : ${glbPath}`);
    console.error("Exécutez d’abord : npm run demo:generate-3d");
    process.exitCode = 1;
    return;
  }

  const engine = new NullEngine();
  const scene = new Scene(engine);
  const data = readFileSync(glbPath);

  await AppendSceneAsync(new Uint8Array(data), scene, {
    pluginExtension: ".glb",
    name: glbName
  });

  // Le homard importé est centré autour de (0,0,0) et trop grand pour AR table:
  // on le recale uniquement pour l'export USDZ afin d'éviter "AR ouvert mais rien visible".
  let boundsBefore = null;
  let boundsAfter = null;
  let targetMaxDimMeters = null;
  let arYawDegrees = null;

  const arConfig = AR_EXPORT_CONFIG[glbName];
  if (arConfig) {
    targetMaxDimMeters = arConfig.targetMaxDimMeters;
    arYawDegrees = arConfig.yawDegrees;
    boundsBefore = getSceneBounds(scene);
    logRootTransforms(`${glbName} transforms avant`, scene);
    forcePositiveScales(scene);
    normalizeSceneForAr(scene, targetMaxDimMeters);
    bakeWorldTransforms(scene);
    if (arYawDegrees !== 0) {
      rotateRenderableMeshesAroundY(scene, (arYawDegrees * Math.PI) / 180);
    }
    if (glbName === "ravioles-chevre-miel.glb") {
      tuneRaviolesArScene(scene);
    }
    ensureMeshNormals(scene);
    boundsAfter = getSceneBounds(scene);
    logRootTransforms(`${glbName} transforms aprÃ¨s`, scene);
  }

  const meshCount = getRenderableMeshes(scene).length;
  if (meshCount === 0) {
    console.warn(
      `Avertissement ${glbName} : aucun mesh exportable après chargement — USDZ peut être vide.`
    );
  }

  const bytes = await USDZExportAsync(scene, {
    includeAnchoringProperties: true,
    modelFileName: "model.usda"
  });

  if (!bytes?.byteLength) {
    console.error(`Échec export USDZ : ${glbName}`);
    process.exitCode = 1;
    scene.dispose();
    engine.dispose();
    return;
  }

  const usdzName = glbName.replace(/\.glb$/i, ".usdz");
  const usdzPath = join(DEMO_DIR, usdzName);
  ensureUsdzContainsGeometry(bytes, usdzName);
  writeFileSync(usdzPath, Buffer.from(bytes));
  const finalSize = statSync(usdzPath).size;
  if (arConfig) {
    logBounds(`${glbName} bounding box avant`, boundsBefore);
    logBounds(`${glbName} bounding box après`, boundsAfter);
    console.log(`${glbName} meshCount=${meshCount}`);
    console.log(`${glbName} targetMaxDimMeters=${targetMaxDimMeters}`);
    console.log(`${glbName} arYawDegrees=${arYawDegrees}`);
    console.log(`${usdzName} taille finale=${(finalSize / 1024 / 1024).toFixed(2)} MB`);
  }
  console.log(
    `OK ${usdzName} (${(bytes.byteLength / 1024).toFixed(1)} KB, ${meshCount} mesh)`
  );

  scene.dispose();
  engine.dispose();
}

async function main() {
  for (const f of FILES) {
    await convertOne(f);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
