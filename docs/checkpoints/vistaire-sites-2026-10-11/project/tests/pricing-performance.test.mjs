import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  createPricingPhonePresenter,
  pricingStageAtScroll,
  pricingExitOffset,
} from "../src/PricingPhonePresenter.js";
import { pricingScrollLayout } from "../src/PricingPhoneLayout.js";
import { createPricingRoomBackdrop } from "../src/PricingRoomBackdrop.js";
import { pricingFixture } from "./helpers/pricing-hand-fixture.mjs";

test("pricing does no layout reads or writes during hundreds of offscreen landing scroll samples", () => {
  const writes = [];
  const screen = {
    style: {
      get transform() {
        throw Error("CSSOM read can serialize differently and repeat writes");
      },
      set transform(value) {
        writes.push(["transform", value]);
      },
    },
  };
  const viewport = {
    get scrollTop() {
      throw Error("scrollTop read can force layout after cinematic writes");
    },
    set scrollTop(value) {
      writes.push(["scroll", value]);
    },
  };
  const presenter = createPricingPhonePresenter(screen, viewport);
  const layout = pricingScrollLayout(740, 800, 530, 0.81);
  for (let y = 0; y < 7000; y += 5) presenter.scroll(y, 7000, layout);
  assert.equal(writes.length, 0);
  const projection = {
    matrix: [
      0.8116065077028283, 0, 0, 0.8116065077028283, 81.30781262263427,
      144.7856822709866,
    ],
  };
  for (let i = 0; i < 500; i++) presenter.project(projection);
  assert.equal(writes.length, 1);
  const end = 7000 + layout.travel;
  presenter.scroll(end, 7000, layout);
  const count = writes.length;
  for (let y = end; y < end + 2000; y += 5) presenter.scroll(y, 7000, layout);
  assert.equal(writes.length, count, "the FAQ has no inner pricing work");
  presenter.scroll(7000, 7000, layout);
  assert.equal(writes.at(-1)[1], 0, "reverse scroll restores the beginning");
});

test("measured sticky bounds cover entry, reading and exit before the general FAQ", () => {
  const viewport = { width: 390, height: 740, introHeight: 1700 };
  assert.deepEqual(pricingStageAtScroll(7000, 6500, viewport), {
    top: 500,
    bottom: 1240,
    width: 390,
    height: 740,
  });
  assert.equal(pricingStageAtScroll(7000, 7500, viewport).top, 0);
  assert.equal(pricingStageAtScroll(7000, 8000, viewport).top, -40);
  assert.equal(pricingStageAtScroll(7000, 9000, viewport).bottom, -300);
});

test("settled hand projection reuses the same object without updating its whole scene graph", async () => {
  const f = await pricingFixture({ background: true });
  try {
    f.pricing.render(f.offer, 1, 390, 740);
    const projection = f.pricing.screenProjection(390, 740);
    const { scene } = f.captures.at(-1);
    assert.equal(
      scene.background,
      null,
      "there is no flat background behind the hand",
    );
    assert.equal(
      scene.children.some((o) => o.material?.isShaderMaterial),
      false,
    );
    const before = scene.updateMatrixWorld;
    let updates = 0;
    scene.updateMatrixWorld = (...args) => {
      updates++;
      return before.apply(scene, args);
    };
    for (let i = 0; i < 500; i++) {
      assert.equal(f.pricing.render(f.offer, 1, 390, 740), false);
      assert.equal(f.pricing.screenProjection(390, 740), projection);
    }
    assert.equal(updates, 0);
    assert.deepEqual(f.calls.slice(-3), [
      ["background", 390, 740],
      ["clearDepth"],
      ["viewport", 0, 0, 390, 740],
    ]);
    assert.equal(f.renderer.autoClear, true);
    f.pricing.render(f.offer, 0.5, 390, 740);
    assert.notEqual(f.pricing.screenProjection(390, 740), projection);
  } finally {
    f.close();
  }
});

test("the restaurant is captured once and invalidates on resize or a new room pose", () => {
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera();
  camera.layers.enable(1);
  const originalMask = camera.layers.mask;
  const captures = [];
  const renderer = {
    domElement: { width: 780, height: 1480 },
    shadowMap: {},
    setRenderTarget(target) {
      this.target = target;
    },
    setViewport() {},
    setScissorTest() {},
    render(object, view) {
      captures.push({ object, target: this.target, mask: view.layers.mask });
    },
  };
  const backdrop = createPricingRoomBackdrop({ renderer, scene, camera });
  try {
    for (let i = 0; i < 100; i++) backdrop.draw(390, 740);
    assert.equal(captures.filter((c) => c.object === scene).length, 1);
    assert.equal(captures[0].target.width, 780);
    assert.equal(captures[0].target.texture.type, THREE.HalfFloatType);
    assert.equal(
      captures[0].target.texture.colorSpace,
      THREE.LinearSRGBColorSpace,
    );
    assert.equal(captures[1].object.children[0].material.toneMapped, true);
    assert.equal(
      captures[0].mask,
      5,
      "only restaurant/table layers, no foreground products",
    );
    assert.equal(camera.layers.mask, originalMask);
    renderer.domElement.width = 1170;
    backdrop.draw(390, 740);
    assert.equal(captures.filter((c) => c.object === scene).length, 2);
    backdrop.invalidate();
    backdrop.draw(390, 740);
    assert.equal(captures.filter((c) => c.object === scene).length, 3);
    assert.equal(renderer.target, null);
    backdrop.release();
    assert.equal(
      captures[0].target.width,
      1,
      "release the large buffer outside pricing",
    );
  } finally {
    backdrop.dispose();
  }
});

