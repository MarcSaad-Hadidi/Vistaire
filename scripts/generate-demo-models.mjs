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
  await exportBinaryGlb(raviolesScene(), "ravioles-chevre-miel.glb", 0.21);
  await exportBinaryGlb(homardScene(), "homard-bisque.glb", 0.25);
  await exportBinaryGlb(souffleScene(), "souffle-chocolat.glb", 0.17);
  await exportBinaryGlb(cocktailScene(), "maison-elyse-n1.glb", 0.095);
  console.log("Terminé.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
