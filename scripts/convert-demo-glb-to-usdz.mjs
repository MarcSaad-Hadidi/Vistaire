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
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { NullEngine, Scene } from "@babylonjs/core";
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

  const meshCount = scene.meshes.filter((m) => m.getTotalVertices() > 0).length;
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
  writeFileSync(usdzPath, Buffer.from(bytes));
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
