import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Box3, Vector3 } from "three";
import { pricingFixture } from "./helpers/pricing-hand-fixture.mjs";
import { FAIR_HAND_ASSET } from "../src/PricingFairHand.js";
import { pricingExitOffset } from "../src/PricingPhonePresenter.js";

test("the wrist texture dimensions match the shader's source-pixel mask", () => {
  const png = fs.readFileSync(
    new URL(`../public${FAIR_HAND_ASSET.src}`, import.meta.url),
  );
  assert.equal(png.readUInt32BE(16), FAIR_HAND_ASSET.width);
  assert.equal(png.readUInt32BE(20), FAIR_HAND_ASSET.height);
});

test("preloading the fair hand before the phone model arrives remains recoverable", async () => {
  const f = await pricingFixture({ grip: "fair", delayPhone: true });
  try {
    assert.equal(f.pricing.render(f.offer, 1, 390, 740), false);
    assert.equal(f.pricing.unavailable, false);
    f.providePhone();
    assert.equal(f.pricing.render(f.offer, 1, 390, 740), true);
    assert.equal(f.pricing.ready, true);
  } finally {
    f.close();
  }
});

test("the fair grip and native case share the same frame over entry, exit and reverse", async () => {
  const f = await pricingFixture({ grip: "fair", background: true });
  try {
    for (const [width, height] of [
      [390, 740],
      [320, 600],
      [1440, 900],
      [844, 390],
    ]) {
      for (const ratio of [0, 0.25, 0.5, 0.75, 1, 0.75, 0.25, 0]) {
        f.pricing.render(f.offer, ratio, width, height);
        const { scene } = f.captures.at(-1);
        const hand = scene.getObjectByName("VistaireFairHand");
        const phone = hand.parent.children.find((o) => o !== hand);
        assert.equal(phone.parent, hand.parent);
        const bounds = new Box3().setFromObject(phone.clone(true));
        const position = hand.geometry.attributes.position;
        const tl = new Vector3().fromBufferAttribute(position, 0);
        const tr = new Vector3().fromBufferAttribute(position, 1);
        const bl = new Vector3().fromBufferAttribute(position, 2);
        const { phone: frame, width: aw, height: ah } = FAIR_HAND_ASSET;
        const corner = (x, y) =>
          tl
            .clone()
            .addScaledVector(tr.clone().sub(tl), x / aw)
            .addScaledVector(bl.clone().sub(tl), y / ah);
        const topLeft = corner(frame.left, frame.top);
        const bottomRight = corner(frame.right, frame.bottom);
        assert.ok(Math.abs(topLeft.x - bounds.max.x) < 2e-8);
        assert.ok(Math.abs(topLeft.z - bounds.max.z) < 2e-8);
        assert.ok(Math.abs(bottomRight.x - bounds.min.x) < 2e-8);
        assert.ok(Math.abs(bottomRight.z - bounds.min.z) < 2e-8);
        assert.ok(topLeft.y < bounds.min.y, "fingers stay behind the phone");
        const p = f.pricing.screenProjection(width, height);
        assert.ok(p.matrix.every(Number.isFinite));
      }
    }
  } finally {
    f.close();
  }
});

test("the new grip leaves the whole reading surface and last button usable", async () => {
  const f = await pricingFixture({ grip: "fair", background: true });
  try {
    for (const top of [0, -60, -220, 0]) {
      f.pricing.render(f.offer, 1, 390, 740, { top, canvasHeight: 850 });
      const p = f.pricing.screenProjection(390, 740);
      const [a, b, c, d, x, y] = p.matrix;
      for (const sx of [0.1, 0.5, 0.9])
        for (const sy of [0.2, 0.5, 0.9]) {
          assert.equal(
            f.pricing.screenIsVisible(
              a * sx * p.width + c * sy * p.height + x,
              b * sx * p.width + d * sy * p.height + y,
              390,
              740,
            ),
            true,
          );
        }
      assert.equal(f.pricing.screenIsVisible(-100, 300, 390, 740), false);
    }
    const captures = f.captures.length;
    const projection = f.pricing.screenProjection(390, 740);
    for (let i = 0; i < 500; i++) {
      assert.equal(
        f.pricing.render(f.offer, 1, 390, 740, { top: 0, canvasHeight: 850 }),
        false,
      );
      assert.equal(f.pricing.screenProjection(390, 740), projection);
    }
    assert.equal(
      f.captures.length,
      captures,
      "reading never redraws a held photographic grip",
    );
    f.pricing.reset();
    assert.equal(
      f.pricing.render(f.offer, 1, 390, 740, { top: 0, canvasHeight: 850 }),
      true,
    );
  } finally {
    f.close();
  }
});

