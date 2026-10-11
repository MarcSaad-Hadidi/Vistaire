import test from "node:test";
import assert from "node:assert/strict";
import {
  CINEMATIC_TIMING,
  chapterTiming,
  chapterPhase,
  readingTiming,
  readingPresentation,
  scaledCinematicTiming,
  measureChapterTransitions,
} from "../src/SceneDirector.js";
import { laptopOpeningProgress } from "../src/LaptopModel.js";
import {
  pricingScrollLayout,
  pricingScreenScroll,
} from "../src/PricingPhoneLayout.js";
import { createPricingPhonePresenter } from "../src/PricingPhonePresenter.js";

test("trackpad reading holds are longer while support, dish and collection chapters are shorter", () => {
  assert.ok(CINEMATIC_TIMING.phoneHoldScreens > 1.05 * 1.5);
  const feature = chapterTiming("features");
  assert.ok(feature.readingHoldScreens >= 2.1 - 1e-12);
  for (const [index, center] of readingTiming("features").centers.entries()) {
    const span = feature.readingHoldScreens / feature.sceneScreens;
    for (const p of [center - span * 0.4, center, center + span * 0.4]) {
      assert.equal(readingPresentation(p, "features").index, index);
      assert.equal(readingPresentation(p, "features").opacity, 1);
    }
  }
  for (const id of ["encryption", "grip", "product"])
    assert.ok(chapterTiming(id).activeScreens < CINEMATIC_TIMING.activeScreens);
  assert.equal(chapterTiming("social-content").readingHoldScreens, 1.4);
});

test("native laptop finishes opening before its longer outgoing transition", () => {
  const ids = [
    "features",
    "encryption",
    "grip",
    "sustainability",
    "testimonies",
    "social-content",
    "product",
  ];
  for (const factor of [0.25, 1, 4]) {
    const timing = scaledCinematicTiming(factor),
      height = 900;
    let top = 0;
    const measurements = [
      { id: "hero", top: 0, travel: 1 },
      { id: "ai", top: 0, travel: 1 },
      { id: "wearable", top: 0, travel: 1 },
      ...ids.map((id) => {
        const t = chapterTiming(id, timing),
          m = { id, top, travel: t.sceneScreens * height };
        top += (t.sceneScreens + 1) * height;
        return m;
      }),
      { id: "open-weight", top, travel: height * 3 },
      { id: "footer", top: top + height * 4, travel: height },
    ];
    const windows = measureChapterTransitions(
      measurements,
      { stageHeight: height },
      timing,
    );
    const incoming = windows.find((w) => w.to.id === "sustainability");
    const outgoing = windows.find((w) => w.from.id === "sustainability");
    const chapter = outgoing.from;
    const lidAt = (y) =>
      laptopOpeningProgress(
        chapterPhase("sustainability", (y - chapter.top) / chapter.travel),
      );
    assert.equal(lidAt(incoming.end), 0);
    assert.equal(lidAt(outgoing.start), 1);
    assert.ok(
      outgoing.end - outgoing.start > height * timing.transitionScreens,
    );
    const samples = Array.from(
      { length: 101 },
      (_, i) => incoming.end + ((outgoing.start - incoming.end) * i) / 100,
    );
    const forward = samples.map(lidAt);
    assert.deepEqual(samples.toReversed().map(lidAt).toReversed(), forward);
    for (let i = 1; i < forward.length; i++)
      assert.ok(forward[i] >= forward[i - 1]);
  }
});

test("phone reading is slower than page travel and starts after the settled first-card hold", () => {
  for (const height of [600, 740, 900]) {
    const layout = pricingScrollLayout(height, 1500, 530, 0.8);
    assert.equal(pricingScreenScroll(-layout.readingStart, layout), 0);
    const visibleMovement =
      pricingScreenScroll(-layout.readingStart - 100, layout) * layout.scale;
    assert.ok(visibleMovement <= 100 && visibleMovement >= 80);
    assert.equal(pricingScreenScroll(-layout.travel, layout), layout.maxScroll);
  }
});

test("outside pricing controls use the displayed frame and do no work on settled or hidden samples", () => {
  const writes = [];
  const aside = {
    style: new Proxy(
      {},
      {
        set: (target, key, value) => {
          writes.push([key, value]);
          target[key] = value;
          return true;
        },
      },
    ),
    setAttribute: (...args) => writes.push(args),
  };
  const presenter = createPricingPhonePresenter({ style: {} }, {}, null, aside);
  presenter.copy(false, 0);
  const hidden = writes.length;
  for (let i = 0; i < 500; i++) presenter.copy(false, 0);
  assert.equal(writes.length, hidden);
  presenter.copy(true, 1, 0, 740);
  assert.equal(aside.inert, false);
  assert.equal(aside.style.opacity, "1");
  const settled = writes.length;
  for (let i = 0; i < 500; i++) presenter.copy(true, 1, 0, 740);
  assert.equal(writes.length, settled);
  presenter.copy(true, 1, 200, 740);
  assert.equal(aside.inert, true);
  assert.equal(aside.style.visibility, "hidden");
  presenter.copy(true, 1, 0, 740);
  assert.equal(aside.style.opacity, "1");
  assert.equal(aside.inert, false);
});
