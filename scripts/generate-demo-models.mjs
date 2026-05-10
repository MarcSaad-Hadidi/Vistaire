/**
 * Génère les GLB MVP démo Maison Élyse (procédural, léger).
 * Blender indisponible → ce script utilise three.js uniquement en dev (hors bundle Next).
 *
 * Usage: node scripts/generate-demo-models.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import {
  Color3,
  MeshBuilder,
  NullEngine,
  PBRMaterial,
  Scene as BabylonScene,
  Vector3 as BabylonVector3,
  VertexBuffer,
  VertexData
} from "@babylonjs/core";
import { AppendSceneAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import "@babylonjs/loaders/glTF/index.js";
import { GLTF2Export } from "@babylonjs/serializers/glTF/2.0/glTFSerializer.js";

if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class {
    /** @param {Blob} blob */
    readAsArrayBuffer(blob) {
      queueMicrotask(async () => {
        this.result = await blob.arrayBuffer();
        if (typeof this.onloadend === "function") this.onloadend();
      });
    }

    /** @param {Blob} blob */
    readAsDataURL(blob) {
      queueMicrotask(async () => {
        const buf = Buffer.from(await blob.arrayBuffer());
        this.result = `data:application/octet-stream;base64,${buf.toString("base64")}`;
        if (typeof this.onloadend === "function") this.onloadend();
      });
    }
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "models", "demo");

const PLATED_MODEL_FIXES = [
  {
    fileName: "ravioles-chevre-miel.glb",
    foodBottomQuantile: 0.1,
    foodContactQuantile: 0.1,
    targetFoodClearance: -0.012,
    supportDrop: 0.012
  },
  {
    fileName: "homard-bisque.glb",
    foodBottomQuantile: 0.1,
    foodContactQuantile: 0.1,
    targetFoodClearance: -0.012,
    supportDrop: 0.012
  }
];

/** @param {number} hex */
function hexColor(hex) {
  return new THREE.Color(hex);
}

/**
 * @param {THREE.Object3D} root
 * @param {string} fileName
 * @param {number} targetMeters Plus grande dimension du groupe après normalisation (ordre de grandeur assiette / verre, en mètres).
 */
async function exportBinaryGlb(root, fileName, targetMeters) {
  const scene = new THREE.Scene();

  const grouped = new THREE.Group();
  grouped.add(root);
  grouped.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(grouped);
  const center = box.getCenter(new THREE.Vector3());
  grouped.position.sub(center);
  grouped.updateMatrixWorld(true);

  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  grouped.scale.multiplyScalar(targetMeters / maxDim);
  grouped.updateMatrixWorld(true);

  const groundedBox = new THREE.Box3().setFromObject(grouped);
  grouped.position.y -= groundedBox.min.y;
  grouped.updateMatrixWorld(true);

  scene.add(grouped);

  const exporter = new GLTFExporter();
  const buffer = await new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => resolve(result),
      (err) => reject(err),
      { binary: true, truncateDrawRange: true }
    );
  });

  if (!(buffer instanceof ArrayBuffer)) {
    throw new Error(`Export non binaire pour ${fileName}`);
  }

  const dest = path.join(OUT_DIR, fileName);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(buffer));
  const kb = Math.round(buffer.byteLength / 102.4) / 10;
  console.log(`OK ${fileName} (${kb} KB)`);
}

function getRenderableMeshes(scene) {
  return scene.meshes.filter((mesh) => mesh.getTotalVertices() > 0);
}

function isPlateMesh(mesh) {
  const name = `${mesh.name} ${mesh.material?.name ?? ""}`.toLowerCase();
  return (
    name.includes("assiette") ||
    name.includes("opaque-plate-surface") ||
    name.includes("ceramique") ||
    name.includes("céramique")
  );
}

