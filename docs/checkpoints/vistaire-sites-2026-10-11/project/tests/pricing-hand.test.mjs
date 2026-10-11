import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Box3, Matrix4, Object3D, Vector3, Quaternion } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  decodeOryzoBuffer,
  sampleOryzoHand,
  applyOryzoTrack,
  deformOryzoHand,
} from "../src/OryzoAnimation.js";
import {
  createPricingHandCamera,
  pricingHandProgress,
  placePricingPhone,
} from "../src/PricingHandScene.js";

function read(name) {
  const bytes = fs.readFileSync(
    new URL(`../public/assets/pricing-hand/${name}.buf`, import.meta.url),
  );
  return decodeOryzoBuffer(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
}
const mesh = read("hand"),
  track = read("hand_animation");
const positions = Array.from({ length: 36 }, () => new Vector3());
const orientations = Array.from({ length: 36 }, () => new Quaternion());

test("the reference hand retains all its original topology and 46 poses", () => {
  assert.equal(mesh.metadata.vertexCount, 8441);
  assert.equal(mesh.attributes.indices.array.length / 3, 15422);
  assert.equal(track.attributes.position.count / 36, 46);
  for (let vertex = 0; vertex < mesh.metadata.vertexCount; vertex++) {
    let sum = 0;
    for (let slot = 0; slot < 4; slot++) {
      const index = vertex * 4 + slot;
      assert.ok(mesh.attributes.boneIndices.array[index] < 36);
      sum += mesh.attributes.boneWeights.array[index];
    }
    assert.ok(Math.abs(sum - 1) < 0.001);
  }
});

test("every native pose is finite and reverse scrolling restores the same grip", () => {
  const sourcePositions = track.attributes.position.array.slice();
  const sourceOrientations = track.attributes.orient.array.slice();
  let final;
  for (let frame = 0; frame < 46; frame++) {
    sampleOryzoHand(track, frame / 45, positions, orientations);
    assert.ok(
      positions.every((value) => value.toArray().every(Number.isFinite)),
    );
    assert.ok(
      orientations.every((value) => Math.abs(value.length() - 1) < 0.002),
    );
    if (frame === 45) final = positions.map((value) => value.toArray());
  }
  for (const ratio of [0.4, 0, 0.8, 0.3, 1])
    sampleOryzoHand(track, ratio, positions, orientations);
  assert.deepEqual(
    positions.map((value) => value.toArray()),
    final,
  );
  assert.deepEqual(track.attributes.position.array, sourcePositions);
  assert.deepEqual(track.attributes.orient.array, sourceOrientations);
});

test("short native scroll controls the entry, and reduced motion shows the settled grip", () => {
  for (const height of [420, 530, 690, 730]) {
    const samples = [600, 80, 40, -40, -250, -1000].map((top) =>
      pricingHandProgress(top, height),
    );
    assert.equal(samples[0], 0);
    assert.equal(samples.at(-1), 1);
    assert.ok(samples.every((value, i) => i === 0 || value >= samples[i - 1]));
    assert.equal(pricingHandProgress(600, height, true), 1);
  }
});

test("the original phone screen remains upright and framed throughout all poses on narrow and wide stages", async () => {
  const bytes = fs.readFileSync(
    new URL("../public/assets/phone/iphone_16_-_free.glb", import.meta.url),
  );
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  gltf.scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(gltf.scene),
    size = bounds.getSize(new Vector3()),
    center = bounds.getCenter(new Vector3());
  const phone = new Object3D();
  placePricingPhone(phone);
  phone.updateMatrixWorld(true);
  const nativePhone = phone.matrixWorld
    .clone()
    .multiply(
      new Matrix4().makeScale(2.16 / size.y, 2.16 / size.y, 2.16 / size.y),
    )
    .multiply(new Matrix4().makeTranslation(-center.x, -center.y, -center.z));
  const screen = gltf.scene.getObjectByName("Object_18");
  const vertices = screen.geometry.getAttribute("position"),
    product = new Object3D(),
    productTrack = read("product_animation"),
    cameraTrack = read("hero_camera");
  for (const [width, height] of [
    [1440, 900],
    [390, 740],
    [320, 600],
    [768, 1000],
    [844, 390],
  ]) {
    const camera = createPricingHandCamera(width / height, height);
    for (let frame = 0; frame < 46; frame++) {
      applyOryzoTrack(productTrack, (71 + (frame * 44) / 45) / 115, product);
      product.updateMatrixWorld(true);
      const nativeCamera = new Object3D();
      applyOryzoTrack(
        cameraTrack,
        (71 + (frame * 44) / 45) / 115,
        nativeCamera,
      );
      camera.quaternion.copy(nativeCamera.quaternion);
      camera.updateMatrixWorld(true);
      const matrix = product.matrixWorld
        .clone()
        .multiply(nativePhone)
        .multiply(screen.matrixWorld);
      let minY = Infinity,
        maxY = -Infinity;
      for (let i = 0; i < vertices.count; i++) {
        const point = new Vector3()
          .fromBufferAttribute(vertices, i)
          .applyMatrix4(matrix)
          .project(camera);
        assert.ok(
          Math.abs(point.x) < 0.95 && Math.abs(point.y) < 0.95,
          `screen clipped at ${width}×${height}, frame ${frame}`,
        );
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      }
      assert.ok(
        maxY - minY > 0.85,
        "screen must occupy enough of the stage to read the offer",
      );
      const top = new Vector3(0, 1, 0)
        .transformDirection(matrix)
        .applyQuaternion(camera.quaternion.clone().invert());
      const normal = new Vector3(0, 0, 1).transformDirection(matrix);
      assert.ok(normal.y > 0.8, "screen must face the camera");
      assert.ok(top.y > 0.98, "offer text must stay upright");
    }
  }
});

test("CPU deformation matches the original four-bone quaternion operation", () => {
  const output = new Float32Array(mesh.attributes.position.array.length);
  for (const ratio of [0, 0.2, 0.5, 0.75, 1]) {
    sampleOryzoHand(track, ratio, positions, orientations);
    deformOryzoHand(mesh, positions, orientations, output);
    assert.ok(output.every(Number.isFinite));
    for (let vertex = 0; vertex < mesh.metadata.vertexCount; vertex += 41) {
      const expected = new Vector3();
      for (let slot = 0; slot < 4; slot++) {
        const index = vertex * 4 + slot,
          bone = mesh.attributes.boneIndices.array[index];
        expected.add(
          new Vector3()
            .fromArray(mesh.attributes.position.array, vertex * 3)
            .applyQuaternion(orientations[bone])
            .add(positions[bone])
            .multiplyScalar(mesh.attributes.boneWeights.array[index]),
        );
      }
      assert.ok(
        expected.distanceTo(new Vector3().fromArray(output, vertex * 3)) < 1e-6,
      );
    }
  }
});
