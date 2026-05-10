import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Color3,
  Matrix,
  MeshBuilder,
  NullEngine,
  PBRMaterial,
  Scene,
  Vector3
} from "@babylonjs/core";
import { AppendSceneAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import "@babylonjs/loaders/glTF/index.js";
import { GLTF2Export } from "@babylonjs/serializers/glTF/2.0/glTFSerializer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMO_DIR = join(__dirname, "..", "public", "models", "demo");

const MODELS = [
  { fileName: "homard-bisque.glb", contactQuantile: 0.2, targetFoodContactOffset: 0.02 },
  { fileName: "souffle-chocolat.glb", contactQuantile: 0.2, targetFoodContactOffset: -0.01 }
];

function renderableMeshes(scene) {
  return scene.meshes.filter((mesh) => mesh.getTotalVertices() > 0);
}

function isPlateMesh(mesh) {
  const name = `${mesh.name} ${mesh.material?.name ?? ""}`.toLowerCase();
  return (
    name.includes("assiette") ||
    name.includes("rebord") ||
    name.includes("ceramique") ||
    name.includes("céramique")
  );
}

function isDisposablePlateHelper(mesh) {
  const name = mesh.name.toLowerCase();
  return name.includes("rebord") || name.includes("opaque-plate-surface");
}

function boundsFor(scene, meshes) {
  const bounds = scene.getWorldExtends((mesh) => meshes.includes(mesh));
  return { min: bounds.min, max: bounds.max, size: bounds.max.subtract(bounds.min) };
}

function formatVector(v) {
  return v.asArray().map((n) => Number(n.toFixed(5)));
}

function logBounds(label, bounds) {
  console.log(
    `${label}: min=${JSON.stringify(formatVector(bounds.min))} max=${JSON.stringify(
      formatVector(bounds.max)
    )} size=${JSON.stringify(formatVector(bounds.size))}`
  );
}

function bakeTranslate(meshes, y) {
  if (Math.abs(y) < 0.00001) return;
  const translation = Matrix.Translation(0, y, 0);
  for (const mesh of meshes) {
    mesh.bakeTransformIntoVertices(translation);
    mesh.refreshBoundingInfo(true);
  }
}

function meshYQuantile(meshes, quantile) {
  const ys = [];
  for (const mesh of meshes) {
    const positions = mesh.getVerticesData("position");
    if (!positions) continue;
    const world = mesh.computeWorldMatrix(true);
    for (let i = 0; i < positions.length; i += 3) {
      ys.push(
        Vector3.TransformCoordinates(
          new Vector3(positions[i], positions[i + 1], positions[i + 2]),
          world
        ).y
      );
    }
  }
  ys.sort((a, b) => a - b);
  if (ys.length === 0) return null;
  const clamped = Math.max(0, Math.min(1, quantile));
  return ys[Math.floor(clamped * (ys.length - 1))];
}

function makeCeramicMaterial(scene) {
  const material = new PBRMaterial("opaque-plate-surface", scene);
  material.albedoColor = new Color3(0.96, 0.92, 0.84);
  material.metallic = 0;
  material.roughness = 0.58;
  material.alpha = 1;
  material.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE;
  material.backFaceCulling = false;
  return material;
}

async function fixOne({ fileName, contactQuantile, targetFoodContactOffset }) {
  const modelPath = join(DEMO_DIR, fileName);
  const engine = new NullEngine();
  const scene = new Scene(engine);

  await AppendSceneAsync(new Uint8Array(readFileSync(modelPath)), scene, {
    pluginExtension: ".glb",
    name: fileName
  });

  const disposableMeshes = renderableMeshes(scene).filter(isDisposablePlateHelper);
  for (const mesh of disposableMeshes) {
    mesh.dispose(false, true);
  }

  const meshes = renderableMeshes(scene);
  const plateMeshes = meshes.filter(isPlateMesh);
  const foodMeshes = meshes.filter((mesh) => !isPlateMesh(mesh));
  if (plateMeshes.length === 0 || foodMeshes.length === 0) {
    throw new Error(`Impossible de distinguer assiette/nourriture pour ${fileName}.`);
  }

  const before = boundsFor(scene, renderableMeshes(scene));
  const plateBounds = boundsFor(scene, plateMeshes);
  logBounds(`${fileName} avant`, before);

  for (const material of scene.materials) {
    const name = material.name.toLowerCase();
    if (!name.includes("ceramique") && !name.includes("céramique")) continue;
    material.alpha = 1;
    material.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE;
    material.albedoColor = new Color3(0.96, 0.92, 0.84);
    material.metallic = 0;
    material.roughness = 0.58;
    material.backFaceCulling = false;
  }

  const foodContactY = meshYQuantile(foodMeshes, contactQuantile);
  if (foodContactY !== null) {
    const targetFoodContactY = plateBounds.max.y + targetFoodContactOffset;
    const deltaY = targetFoodContactY - foodContactY;
    bakeTranslate(foodMeshes, deltaY);
    console.log(`${fileName} foodDeltaY=${Number(deltaY.toFixed(5))}`);
  }

  const support = MeshBuilder.CreateCylinder(
    `${fileName.replace(/\.glb$/i, "")}-opaque-plate-surface`,
    {
      height: 0.006,
      diameter: Math.max(plateBounds.size.x, plateBounds.size.z) * 0.9,
      tessellation: 128
    },
    scene
  );
  support.position.set(
    (plateBounds.min.x + plateBounds.max.x) / 2,
    plateBounds.max.y - 0.012,
    (plateBounds.min.z + plateBounds.max.z) / 2
  );
  support.material = makeCeramicMaterial(scene);

  const after = boundsFor(scene, renderableMeshes(scene));
  logBounds(`${fileName} apres`, after);
  console.log(`${fileName} meshesSupprimes=${disposableMeshes.length}`);

  const glb = await GLTF2Export.GLBAsync(scene, fileName, {
    exportWithoutWaitingForScene: true,
    removeNoopRootNodes: false
  });
  const blob = glb.files[fileName];
  if (!blob || typeof blob === "string") {
    throw new Error(`Export GLB invalide pour ${fileName}.`);
  }

  writeFileSync(modelPath, Buffer.from(await blob.arrayBuffer()));
  console.log(`OK ${modelPath}`);

  scene.dispose();
  engine.dispose();
}

for (const model of MODELS) {
  await fixOne(model);
}
