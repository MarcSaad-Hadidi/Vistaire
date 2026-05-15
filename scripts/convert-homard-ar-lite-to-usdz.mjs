import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { NullEngine, Scene } from "@babylonjs/core";
import { AppendSceneAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import "@babylonjs/loaders/glTF/index.js";
import { USDZExportAsync } from "@babylonjs/serializers";
import * as fflate from "fflate";

globalThis.fflate = fflate;

if (process.env.ALLOW_LEGACY_AR_LITE_USDZ_CONVERTER !== "1") {
  console.error(
    "This legacy Homard converter can create an oversized iPhone USDZ. Use `npm run demo:build-ios-ultra -- homard-bisque` instead."
  );
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMO_DIR = join(__dirname, "..", "public", "models", "demo");
const SRC = join(DEMO_DIR, "homard-bisque-ar-lite.glb");
const DEST = join(DEMO_DIR, "homard-bisque-ar-lite.usdz");

async function main() {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const data = readFileSync(SRC);

  await AppendSceneAsync(new Uint8Array(data), scene, {
    pluginExtension: ".glb",
    name: "homard-bisque-ar-lite.glb"
  });

  const bytes = await USDZExportAsync(scene, {
    includeAnchoringProperties: true,
    modelFileName: "model.usda"
  });

  writeFileSync(DEST, Buffer.from(bytes));
  console.log(`OK homard-bisque-ar-lite.usdz (${(bytes.byteLength / 1024).toFixed(1)} KB)`);
  scene.dispose();
  engine.dispose();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
