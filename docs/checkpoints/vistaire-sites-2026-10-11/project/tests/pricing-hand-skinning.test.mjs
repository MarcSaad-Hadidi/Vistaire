import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Vector3, Quaternion } from "three";
import { pricingFixture } from "./helpers/pricing-hand-fixture.mjs";
import {
  decodeOryzoBuffer,
  sampleOryzoHand,
  deformOryzoHand,
} from "../src/OryzoAnimation.js";

function read(name) {
  const b = fs.readFileSync(
    new URL(`../public/assets/pricing-hand/${name}.buf`, import.meta.url),
  );
  return decodeOryzoBuffer(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
  );
}

test("standard GPU bone matrices retain the exact native quaternion deformation at all 46 poses", async () => {
  const f = await pricingFixture();
  try {
    const mesh = read("hand"),
      track = read("hand_animation");
    const positions = Array.from({ length: 36 }, () => new Vector3());
    const orientations = Array.from({ length: 36 }, () => new Quaternion());
    const expected = new Float32Array(mesh.attributes.position.array.length);
    const vertex = new Vector3();
    let originalAttribute;
    for (let frame = 0; frame < 46; frame++) {
      const ratio = frame / 45;
      f.pricing.render(f.offer, ratio, 390, 740);
      const hand = f.captures
        .at(-1)
        .scene.children.find((o) => o.isSkinnedMesh);
      assert.ok(hand);
      assert.equal(hand.skeleton.bones.length, 36);
      const attribute = hand.geometry.getAttribute("position");
      originalAttribute ??= attribute;
      assert.equal(attribute, originalAttribute);
      assert.deepEqual(
        attribute.array,
        mesh.attributes.position.array,
        "source vertices are not re-uploaded per pose",
      );
      sampleOryzoHand(track, ratio, positions, orientations);
      deformOryzoHand(mesh, positions, orientations, expected);
      for (let i = 0; i < attribute.count; i++) {
        hand.getVertexPosition(i, vertex);
        assert.ok(Math.abs(vertex.x - expected[i * 3]) < 2e-7);
        assert.ok(Math.abs(vertex.y - expected[i * 3 + 1]) < 2e-7);
        assert.ok(Math.abs(vertex.z - expected[i * 3 + 2]) < 2e-7);
      }
    }
  } finally {
    f.close();
  }
});
