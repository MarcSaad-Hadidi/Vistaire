import test from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import {
  pricingScrollLayout,
  pricingScreenScroll,
  pricingPagePosition,
} from "../src/PricingPhoneLayout.js";
import { pricingFixture } from "./helpers/pricing-hand-fixture.mjs";
import { pricingHandProgress } from "../src/PricingHandScene.js";

test("page scrolling reads the phone after entry and reaches the last link before sticky release", () => {
  for (const [height, scale] of [
    [740, 0.81],
    [900, 1],
    [390, 0.36],
  ]) {
    const layout = pricingScrollLayout(height, 780, 530, scale);
    assert.equal(pricingHandProgress(-layout.entry, height), 1);
    assert.equal(pricingHandProgress(-layout.entry / 2, height), 0.5);
    assert.equal(pricingScreenScroll(200, layout), 0);
    assert.equal(pricingScreenScroll(-layout.entry, layout), 0);
    assert.equal(pricingScreenScroll(-layout.readingStart, layout), 0);
    assert.ok(layout.lead >= height * 0.2);
    for (let y = 0; y <= layout.readingStart; y += 5) {
      assert.equal(
        pricingScreenScroll(-y, layout),
        0,
        "no reading before the hand settles and the first card holds",
      );
    }
    assert.ok(
      Math.abs(
        pricingScreenScroll(-layout.readingStart - layout.reading, layout) -
          layout.maxScroll,
      ) < 1e-9,
    );
    assert.ok(
      layout.sectionHeight < height * 2.7,
      "a short offer should not require a long pricing chapter",
    );
    const sectionTop = 7000;
    for (const reading of [0, 80, 180, layout.maxScroll, 180, 80, 0]) {
      const page = pricingPagePosition(sectionTop, reading, layout);
      assert.ok(
        Math.abs(pricingScreenScroll(sectionTop - page, layout) - reading) <
          1e-9,
      );
    }
    assert.equal(pricingScreenScroll(-layout.travel, layout), layout.maxScroll);
    assert.ok(
      layout.hold > 0,
      "the final link is visible before the section exits",
    );
  }
});

test("content and reduced motion use measured travel instead of an empty fixed-length chapter", () => {
  const short = pricingScrollLayout(740, 400, 530, 0.81);
  assert.equal(short.maxScroll, 0);
  assert.equal(short.reading, 0);
  const normal = pricingScrollLayout(740, 780, 530, 0.81);
  const reduced = pricingScrollLayout(740, 780, 530, 0.81, true);
  assert.equal(reduced.entry, 0);
  assert.equal(reduced.lead, 0);
  assert.equal(reduced.reading, normal.reading);
  const translated = pricingScrollLayout(740, 920, 530, 0.81);
  assert.ok(translated.reading > normal.reading);
  assert.equal(
    pricingScreenScroll(
      -translated.readingStart - translated.reading,
      translated,
    ),
    translated.maxScroll,
  );
});

test("the HTML transform matches the real phone screen at all native poses and viewport sizes", async () => {
  const f = await pricingFixture();
  try {
    for (const [width, height] of [
      [1440, 900],
      [390, 740],
      [320, 600],
      [768, 1000],
      [844, 390],
    ]) {
      for (let frame = 0; frame < 46; frame++) {
        f.pricing.render(f.offer, frame / 45, width, height);
        const { scene, camera } = f.captures.at(-1);
        const screen = scene.getObjectByName("Object_18");
        const box = screen.geometry.boundingBox;
        const projection = f.pricing.screenProjection(width, height);
        const [a, b, c, d, x, y] = projection.matrix;
        for (const [sx, sy] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
          [0.5, 0.5],
        ]) {
          const point = new Vector3(
            box.min.x + sx * (box.max.x - box.min.x),
            box.max.y - sy * (box.max.y - box.min.y),
            (box.min.z + box.max.z) / 2,
          )
            .applyMatrix4(screen.matrixWorld)
            .project(camera);
          const expectedX = ((point.x + 1) * width) / 2;
          const expectedY = ((1 - point.y) * height) / 2;
          assert.ok(
            Math.abs(
              a * sx * projection.width +
                c * sy * projection.height +
                x -
                expectedX,
            ) < 0.01,
          );
          assert.ok(
            Math.abs(
              b * sx * projection.width +
                d * sy * projection.height +
                y -
                expectedY,
            ) < 0.01,
          );
        }
      }
    }
  } finally {
    f.close();
  }
});

test("the fingers block pointer actions and reading the settled HTML needs no GPU redraw", async () => {
  const f = await pricingFixture();
  try {
    f.pricing.render(f.offer, 1, 390, 740);
    const p = f.pricing.screenProjection(390, 740);
    const [a, b, c, d, x, y] = p.matrix;
    const hit = (sx, sy) =>
      f.pricing.screenIsVisible(
        a * sx * p.width + c * sy * p.height + x,
        b * sx * p.width + d * sy * p.height + y,
        390,
        740,
      );
    assert.equal(hit(0.5, 0.3), true);
    assert.equal(
      hit(0.5, 0.85),
      false,
      "an index finger covers the lower screen",
    );
    assert.equal(
      hit(-0.1, 0.3),
      false,
      "outside the phone is not an active control surface",
    );
    const layout = pricingScrollLayout(740, 780, 530, p.scale);
    const before = f.captures.length;
    for (let travel = layout.entry; travel <= layout.travel; travel += 5) {
      assert.ok(pricingScreenScroll(-travel, layout) >= 0);
      assert.equal(f.pricing.render(f.offer, 1, 390, 740), false);
    }
    assert.equal(f.captures.length, before);
  } finally {
    f.close();
  }
});

test("pointer occlusion remains correct with expanded Safari viewport and during the hand exit", async () => {
  const f = await pricingFixture({ background: true });
  try {
    for (const top of [0, -60, -220, 0]) {
      f.pricing.render(f.offer, 1, 390, 740, { top, canvasHeight: 850 });
      const p = f.pricing.screenProjection(390, 740);
      const [a, b, c, d, x, y] = p.matrix;
      const hit = (sx, sy) =>
        f.pricing.screenIsVisible(
          a * sx * p.width + c * sy * p.height + x,
          b * sx * p.width + d * sy * p.height + y,
          390,
          740,
        );
      assert.equal(hit(0.5, 0.3), true);
      assert.equal(hit(0.5, 0.85), false);
    }
  } finally {
    f.close();
  }
});