function isDisposablePlateHelper(mesh) {
  return mesh.name.toLowerCase().includes("opaque-plate-surface");
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

function bakeWorldTransforms(scene) {
  for (const mesh of getRenderableMeshes(scene)) {
    const world = mesh.computeWorldMatrix(true).clone();
    mesh.setParent(null);
    mesh.bakeTransformIntoVertices(world);
    mesh.position = BabylonVector3.Zero();
    mesh.rotationQuaternion = null;
    mesh.rotation = BabylonVector3.Zero();
    mesh.scaling = BabylonVector3.One();
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

function getMeshWorldYValues(meshes) {
  const ys = [];
  for (const mesh of meshes) {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) continue;
    const world = mesh.computeWorldMatrix(true);
    for (let i = 0; i < positions.length; i += 3) {
      ys.push(
        BabylonVector3.TransformCoordinates(
          new BabylonVector3(positions[i], positions[i + 1], positions[i + 2]),
          world
        ).y
      );
    }
  }
  ys.sort((a, b) => a - b);
  return ys;
}

function yQuantile(meshes, quantile) {
  const ys = getMeshWorldYValues(meshes);
  if (ys.length === 0) return null;
  return ys[Math.floor(Math.max(0, Math.min(1, quantile)) * (ys.length - 1))];
}

function fitBottomPlane(meshes, quantile) {
  const cutoff = yQuantile(meshes, quantile);
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
      const p = BabylonVector3.TransformCoordinates(
        new BabylonVector3(positions[i], positions[i + 1], positions[i + 2]),
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
    intercept: b[2],
    pointCount: n
  };
}

function rotateFoodToHorizontal(foodMeshes, foodBounds, plane) {
  const pivotX = (foodBounds.min.x + foodBounds.max.x) / 2;
  const pivotZ = (foodBounds.min.z + foodBounds.max.z) / 2;
  const pivotY = plane.slopeX * pivotX + plane.slopeZ * pivotZ + plane.intercept;
  const thetaZ = -plane.slopeX;
  const thetaX = plane.slopeZ;
  const cosZ = Math.cos(thetaZ);
  const sinZ = Math.sin(thetaZ);
  const cosX = Math.cos(thetaX);
  const sinX = Math.sin(thetaX);

  for (const mesh of foodMeshes) {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) continue;
    for (let i = 0; i < positions.length; i += 3) {
      const x0 = positions[i] - pivotX;
      const y0 = positions[i + 1] - pivotY;
      const z0 = positions[i + 2] - pivotZ;
      const x1 = x0 * cosZ - y0 * sinZ;
      const y1 = x0 * sinZ + y0 * cosZ;
      const y2 = y1 * cosX - z0 * sinX;
      const z2 = y1 * sinX + z0 * cosX;
      positions[i] = x1 + pivotX;
      positions[i + 1] = y2 + pivotY;
      positions[i + 2] = z2 + pivotZ;
    }
    mesh.setVerticesData(VertexBuffer.PositionKind, positions);
    mesh.refreshBoundingInfo(true);
  }

  return {
    rotationX: thetaX,
    rotationZ: thetaZ
  };
}

function translateMeshesY(meshes, deltaY) {
  if (Math.abs(deltaY) < 0.000001) return;
  for (const mesh of meshes) {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) continue;
    for (let i = 1; i < positions.length; i += 3) {
      positions[i] += deltaY;
    }
    mesh.setVerticesData(VertexBuffer.PositionKind, positions);
    mesh.refreshBoundingInfo(true);
  }
}

function ensureMeshNormals(meshes) {
  for (const mesh of meshes) {
    if (mesh.getVerticesData(VertexBuffer.NormalKind)) continue;
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    if (!positions || !indices) continue;
    const normals = [];
    VertexData.ComputeNormals(positions, indices, normals);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals);
  }
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

