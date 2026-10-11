import test from "node:test";
import assert from "node:assert/strict";
import { Vector3, NoBlending } from "three";
import { pricingFixture } from "./helpers/pricing-hand-fixture.mjs";

test("native hand preserves the HTML screen aperture, redraws on buffer resize and stops when settled", async () => {
  const f = await pricingFixture();
  try {
    assert.equal(f.pricing.render(f.offer, 1, 390, 740), true);
    assert.equal(f.pricing.ready, true);
    assert.deepEqual(f.calls.slice(-4), [
      ["target", null],
      ["scissor", false],
      ["viewport", 0, 0, 390, 740],
      ["viewport", 0, 0, 390, 740],
    ]);
    const { scene, camera } = f.captures.at(-1);
    const hand = scene.children.find(
      (o) => o.geometry?.getAttribute("position")?.count === 8441,
    );
    assert.ok(hand.material.isMeshBasicMaterial);
    assert.ok(
      hand.geometry.getAttribute("position").array.every(Number.isFinite),
    );
    const screenMaterial = scene.getObjectByName("Object_18").material;
    assert.equal(screenMaterial.opacity, 0);
    assert.equal(screenMaterial.transparent, true);
    assert.equal(screenMaterial.blending, NoBlending);
    assert.equal(screenMaterial.depthWrite, true);
    assert.equal(screenMaterial.depthTest, true);
    assert.equal(
      screenMaterial.map,
      null,
      "HTML scrolling needs no texture uploads",
    );
    assert.equal(f.pricing.render(f.offer, 1, 390, 740), false);
    f.renderer.domElement.width = 1170;
    assert.equal(
      f.pricing.render(f.offer, 1, 390, 740),
      true,
      "same CSS size, cleared buffer must repaint",
    );
    assert.equal(
      f.pricing.render(
        { ...f.offer, amount: 2200, monthlyAmount: 300, pilotage: true },
        1,
        390,
        740,
      ),
      true,
    );
    const point = new Vector3()
      .fromBufferAttribute(hand.geometry.getAttribute("position"), 20)
      .project(camera);
    assert.ok(point.toArray().every(Number.isFinite));
    f.pricing.reset();
    assert.equal(
      f.pricing.render(f.offer, 1, 390, 740),
      true,
      "re-entry must redraw an unchanged pose",
    );
  } finally {
    f.close();
  }
});

test("a failed atlas or backdrop-only frame never hides the offer fallback", async () => {
  for (const options of [{ textureFails: true }, { emptyRender: true }]) {
    const f = await pricingFixture(options);
    try {
      assert.equal(f.pricing.render(f.offer, 1, 390, 740), false);
      assert.equal(f.pricing.render(f.offer, 1, 390, 740), false);
    } finally {
      f.close();
    }
  }
});

test("a shader failure keeps the fallback and restores the shared renderer callback", async () => {
  const f = await pricingFixture({ shaderFails: true });
  try {
    assert.throws(() => f.pricing.render(f.offer, 1, 390, 740), /shader/);
    assert.equal(f.renderer.debug.onShaderError, undefined);
    assert.equal(f.pricing.ready, false);
    assert.equal(f.pricing.render(f.offer, 1, 390, 740), false);
  } finally {
    f.close();
  }
});
