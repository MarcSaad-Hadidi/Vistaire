import { readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  NullEngine,
  Scene,
  Vector3,
  VertexBuffer
} from "@babylonjs/core";
import { AppendSceneAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import "@babylonjs/loaders/glTF/index.js";
import * as fflate from "fflate";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMO_DIR = join(__dirname, "..", "public", "models", "demo");
const TARGETS = [
  {
    label: "ravioles",
    glb: "ravioles-chevre-miel.glb",
    usdz: "ravioles-chevre-miel.usdz"
  },
  {
    label: "homard",
    glb: "homard-bisque.glb",
    usdz: "homard-bisque.usdz"
  }
];

const CONTACT_QUANTILE = 0.1;
const MIN_CONTACT_CLEARANCE = -0.014;
const MAX_CONTACT_CLEARANCE = 0.001;

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatVector(v) {
  return v.asArray
    ? v.asArray().map((n) => Number(n.toFixed(5)))
    : v.map((n) => Number(n.toFixed(5)));
}

function formatRotation(v) {
  return formatVector(v).map((n) => Number(n.toFixed(5)));
}

function isPlateMesh(mesh) {
  const name = `${mesh.name} ${mesh.material?.name ?? ""}`.toLowerCase();
  return (
    name.includes("assiette") ||
    name.includes("ceramique") ||
    name.includes("céramique")
  );
}

function isSupportMesh(mesh) {
  return mesh.name.toLowerCase().includes("opaque-plate-surface");
}

function getRenderableMeshes(scene) {
  return scene.meshes.filter((mesh) => mesh.getTotalVertices() > 0);
}

function boundsFor(scene, meshes) {
  const bounds = scene.getWorldExtends((mesh) => meshes.includes(mesh));
  return { min: bounds.min, max: bounds.max, size: bounds.max.subtract(bounds.min) };
}

function logBounds(label, bounds) {
  console.log(
    `${label}: min=${JSON.stringify(formatVector(bounds.min))} max=${JSON.stringify(
      formatVector(bounds.max)
    )} size=${JSON.stringify(formatVector(bounds.size))}`
  );
}

function quantile(sorted, q) {
  return sorted[Math.floor(Math.max(0, Math.min(1, q)) * (sorted.length - 1))];
}

function yQuantile(meshes, q) {
  const ys = [];
  for (const mesh of meshes) {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
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
  return ys.length ? quantile(ys, q) : null;
}

function fitBottomPlane(meshes, q) {
  const cutoff = yQuantile(meshes, q);
  if (cutoff === null) return null;

  let sx = 0;
  let sz = 0;
  let sy = 0;
  let sxx = 0;
  let szz = 0;
  let sxz = 0;
  let sxy = 0;
  let szy = 0;
  let n = 0;

  for (const mesh of meshes) {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) continue;
    const world = mesh.computeWorldMatrix(true);
    for (let i = 0; i < positions.length; i += 3) {
      const p = Vector3.TransformCoordinates(
        new Vector3(positions[i], positions[i + 1], positions[i + 2]),
        world
      );
      if (p.y > cutoff) continue;
      sx += p.x;
      sz += p.z;
      sy += p.y;
      sxx += p.x * p.x;
      szz += p.z * p.z;
      sxz += p.x * p.z;
      sxy += p.x * p.y;
      szy += p.z * p.y;
      n += 1;
    }
  }

  const a = [
    [sxx, sxz, sx],
    [sxz, szz, sz],
    [sx, sz, n]
  ];
  const b = [sxy, szy, sy];
  for (let i = 0; i < 3; i += 1) {
    let max = i;
    for (let r = i + 1; r < 3; r += 1) {
      if (Math.abs(a[r][i]) > Math.abs(a[max][i])) max = r;
    }
    [a[i], a[max]] = [a[max], a[i]];
    [b[i], b[max]] = [b[max], b[i]];
    const pivot = a[i][i] || 1e-12;
    for (let j = i; j < 3; j += 1) a[i][j] /= pivot;
    b[i] /= pivot;
    for (let r = 0; r < 3; r += 1) {
      if (r === i) continue;
      const factor = a[r][i];
      for (let j = i; j < 3; j += 1) a[r][j] -= factor * a[i][j];
      b[r] -= factor * b[i];
    }
  }

  return {
    slopeX: b[0],
    slopeZ: b[1],
    angleZDeg: (Math.atan(b[0]) * 180) / Math.PI,
    angleXDeg: (Math.atan(b[1]) * 180) / Math.PI,
    pointCount: n
  };
}

async function inspectGlb(target) {
  const filePath = join(DEMO_DIR, target.glb);
  const engine = new NullEngine();
  const scene = new Scene(engine);
  await AppendSceneAsync(new Uint8Array(readFileSync(filePath)), scene, {
    pluginExtension: ".glb",
    name: target.glb
  });

  const meshes = getRenderableMeshes(scene);
  const plateMeshes = meshes.filter(isPlateMesh);
  const foodMeshes = meshes.filter((mesh) => !isPlateMesh(mesh) && !isSupportMesh(mesh));
  const supportMeshes = meshes.filter(isSupportMesh);
  const globalBounds = boundsFor(scene, meshes);
  const plateBounds = boundsFor(scene, plateMeshes);
  const foodBounds = boundsFor(scene, foodMeshes);
  const supportBounds = supportMeshes.length ? boundsFor(scene, supportMeshes) : null;
  const plateTopY = plateBounds.max.y;
  const foodMinY = foodBounds.min.y;
  const clearance = foodMinY - plateTopY;
  const foodContactY = yQuantile(foodMeshes, CONTACT_QUANTILE);
  const contactClearance =
    foodContactY === null ? null : foodContactY - plateTopY;
  const plane = fitBottomPlane(foodMeshes, 0.1);

  console.log(`\n${target.label.toUpperCase()} GLB ${target.glb} (${formatSize(statSync(filePath).size)})`);
  console.log(`meshCount=${meshes.length}`);
  console.log(
    `rootTransforms=${JSON.stringify(
      scene.rootNodes.map((node) => {
        const rotation = node.rotationQuaternion
          ? node.rotationQuaternion.toEulerAngles()
          : node.rotation;
        return {
          name: node.name,
          position: formatVector(node.position),
          rotation: formatRotation(rotation),
          scale: formatVector(node.scaling)
        };
      })
    )}`
  );
  logBounds("globalBBox", globalBounds);
  logBounds("plateBBox", plateBounds);
  logBounds("foodBBox", foodBounds);
  if (supportBounds) logBounds("supportBBox", supportBounds);
  console.log(
    `plateTopY=${Number(plateTopY.toFixed(5))} foodMinY=${Number(
      foodMinY.toFixed(5)
    )} foodMinYMinusPlateTop=${Number(clearance.toFixed(5))}`
  );
  console.log(
    `foodContactQuantile=${CONTACT_QUANTILE} foodContactY=${Number(
      (foodContactY ?? foodMinY).toFixed(5)
    )} contactYMinusPlateTop=${Number((contactClearance ?? clearance).toFixed(5))}`
  );
  if (plane) {
    console.log(
      `foodBottomPlane q10: slopeX=${Number(plane.slopeX.toFixed(5))} slopeZ=${Number(
        plane.slopeZ.toFixed(5)
      )} angleZDeg=${Number(plane.angleZDeg.toFixed(3))} angleXDeg=${Number(
        plane.angleXDeg.toFixed(3)
      )} points=${plane.pointCount}`
    );
  }

  for (const mesh of meshes) {
    const rotation = mesh.rotationQuaternion
      ? mesh.rotationQuaternion.toEulerAngles()
      : mesh.rotation;
    const box = mesh.getBoundingInfo().boundingBox;
    console.log(
      `mesh | ${mesh.name} | verts=${mesh.getTotalVertices()} | mat=${
        mesh.material?.name ?? "(none)"
      } | pos=${JSON.stringify(formatVector(mesh.position))} | rot=${JSON.stringify(
        formatRotation(rotation)
      )} | scale=${JSON.stringify(formatVector(mesh.scaling))} | min=${JSON.stringify(
        formatVector(box.minimumWorld)
      )} | max=${JSON.stringify(formatVector(box.maximumWorld))}`
    );
  }

  if (Math.abs(plateBounds.size.y / Math.max(plateBounds.size.x, plateBounds.size.z)) > 0.05) {
    console.warn("WARNING plate may not be horizontal: high Y/span ratio.");
  }
  if (plane && (Math.abs(plane.angleXDeg) > 1 || Math.abs(plane.angleZDeg) > 1)) {
    console.warn("WARNING food bottom plane is tilted more than 1 degree.");
  }
  if (
    contactClearance !== null &&
    contactClearance < MIN_CONTACT_CLEARANCE
  ) {
    console.warn("WARNING visible food contact sits too low in the plate.");
  }
  if (
    contactClearance !== null &&
    contactClearance > MAX_CONTACT_CLEARANCE
  ) {
    console.warn("WARNING visible food contact floats too high above the plate.");
  }

  scene.dispose();
  engine.dispose();
}

function parseUsdPoints(text) {
  const pointsBlock = text.match(/point3f\[\]\s+points\s*=\s*\[([\s\S]*?)\]/);
  if (!pointsBlock) return [];
  return [
    ...pointsBlock[1].matchAll(
      /\((-?\d+(?:\.\d+)?(?:e[-+]?\d+)?),\s*(-?\d+(?:\.\d+)?(?:e[-+]?\d+)?),\s*(-?\d+(?:\.\d+)?(?:e[-+]?\d+)?)\)/gi
    )
  ].map((m) => new Vector3(Number(m[1]), Number(m[2]), Number(m[3])));
}

function inspectUsdz(target) {
  const filePath = join(DEMO_DIR, target.usdz);
  const zip = fflate.unzipSync(readFileSync(filePath));
  const geometryEntries = Object.entries(zip).filter(([name]) =>
    /geometries\/.*\.usda$/i.test(name)
  );

  console.log(`\n${target.label.toUpperCase()} USDZ ${target.usdz} (${formatSize(statSync(filePath).size)})`);
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
    console.log(
      `usdMesh | ${basename(entryName)} | verts=${points.length} | min=${JSON.stringify(
        formatVector(min)
      )} | max=${JSON.stringify(formatVector(max))} | size=${JSON.stringify(
        formatVector(max.subtract(min))
      )}`
    );
  }
}

for (const target of TARGETS) {
  await inspectGlb(target);
  inspectUsdz(target);
}
