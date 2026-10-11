import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { cameraDollyPose } from "../src/CameraDolly.js";

test("camera approach changes perspective depth while model dimensions stay fixed", () => {
  const look = [0, 0.5, 0];
  const base = [0, 4.5, 8];
  const a = cameraDollyPose(base, look, 1);
  const b = cameraDollyPose(base, look, 3);
  assert.deepEqual(a.camera, base);
  assert.ok(Math.abs(b.distance * 3 - a.distance) < 1e-10);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 150);
  const lens = camera.projectionMatrix.elements.slice();
  const plate = new THREE.BoxGeometry(2, 0.1, 2);
  plate.computeBoundingBox();
  const size = plate.boundingBox.getSize(new THREE.Vector3()).toArray();
  const widths = (pose) => {
    camera.position.fromArray(pose.camera);
    camera.lookAt(...look);
    camera.updateMatrixWorld(true);
    return [0.8, -0.8].map((z) =>
      Math.abs(
        new THREE.Vector3(1, 0.5, z).project(camera).x -
          new THREE.Vector3(-1, 0.5, z).project(camera).x,
      ),
    );
  };
  const before = widths(a),
    after = widths(b);
  assert.ok(after[0] / after[1] > before[0] / before[1]);
  assert.equal(camera.zoom, 1);
  assert.equal(camera.fov, 40);
  assert.deepEqual(camera.projectionMatrix.elements, lens);
  assert.deepEqual(
    plate.boundingBox.getSize(new THREE.Vector3()).toArray(),
    size,
  );
  plate.dispose();
});

test("camera approach preserves its ray and stays outside the near-plane safety limit", () => {
  const pose = cameraDollyPose([3, 5, 6], [1, 1, 2], 4, 2.5);
  assert.equal(pose.distance, 2.5);
  const before = new THREE.Vector3(2, 4, 4).normalize();
  const after = new THREE.Vector3()
    .fromArray(pose.camera)
    .sub(new THREE.Vector3().fromArray(pose.look))
    .normalize();
  assert.ok(before.distanceTo(after) < 1e-12);
  assert.deepEqual(
    cameraDollyPose([0, 0, 6], [0, 0, 0], 0.6).camera,
    [0, 0, 10],
  );
});