async function correctExistingPlatedModel({
  fileName,
  foodBottomQuantile,
  foodContactQuantile,
  targetFoodClearance,
  supportDrop
}) {
  const modelPath = path.join(OUT_DIR, fileName);
  if (!fs.existsSync(modelPath)) {
    throw new Error(`Modèle source introuvable: ${modelPath}`);
  }

  const engine = new NullEngine();
  const scene = new BabylonScene(engine);
  await AppendSceneAsync(new Uint8Array(fs.readFileSync(modelPath)), scene, {
    pluginExtension: ".glb",
    name: fileName
  });

  for (const mesh of getRenderableMeshes(scene).filter(isDisposablePlateHelper)) {
    mesh.dispose(false, true);
  }
  bakeWorldTransforms(scene);

  const meshes = getRenderableMeshes(scene);
  const plateMeshes = meshes.filter(isPlateMesh);
  const foodMeshes = meshes.filter((mesh) => !isPlateMesh(mesh));
  if (plateMeshes.length === 0 || foodMeshes.length === 0) {
    throw new Error(`Impossible de distinguer assiette/nourriture pour ${fileName}.`);
  }

  const before = boundsFor(scene, meshes);
  const plateBounds = boundsFor(scene, plateMeshes);
  const foodBoundsBefore = boundsFor(scene, foodMeshes);
  let plane = fitBottomPlane(foodMeshes, foodBottomQuantile);
  if (!plane) throw new Error(`Plan de contact introuvable pour ${fileName}.`);

  logBounds(`${fileName} avant`, before);
  logBounds(`${fileName} assiette`, plateBounds);
  logBounds(`${fileName} nourriture avant`, foodBoundsBefore);
  console.log(
    `${fileName} bottomPlane slopeX=${Number(plane.slopeX.toFixed(5))} slopeZ=${Number(
      plane.slopeZ.toFixed(5)
    )} points=${plane.pointCount}`
  );

  const applied = { rotationX: 0, rotationZ: 0 };
  for (let i = 0; i < 4; i += 1) {
    const angleXDeg = Math.abs((Math.atan(plane.slopeZ) * 180) / Math.PI);
    const angleZDeg = Math.abs((Math.atan(plane.slopeX) * 180) / Math.PI);
    if (Math.max(angleXDeg, angleZDeg) <= 0.75) break;
    const iterationBounds = boundsFor(scene, foodMeshes);
    const iterationApplied = rotateFoodToHorizontal(foodMeshes, iterationBounds, plane);
    applied.rotationX += iterationApplied.rotationX;
    applied.rotationZ += iterationApplied.rotationZ;
    plane = fitBottomPlane(foodMeshes, foodBottomQuantile);
    if (!plane) throw new Error(`Plan de contact introuvable pour ${fileName}.`);
  }

  const plateTopY = plateBounds.max.y;
  const contactY = yQuantile(foodMeshes, foodContactQuantile);
  if (contactY === null) {
    throw new Error(`Point de contact nourriture introuvable pour ${fileName}.`);
  }
  const targetFoodContactY = plateTopY + targetFoodClearance;
  const deltaY = targetFoodContactY - contactY;
  translateMeshesY(foodMeshes, deltaY);

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

  const support = MeshBuilder.CreateCylinder(
    `${fileName.replace(/\.glb$/i, "")}-opaque-plate-surface`,
    {
      height: 0.004,
      diameter: Math.max(plateBounds.size.x, plateBounds.size.z) * 0.9,
      tessellation: 128
    },
    scene
  );
  support.position.set(
    (plateBounds.min.x + plateBounds.max.x) / 2,
    plateTopY - supportDrop,
    (plateBounds.min.z + plateBounds.max.z) / 2
  );
  support.material = makeCeramicMaterial(scene);

  ensureMeshNormals(getRenderableMeshes(scene));

  const finalMeshes = getRenderableMeshes(scene);
  const finalBounds = boundsFor(scene, finalMeshes);
  const foodBoundsAfter = boundsFor(scene, finalMeshes.filter((mesh) => !isPlateMesh(mesh)));
  logBounds(`${fileName} nourriture après`, foodBoundsAfter);
  logBounds(`${fileName} après`, finalBounds);
  console.log(
    `${fileName} appliedRotationX=${Number(applied.rotationX.toFixed(5))} appliedRotationZ=${Number(
      applied.rotationZ.toFixed(5)
    )} foodDeltaY=${Number(deltaY.toFixed(5))} foodContactQuantile=${foodContactQuantile} contactYMinusPlateTop=${Number(
      ((contactY + deltaY) - plateTopY).toFixed(5)
    )} foodMinYMinusPlateTop=${Number((foodBoundsAfter.min.y - plateTopY).toFixed(5))}`
  );

  const glb = await GLTF2Export.GLBAsync(scene, fileName, {
    exportWithoutWaitingForScene: true,
    removeNoopRootNodes: false
  });
  const blob = glb.files[fileName] ?? glb.glTFFiles?.[fileName];
  if (!blob || typeof blob === "string") {
    throw new Error(`Export GLB invalide pour ${fileName}.`);
  }

  fs.writeFileSync(modelPath, Buffer.from(await blob.arrayBuffer()));
  console.log(`OK ${fileName} corrigé (${Math.round(fs.statSync(modelPath).size / 102.4) / 10} KB)`);

  scene.dispose();
  engine.dispose();
}