test("generated bezel is masked, and a failed new hand still permits the HTML fallback", async () => {
  const f = await pricingFixture({ grip: "fair" });
  try {
    f.pricing.render(f.offer, 1, 390, 740);
    const hand = f.captures.at(-1).scene.getObjectByName("VistaireFairHand");
    const shader = { uniforms: {}, fragmentShader: "#include <map_fragment>" };
    hand.material.onBeforeCompile(shader);
    assert.ok(shader.fragmentShader.includes("discard"));
    const mask = shader.uniforms.handPhoneMask.value;
    assert.ok(mask.x > 0 && mask.z < 1 && mask.x < mask.z);
    assert.ok(mask.y > 0 && mask.w < 1 && mask.y < mask.w);
    const radius = shader.uniforms.handPhoneRadius.value;
    assert.equal(radius, 80);
    assert.ok(shader.fragmentShader.includes("length(max(corner, vec2(0.)))"));
    // This opaque palm pixel, visible in IMG_7585, lies inside the old square
    // mask but outside the bottom-left quarter-circle of the phone outline.
    const left = mask.x * FAIR_HAND_ASSET.width;
    const bottom = (1 - mask.y) * FAIR_HAND_ASSET.height;
    assert.ok(330 > left && 1090 < bottom);
    assert.ok(Math.hypot(330 - left - radius, 1090 - bottom + radius) > radius);
    assert.equal(hand.material.map.colorSpace, "srgb");
    assert.ok(hand.material.transparent && hand.material.alphaTest > 0);
  } finally {
    f.close();
  }
  const broken = await pricingFixture({ grip: "fair", textureFails: true });
  try {
    assert.equal(broken.pricing.ready, false);
    assert.equal(broken.pricing.render(broken.offer, 1, 390, 740), false);
  } finally {
    broken.close();
  }
});

test("fair entry has stable size, soft endpoints and identical native/HTML poses on resize and reverse", async () => {
  const f = await pricingFixture({ grip: "fair" });
  try {
    for (const [width, height] of [
      [390, 740],
      [320, 600],
      [1440, 900],
      [844, 390],
    ]) {
      const samples = new Map();
      for (const ratio of [
        0, 0.01, 0.25, 0.5, 0.75, 0.99, 1, 0.99, 0.75, 0.5, 0.25, 0.01, 0,
      ]) {
        f.pricing.render(f.offer, ratio, width, height);
        const p = f.pricing.screenProjection(width, height);
        if (samples.has(ratio))
          assert.deepEqual(p.matrix, samples.get(ratio).matrix);
        else samples.set(ratio, p);
        const { scene, camera } = f.captures.at(-1);
        const screen = scene.getObjectByName("Object_18");
        const box = screen.geometry.boundingBox;
        const center = box
          .getCenter(new Vector3())
          .applyMatrix4(screen.matrixWorld)
          .project(camera);
        const [a, b, c, d, x, y] = p.matrix;
        assert.ok(
          Math.abs(
            a * p.width * 0.5 +
              c * p.height * 0.5 +
              x -
              (center.x + 1) * width * 0.5,
          ) < 0.01,
        );
        assert.ok(
          Math.abs(
            b * p.width * 0.5 +
              d * p.height * 0.5 +
              y -
              (1 - center.y) * height * 0.5,
          ) < 0.01,
        );
        assert.ok(
          Math.abs(p.scale - samples.get(0).scale) < 1e-8,
          "no scale-driven layout work during entry",
        );
      }
      const top = (ratio) => samples.get(ratio).matrix[5];
      assert.ok(top(0) > height, "phone starts just below the viewport");
      assert.ok(top(0) - top(1) < height * 0.9, "entry avoids a long fly-in");
      for (const [a, b] of [
        [0, 0.01],
        [0.01, 0.25],
        [0.25, 0.5],
        [0.5, 0.75],
        [0.75, 0.99],
        [0.99, 1],
      ])
        assert.ok(top(a) > top(b));
      assert.ok(top(0) - top(0.01) < height * 0.0001, "entry starts at rest");
      assert.ok(
        top(0.99) - top(1) < height * 0.0001,
        "entry settles without a hard stop",
      );
      const final = samples.get(1);
      assert.ok(top(1) > 0 && top(1) + final.matrix[3] * final.height < height);
      assert.ok(
        top(1) + pricingExitOffset(-height, height) > height,
        "phone leaves fully as FAQ takes over",
      );
    }
  } finally {
    f.close();
  }
});

test("FAQ exit begins at rest, stays reversible and approaches native speed without overshoot", () => {
  for (const height of [390, 600, 740, 900]) {
    assert.equal(pricingExitOffset(20, height), 0);
    assert.equal(pricingExitOffset(0, height), 0);
    assert.ok(pricingExitOffset(-height * 0.0001, height) < height * 1e-8);
    let previous = 0;
    for (let i = 1; i <= 100; i++) {
      const distance = (height * i) / 100;
      const next = pricingExitOffset(-distance, height);
      assert.ok(next > previous && next < distance);
      assert.ok(next - previous < height / 100);
      previous = next;
    }
    assert.ok(previous > height * 0.9);
  }
});
