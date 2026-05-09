/**
 * Normalise le modèle homard importé (centrage, taille réaliste, base au sol),
 * puis réécrit public/models/demo/homard-bisque.glb.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { NullEngine, Scene, TransformNode, Vector3 } from "@babylonjs/core";
import { AppendSceneAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import "@babylonjs/loaders/glTF/index.js";
import { GLTF2Export } from "@babylonjs/serializers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODEL_PATH = join(__dirname, "..", "public", "models", "demo", "homard-bisque.glb");
const BACKUP_PATH = join(
  __dirname,
  "..",
  "public",
  "models",
  "demo",
  "homard-bisque.raw-backup.glb"
);
const TARGET_MAX_DIM_METERS = 0.25;

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

async function main() {
  if (!existsSync(MODEL_PATH)) {
    throw new Error(`Fichier introuvable: ${MODEL_PATH}`);
  }

  copyFileSync(MODEL_PATH, BACKUP_PATH);
  console.log(`Backup créé: ${BACKUP_PATH}`);

  const engine = new NullEngine();
  const scene = new Scene(engine);
  const data = readFileSync(MODEL_PATH);

  await AppendSceneAsync(new Uint8Array(data), scene, {
    pluginExtension: ".glb",
    name: "homard-bisque.glb"
  });
  forcePositiveScales(scene);

  const root = new TransformNode("homard-normalize-root", scene);

  for (const node of scene.rootNodes) {
    if (node === root) continue;
    // Grouper toutes les racines importées sous un seul parent pour manipuler le modèle uniformément.
    node.setParent(root);
  }

  let { min, max } = root.getHierarchyBoundingVectors(true);
  const center = min.add(max).scale(0.5);
  root.position.subtractInPlace(center);

  ({ min, max } = root.getHierarchyBoundingVectors(true));
  const size = max.subtract(min);
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scaleFactor = TARGET_MAX_DIM_METERS / maxDim;
  root.scaling = root.scaling.multiplyByFloats(scaleFactor, scaleFactor, scaleFactor);

  ({ min } = root.getHierarchyBoundingVectors(true));
  root.position.subtractInPlace(new Vector3(0, min.y, 0));

  const glb = await GLTF2Export.GLBAsync(scene, "homard-bisque");
  const glbBuffer = Buffer.from(await glb.glTFFiles["homard-bisque.glb"].arrayBuffer());
  writeFileSync(MODEL_PATH, glbBuffer);

  const finalBounds = root.getHierarchyBoundingVectors(true);
  const finalSize = finalBounds.max.subtract(finalBounds.min);
  console.log(
    `OK homard-bisque.glb normalisé (maxDim=${Math.max(finalSize.x, finalSize.y, finalSize.z).toFixed(3)}m, bytes=${glbBuffer.byteLength})`
  );

  scene.dispose();
  engine.dispose();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