// Conservé comme générateur procédural de référence; les GLB premium actuels sont corrigés plus bas.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function raviolesScene() {
  const g = new THREE.Group();

  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.22, 0.08, 56, 1),
    new THREE.MeshStandardMaterial({
      color: hexColor(0x16161c),
      roughness: 0.35,
      metalness: 0.42
    })
  );
  plate.position.y = 0.04;
  g.add(plate);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1.18, 0.028, 14, 72),
    new THREE.MeshStandardMaterial({
      color: hexColor(0x1e1e28),
      roughness: 0.28,
      metalness: 0.55
    })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.086;
  g.add(rim);

  const sauce = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 44),
    new THREE.MeshStandardMaterial({
      color: hexColor(0xa67b52),
      roughness: 0.45,
      metalness: 0.12,
      side: THREE.DoubleSide
    })
  );
  sauce.rotation.x = -Math.PI / 2;
  sauce.position.y = 0.086;
  g.add(sauce);

  const pastry = new THREE.MeshStandardMaterial({
    color: hexColor(0xe9dcbd),
    roughness: 0.55,
    metalness: 0.02
  });

  const positions = [
    [0, 0.12],
    [0.32, 0.18],
    [-0.29, 0.2],
    [0.22, -0.32],
    [-0.34, -0.18],
    [-0.06, -0.36],
    [0.42, -0.05]
  ];

  for (const [x, z] of positions) {
    const r = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 26, 18),
      pastry
    );
    r.scale.set(1.05, 0.48, 1.02);
    r.position.set(x, 0.16, z);
    g.add(r);
  }

  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.52, 0.2, -0.52),
    new THREE.Vector3(0.08, 0.36, 0.12),
    new THREE.Vector3(0.58, 0.2, 0.45)
  );
  const honey = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 32, 0.028, 10, false),
    new THREE.MeshStandardMaterial({
      color: hexColor(0xc9952d),
      roughness: 0.25,
      metalness: 0.35,
      emissive: new THREE.Color(0x3d2a08),
      emissiveIntensity: 0.15
    })
  );
  g.add(honey);

  const herbMat = new THREE.MeshStandardMaterial({
    color: hexColor(0x2d4a33),
    roughness: 0.75,
    metalness: 0.05
  });
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(0.04, 0.22 + i * 0.02, 6),
      herbMat
    );
    const a = (i / 5) * Math.PI * 1.8 - 0.4;
    leaf.position.set(Math.cos(a) * 0.75, 0.22, Math.sin(a) * 0.75);
    leaf.rotation.z = 0.35 + i * 0.12;
    leaf.rotation.x = Math.random() * 0.3 - 0.15;
    g.add(leaf);
  }

  const butterDots = new THREE.MeshStandardMaterial({
    color: hexColor(0x8f6a45),
    roughness: 0.4,
    metalness: 0.1
  });
  for (let i = 0; i < 12; i++) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.026, 10, 10),
      butterDots
    );
    const rr = 0.55 + Math.random() * 0.35;
    const ang = Math.random() * Math.PI * 2;
    dot.position.set(Math.cos(ang) * rr, 0.1, Math.sin(ang) * rr);
    g.add(dot);
  }

  return g;
}

