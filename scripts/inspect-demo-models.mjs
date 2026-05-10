import { readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { NullEngine, Scene, Vector3 } from "@babylonjs/core";
import { AppendSceneAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import "@babylonjs/loaders/glTF/index.js";
import * as fflate from "fflate";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMO_DIR = join(__dirname, "..", "public", "models", "demo");
const FILES = [
  "ravioles-chevre-miel.glb",
  "ravioles-chevre-miel.usdz",
  "homard-bisque.glb",
  "homard-bisque.usdz",
  "souffle-chocolat.glb",
  "souffle-chocolat.usdz",
  "maison-elyse-n1.glb",
  "maison-elyse-n1.usdz"
];

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatVector(v) {
  return v.asArray
    ? v.asArray().map((n) => Number(n.toFixed(5)))
    : v.map((n) => Number(n.toFixed(5)));
}

function classifyFlatDisk({ name, min, max, material = "" }) {
  const size = max.subtract(min);
  const wide = Math.max(size.x, size.z);
  const flat = size.y <= Math.max(0.008, wide * 0.04);
  const large = wide >= 0.12;
  const pale =
    /white|grey|gray|ceramic|c[eé]ramique|plate|surface|disk|floor|assiette/i.test(
      `${name} ${material}`
    );
  return flat && large && pale;
}

function printMesh({ name, vertices, min, max, material }) {
  const size = max.subtract(min);
  const suspect = classifyFlatDisk({ name, min, max, material });
  console.log(
    [
      suspect ? "SUSPECT" : "mesh",
      name,
      `verts=${vertices}`,
      `mat=${material || "(none)"}`,
      `min=${JSON.stringify(formatVector(min))}`,
      `max=${JSON.stringify(formatVector(max))}`,
      `size=${JSON.stringify(formatVector(size))}`
    ].join(" | ")
  );
}

async function inspectGlb(fileName) {
  const filePath = join(DEMO_DIR, fileName);
  const engine = new NullEngine();
  const scene = new Scene(engine);
  await AppendSceneAsync(new Uint8Array(readFileSync(filePath)), scene, {
    pluginExtension: ".glb",
    name: fileName
  });

  const meshes = scene.meshes.filter((m) => m.getTotalVertices() > 0);
  console.log(`\n${fileName} (${formatSize(statSync(filePath).size)})`);
  console.log(`meshCount=${meshes.length}`);

  if (meshes.length > 0) {
    const bounds = scene.getWorldExtends((mesh) => meshes.includes(mesh));
    console.log(
      `global min=${JSON.stringify(formatVector(bounds.min))} max=${JSON.stringify(
        formatVector(bounds.max)
      )} size=${JSON.stringify(formatVector(bounds.max.subtract(bounds.min)))}`
    );
  }

  for (const mesh of meshes) {
    const box = mesh.getBoundingInfo().boundingBox;
    printMesh({
      name: mesh.name,
      vertices: mesh.getTotalVertices(),
      min: box.minimumWorld,
      max: box.maximumWorld,
      material: mesh.material?.name ?? ""
    });
  }

  scene.dispose();
  engine.dispose();
}

function parseUsdPoints(text) {
  const pointsBlock = text.match(/point3f\[\]\s+points\s*=\s*\[([\s\S]*?)\]/);
  if (!pointsBlock) return [];
  return [...pointsBlock[1].matchAll(/\((-?\d+(?:\.\d+)?(?:e[-+]?\d+)?),\s*(-?\d+(?:\.\d+)?(?:e[-+]?\d+)?),\s*(-?\d+(?:\.\d+)?(?:e[-+]?\d+)?)\)/gi)].map(
    (m) => new Vector3(Number(m[1]), Number(m[2]), Number(m[3]))
  );
}

function inspectUsdz(fileName) {
  const filePath = join(DEMO_DIR, fileName);
  const zip = fflate.unzipSync(readFileSync(filePath));
  const geometryEntries = Object.entries(zip).filter(([name]) =>
    /geometries\/.*\.usda$/i.test(name)
  );

  console.log(`\n${fileName} (${formatSize(statSync(filePath).size)})`);
  console.log(`usdGeometryCount=${geometryEntries.length}`);

  for (const [entryName, bytes] of geometryEntries) {
    const text = Buffer.from(bytes).toString("utf8");
    const points = parseUsdPoints(text);
    const min = new Vector3(Infinity, Infinity, Infinity);
    const max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const point of points) {
      min.minimizeInPlace(point);
      max.maximizeInPlace(point);
    }
    printMesh({
      name: basename(entryName),
      vertices: points.length,
      min,
      max,
      material: text.match(/rel material:binding = <([^>]+)>/)?.[1] ?? ""
    });
  }
}

for (const fileName of FILES) {
  if (fileName.endsWith(".glb")) {
    await inspectGlb(fileName);
  } else {
    inspectUsdz(fileName);
  }
}