test("the hand exits in its measured viewport while the fixed restaurant canvas remains full-screen", async () => {
  const f = await pricingFixture({ background: true });
  try {
    f.pricing.render(f.offer, 1, 390, 740, { top: 0, canvasHeight: 850 });
    const projection = f.pricing.screenProjection(390, 740);
    const { camera, scene } = f.captures.at(-1);
    const screen = scene.getObjectByName("Object_18");
    for (const stageTop of [-40, -120, -300, -120, -40, 0]) {
      const top = pricingExitOffset(stageTop);
      f.pricing.render(f.offer, 1, 390, 740, { top, canvasHeight: 850 });
      assert.equal(f.pricing.screenProjection(390, 740), projection);
      const point = new THREE.Vector3()
        .setFromMatrixPosition(screen.matrixWorld)
        .project(camera);
      const gpuY = ((1 - point.y) * 850) / 2;
      const htmlY =
        top +
        projection.matrix[5] +
        (projection.matrix[3] * projection.height) / 2;
      assert.ok(Math.abs(gpuY - htmlY) < 0.01);
      assert.deepEqual(
        f.calls.at(-1),
        ["viewport", 0, 0, 390, 850],
        "the wrist is no longer cut at the frozen chapter viewport",
      );
    }
  } finally {
    f.close();
  }
});

test("a failed room capture restores the main camera and framebuffer and can retry", () => {
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera();
  camera.layers.enable(1);
  const original = camera.layers.mask;
  let failed = true;
  const renderer = {
    domElement: { width: 780, height: 1480 },
    shadowMap: {},
    setRenderTarget(value) {
      this.target = value;
    },
    setScissorTest() {},
    setViewport() {},
    render(object) {
      if (object === scene && failed) throw Error("room capture failed");
    },
  };
  const backdrop = createPricingRoomBackdrop({ renderer, scene, camera });
  try {
    assert.throws(() => backdrop.draw(390, 740), /capture failed/);
    assert.equal(camera.layers.mask, original);
    assert.equal(renderer.target, null);
    failed = false;
    backdrop.draw(390, 740);
    assert.equal(renderer.target, null);
  } finally {
    backdrop.dispose();
  }
});

test("fixed phone content stays with the last displayed hand sample while GPU work is delayed", async () => {
  const f = await pricingFixture({ background: true });
  try {
    const style = {},
      viewport = { scrollTop: 0 };
    const layer = {
      style: {},
      dataset: {},
      parentElement: { style: {} },
      setAttribute() {},
    };
    const presenter = createPricingPhonePresenter({ style }, viewport, layer);
    const layout = pricingScrollLayout(740, 1000, 530, 0.81);
    const stage = {
      width: 390,
      height: 740,
      introHeight: layout.sectionHeight,
    };
    const display = (pageY) => {
      const bounds = pricingStageAtScroll(7000, pageY, stage);
      const top = pricingExitOffset(bounds.top);
      const ratio = Math.min(1, Math.max(0, (pageY - 7000) / layout.entry));
      f.pricing.render(f.offer, ratio, 390, 740, {
        top,
        canvasHeight: 850,
      });
      presenter.project(f.pricing.screenProjection(390, 740), top);
      presenter.scroll(pageY, 7000, layout);
      presenter.show(true);
    };
    display(7100);
    const previous = style.transform;
    // Compositor scroll may run ahead; neither fixed layer moves until draw.
    let pending;
    for (let pageY = 7200; pageY < 9000; pageY += 20) pending = pageY;
    assert.equal(style.transform, previous);
    display(pending);
    const [a, b, c, d, x, y] = style.transform
      .slice(7, -1)
      .split(",")
      .map(Number);
    const { scene, camera } = f.captures.at(-1);
    const mesh = scene.getObjectByName("Object_18");
    const box = mesh.geometry.boundingBox;
    const point = new THREE.Vector3()
      .addVectors(box.min, box.max)
      .multiplyScalar(0.5)
      .applyMatrix4(mesh.matrixWorld)
      .project(camera);
    assert.ok(
      Math.abs(
        x + (a * 280) / 2 + (c * 604.2678) / 2 - ((point.x + 1) * 390) / 2,
      ) < 0.01,
    );
    assert.ok(
      Math.abs(
        y + (b * 280) / 2 + (d * 604.2678) / 2 - ((1 - point.y) * 850) / 2,
      ) < 0.01,
    );
    presenter.show(false);
    assert.equal(layer.inert, true);
    // The restaurant-only FAQ frame replaces the drawing buffer.
    f.pricing.reset();
    display(7000 + layout.entry);
    assert.equal(layer.inert, false);
    assert.equal(viewport.scrollTop, 0);
  } finally {
    f.close();
  }
});
