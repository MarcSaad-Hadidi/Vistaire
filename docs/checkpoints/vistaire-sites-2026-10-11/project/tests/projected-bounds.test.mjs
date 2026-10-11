import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  projectHullBounds,
  projectObjectBounds,
  unionScreenBounds,
} from "../src/ProjectedBounds.js";

const viewport = { width: 1000, height: 800 };
const camera = new THREE.PerspectiveCamera(
  40,
  viewport.width / viewport.height,
  0.05,
  200,
);
camera.position.set(0, 4, 8);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld(true);

function corners(bounds) {
  const points = [];
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) points.push([x, y, z]);
  return points;
}

function approximately(actual, expected) {
  for (const key of ["x", "y", "width", "height"])
    assert.ok(
      Math.abs(actual[key] - expected[key]) < 0.000001,
      `${key}: ${actual[key]} vs ${expected[key]}`,
    );
}

test("a rotated mesh projects its local corners without the world's empty corners", () => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.3, 1),
    new THREE.MeshBasicMaterial(),
  );
  mesh.rotation.y = Math.PI / 4;
  mesh.updateMatrixWorld(true);
  const actual = projectObjectBounds(mesh, camera, viewport);
  const positions = mesh.geometry.getAttribute("position");
  const vertices = Array.from({ length: positions.count }, (_, i) => [
    positions.getX(i),
    positions.getY(i),
    positions.getZ(i),
  ]);
  const exact = projectHullBounds(vertices, mesh.matrixWorld, camera, viewport);
  approximately(actual, exact);
  const worldBox = new THREE.Box3().setFromObject(mesh);
  const legacy = projectHullBounds(
    corners(worldBox),
    new THREE.Matrix4(),
    camera,
    viewport,
  );
  assert.ok(legacy.width > actual.width + 20);
  assert.ok(legacy.height >= actual.height - 0.000001);
});

test("disjoint roots union their screen bounds without a combined 3D box", () => {
  const root = new THREE.Group();
  const left = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial(),
  );
  const right = left.clone();
  left.position.set(-3, 0, -2);
  right.position.set(3, 0, 2);
  root.add(left, right);
  const separate = unionScreenBounds([
    projectObjectBounds(left, camera, viewport),
    projectObjectBounds(right, camera, viewport),
  ]);
  approximately(projectObjectBounds(root, camera, viewport), separate);
  const legacy = projectHullBounds(
    corners(new THREE.Box3().setFromObject(root)),
    new THREE.Matrix4(),
    camera,
    viewport,
  );
  assert.ok(legacy.x < separate.x - 100);
  assert.ok(legacy.width > separate.width + 100);
});

test("invisible descendant branches and hidden ancestors do not enlarge bounds", () => {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial(),
  );
  const hidden = new THREE.Group();
  hidden.visible = false;
  const distant = mesh.clone();
  distant.position.set(20, 0, 0);
  hidden.add(distant);
  root.add(mesh, hidden);
  approximately(
    projectObjectBounds(root, camera, viewport),
    projectObjectBounds(mesh, camera, viewport),
  );
  assert.equal(projectObjectBounds(distant, camera, viewport), null);
  root.visible = false;
  assert.equal(projectObjectBounds(mesh, camera, viewport), null);
});

test("hulls accept flat typed arrays and nested points with the camera view offset", () => {
  const points = [-1, 0, 0, 1, 0, 0, 0, 1, 0];
  const offsetCamera = camera.clone();
  offsetCamera.zoom = 1.5;
  offsetCamera.setViewOffset(1000, 800, -120, 80, 1000, 800);
  const matrix = new THREE.Matrix4().makeRotationY(0.25);
  const flat = projectHullBounds(
    new Float32Array(points),
    matrix,
    offsetCamera,
    viewport,
  );
  const nested = projectHullBounds(
    [
      [-1, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ],
    matrix,
    offsetCamera,
    viewport,
  );
  approximately(flat, nested);
  const ordinary = projectHullBounds(points, matrix, camera, viewport);
  assert.ok(flat.width > ordinary.width);
  assert.notEqual(flat.x, ordinary.x);
});

test("empty or wholly hidden bounds remain null", () => {
  assert.equal(
    projectHullBounds([], new THREE.Matrix4(), camera, viewport),
    null,
  );
  assert.equal(projectObjectBounds(new THREE.Group(), camera, viewport), null);
  assert.equal(unionScreenBounds([null, undefined]), null);
  assert.equal(
    projectHullBounds([0, 0, 0], new THREE.Matrix4(), camera, {
      width: 0,
      height: 800,
    }),
    null,
  );
});