// Conservé comme générateur procédural de référence; les GLB premium actuels sont corrigés plus bas.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function homardScene() {
  const g = new THREE.Group();

  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(1.45, 1.52, 0.09, 56, 1),
    new THREE.MeshStandardMaterial({
      color: hexColor(0x121015),
      roughness: 0.32,
      metalness: 0.48
    })
  );
  plate.position.y = 0.045;
  g.add(plate);

  const bisque = new THREE.Mesh(
    new THREE.CircleGeometry(1.12, 52),
    new THREE.MeshStandardMaterial({
      color: hexColor(0xc45c28),
      roughness: 0.22,
      metalness: 0.18,
      emissive: new THREE.Color(0x3a1506),
      emissiveIntensity: 0.12,
      side: THREE.DoubleSide
    })
  );
  bisque.rotation.x = -Math.PI / 2;
  bisque.position.y = 0.098;
  g.add(bisque);

  const sauceRing = new THREE.Mesh(
    new THREE.RingGeometry(0.35, 0.95, 48),
    new THREE.MeshStandardMaterial({
      color: hexColor(0xa84820),
      roughness: 0.28,
      metalness: 0.08,
      side: THREE.DoubleSide
    })
  );
  sauceRing.rotation.x = -Math.PI / 2;
  sauceRing.position.y = 0.102;
  g.add(sauceRing);

  const shellOuter = hexColor(0x1a4a72);
  const shellAccent = hexColor(0xb85c38);

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.55, 10, 24),
    new THREE.MeshPhysicalMaterial({
      color: shellOuter,
      roughness: 0.42,
      metalness: 0.22,
      clearcoat: 0.35,
      clearcoatRoughness: 0.4
    })
  );
  body.rotation.z = Math.PI / 2.25;
  body.position.set(0.06, 0.22, -0.12);
  g.add(body);

  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.72, 5),
    new THREE.MeshStandardMaterial({
      color: shellAccent,
      roughness: 0.38,
      metalness: 0.18
    })
  );
  tail.rotation.x = Math.PI / 2.1;
  tail.rotation.z = -0.55;
  tail.position.set(-0.62, 0.2, 0.06);
  g.add(tail);

  const clawA = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.14, 0.38, 16),
    new THREE.MeshStandardMaterial({
      color: shellOuter.clone(),
      roughness: 0.4,
      metalness: 0.28
    })
  );
  clawA.rotation.z = Math.PI / 5;
  clawA.position.set(0.38, 0.15, 0.38);
  g.add(clawA);

  const clawB = clawA.clone();
  clawB.position.set(0.35, 0.16, -0.4);
  clawB.rotation.z = -Math.PI / 8;
  g.add(clawB);

  const fennelStem = new THREE.MeshStandardMaterial({
    color: hexColor(0x9ec4a8),
    roughness: 0.5,
    metalness: 0.04
  });
  for (let i = 0; i < 6; i++) {
    const frond = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.01, 0.55),
      fennelStem
    );
    const t = (i / 6) * Math.PI * 2;
    frond.position.set(Math.cos(t) * 0.48, 0.16, Math.sin(t) * 0.48);
    frond.rotation.y = t + 0.4;
    frond.rotation.x = 0.25;
    g.add(frond);
  }

  const herb = new THREE.MeshStandardMaterial({
    color: hexColor(0x2f5c3a),
    roughness: 0.65,
    metalness: 0.05
  });
  for (let i = 0; i < 8; i++) {
    const sprig = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.02, 0.15 + (i % 3) * 0.04, 6),
      herb
    );
    const u = (i / 8) * Math.PI * 2;
    sprig.position.set(Math.cos(u) * 0.82, 0.12, Math.sin(u) * 0.82);
    sprig.rotation.z = 0.4 + (i % 2) * 0.2;
    g.add(sprig);
  }

  return g;
}

function souffleScene() {
  const g = new THREE.Group();

  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(1.08, 1.02, 0.06, 48, 1),
    new THREE.MeshStandardMaterial({
      color: hexColor(0x12100e),
      roughness: 0.42,
      metalness: 0.35
    })
  );
  plate.position.y = 0.03;
  g.add(plate);

  const ramekin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.48, 0.38, 40, 1, true),
    new THREE.MeshStandardMaterial({
      color: hexColor(0x2a1810),
      roughness: 0.55,
      metalness: 0.08,
      side: THREE.DoubleSide
    })
  );
  ramekin.position.y = 0.28;
  g.add(ramekin);

  const ramekinBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.045, 32),
    new THREE.MeshStandardMaterial({
      color: hexColor(0x231510),
      roughness: 0.5,
      metalness: 0.06
    })
  );
  ramekinBase.position.y = 0.065;
  g.add(ramekinBase);

  const souffle = new THREE.Mesh(
    new THREE.SphereGeometry(0.52, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.58),
    new THREE.MeshStandardMaterial({
      color: hexColor(0x4a2918),
      roughness: 0.82,
      metalness: 0.05,
      emissive: new THREE.Color(0x1a0804),
      emissiveIntensity: 0.06
    })
  );
  souffle.position.y = 0.48;
  g.add(souffle);

  const crack = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.025, 8, 16, Math.PI * 1.1),
    new THREE.MeshStandardMaterial({
      color: hexColor(0x2a160c),
      roughness: 0.9,
      metalness: 0
    })
  );
  crack.rotation.x = Math.PI / 2.3;
  crack.position.set(0.06, 0.88, 0.04);
  g.add(crack);

  const iceCream = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 22, 18),
    new THREE.MeshStandardMaterial({
      color: hexColor(0xf7eed9),
      roughness: 0.72,
      metalness: 0.03
    })
  );
  iceCream.scale.set(1, 0.85, 1);
  iceCream.position.set(0.74, 0.16, 0.06);
  g.add(iceCream);

  const tonkaDust = new THREE.MeshStandardMaterial({
    color: hexColor(0x5c4033),
    roughness: 0.9,
    metalness: 0
  });
  const dust = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 32),
    new THREE.MeshStandardMaterial({
      color: hexColor(0x362218),
      roughness: 0.94,
      metalness: 0,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide
    })
  );
  dust.rotation.x = -Math.PI / 2;
  dust.position.y = 0.062;
  dust.position.z = -0.18;
  g.add(dust);

  for (let i = 0; i < 40; i++) {
    const c = new THREE.Mesh(
      new THREE.SphereGeometry(0.015 + Math.random() * 0.01, 6, 6),
      tonkaDust
    );
    c.position.set(
      0.5 + Math.random() * 0.5,
      0.075 + Math.random() * 0.05,
      -0.5 + Math.random() * 0.7
    );
    g.add(c);
  }

  const cocoaParticles = new THREE.MeshStandardMaterial({
    color: hexColor(0x2a1610),
    roughness: 0.92,
    metalness: 0
  });
  for (let i = 0; i < 25; i++) {
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 8, 8),
      cocoaParticles
    );
    const ang = (i / 25) * Math.PI * 2;
    p.position.set(Math.cos(ang) * (0.15 + Math.random() * 0.2), 0.78 + Math.random() * 0.12, Math.sin(ang) * (0.15 + Math.random() * 0.18));
    g.add(p);
  }

  return g;
}

function cocktailScene() {
  const g = new THREE.Group();

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: hexColor(0xffffff),
    metalness: 0,
    roughness: 0.08,
    transmission: 0.92,
    thickness: 0.35,
    transparent: true,
    opacity: 1,
    ior: 1.52
  });

  /** @type {THREE.Vector2[]} */
  const profile = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.24, 0.02),
    new THREE.Vector2(0.55, 0.08),
    new THREE.Vector2(0.58, 0.18),
    new THREE.Vector2(0.45, 0.32),
    new THREE.Vector2(0.2, 0.38),
    new THREE.Vector2(0.12, 0.41)
  ];
  const bowl = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 48),
    glassMat
  );
  bowl.position.y = 0.55;
  g.add(bowl);

  const liquidProfile = profile.map(
    (p) => new THREE.Vector2(p.x * 0.88, p.y * 0.82 + 0.04)
  );
  const liquid = new THREE.Mesh(
    new THREE.LatheGeometry(liquidProfile, 40),
    new THREE.MeshStandardMaterial({
      color: hexColor(0xe8b8bc),
      roughness: 0.18,
      metalness: 0.02,
      emissive: new THREE.Color(0x3a2024),
      emissiveIntensity: 0.08,
      transparent: true,
      opacity: 0.92
    })
  );
  liquid.position.y = 0.57;
  g.add(liquid);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 0.42, 20),
    glassMat
  );
  stem.position.y = 0.28;
  g.add(stem);

  const foot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.45, 0.05, 36),
    glassMat
  );
  foot.position.y = 0.05;
  g.add(foot);

  const garnish = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshStandardMaterial({
      color: hexColor(0xd98ba0),
      roughness: 0.45,
      metalness: 0.12
    })
  );
  garnish.position.set(0.36, 0.98, 0.04);
  garnish.scale.set(1, 0.6, 1);
  garnish.rotation.z = 0.5;
  g.add(garnish);

  const leaf = new THREE.Mesh(
    new THREE.CircleGeometry(0.12, 12),
    new THREE.MeshStandardMaterial({
      color: hexColor(0x6a9b6e),
      roughness: 0.55,
      metalness: 0.05,
      side: THREE.DoubleSide
    })
  );
  leaf.position.set(-0.25, 0.96, 0.08);
  leaf.rotation.set(0.6, 0.2, 0.4);
  g.add(leaf);

  const bubbleMat = new THREE.MeshStandardMaterial({
    color: hexColor(0xfff5f6),
    roughness: 0.08,
    metalness: 0.15,
    transparent: true,
    opacity: 0.42
  });
  const bubblePts = [
    [0.1, 0.72, 0.15],
    [-0.12, 0.78, 0.06],
    [0.04, 0.85, -0.1],
    [0.22, 0.8, -0.04],
    [-0.2, 0.74, -0.12]
  ];
  for (const [x, y, z] of bubblePts) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 10), bubbleMat);
    b.position.set(x, y, z);
    g.add(b);
  }

  return g;
}

async function main() {
  console.log(`Export GLB vers ${OUT_DIR}`);
  /* Plus petite cible métrique (~25–28 cm max dim assiettes, dessert/verre plus compacts). */
  for (const model of PLATED_MODEL_FIXES) {
    await correctExistingPlatedModel(model);
  }
  await exportBinaryGlb(souffleScene(), "souffle-chocolat.glb", 0.17);
  await exportBinaryGlb(cocktailScene(), "maison-elyse-n1.glb", 0.095);
  console.log("Terminé.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
