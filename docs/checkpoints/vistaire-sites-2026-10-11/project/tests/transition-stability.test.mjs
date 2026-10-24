import test from "node:test";
import assert from "node:assert/strict";
import {
  CINEMATIC_TIMING,
  chapterCopyPresentation,
  cinematicPoseDamping,
  measureChapterTransitions,
  waitForCinematicFrame,
  chapterTiming,
} from "../src/SceneDirector.js";

const ids = [
  "hero",
  "ai",
  "wearable",
  "features",
  "encryption",
  "grip",
  "sustainability",
  "testimonies",
  "social-content",
  "product",
  "open-weight",
  "footer",
];
function layout(height) {
  const t = CINEMATIC_TIMING;
  const openingHeight =
    height *
    (1 + t.openingMotionScreens + t.phoneHoldScreens + t.openingReleaseScreens);
  const opening = {
    top: 0,
    height: openingHeight,
    stageHeight: height,
    travel: openingHeight - height,
  };
  let top = openingHeight;
  const chapters = ids.map((id, index) => {
    if (index < 3)
      return {
        id,
        top: (height * t.openingMotionScreens * index) / 2,
        travel: opening.travel,
      };
    const chapterHeight =
      id === "open-weight"
        ? height * 7
        : id === "footer"
          ? height * 1.6
          : (height * chapterTiming(id).chapterHeightVh) / 100;
    const result = { id, top, travel: chapterHeight - height };
    top += chapterHeight;
    return result;
  });
  return measureChapterTransitions(chapters, opening);
}

test("a busy GPU cannot publish repeated intermediate headings before drawing", () => {
  let busy = true,
    scroll = 0,
    calls = 0;
  const publications = [];
  const renderer = (now) => {
    calls++;
    if (!busy) update(now, true);
  };
  function update(now, inside = false) {
    if (waitForCinematicFrame(now, inside, renderer)) return;
    publications.push(scroll);
  }
  for (let frame = 0; frame < 60; frame++) {
    scroll = frame * 12;
    update(frame * 16);
  }
  assert.deepEqual(
    publications,
    [],
    "copy must retain the displayed scene's sample",
  );
  busy = false;
  renderer(1000);
  assert.deepEqual(publications, [708], "draw consumes the newest sample once");
  assert.equal(
    calls,
    61,
    "publication must not recursively request another draw",
  );
});

test("initial setup and the WebGL fallback publish without waiting for a renderer", () => {
  assert.equal(
    waitForCinematicFrame(undefined, false, () => assert.fail("not a frame")),
    false,
  );
  assert.equal(waitForCinematicFrame(10, false, undefined), false);
  assert.equal(
    waitForCinematicFrame(10, true, () => assert.fail("no recursion")),
    false,
  );
});

test("each chapter fades once, never overlaps another heading, and reverses identically", () => {
  const cinematic = ids.slice(3, 10);
  for (const height of [844, 900, 730]) {
    const windows = layout(height);
    for (const window of windows.filter(
      (w) => cinematic.includes(w.from.id) && cinematic.includes(w.to.id),
    )) {
      const samples = Array.from(
        { length: 101 },
        (_, i) => window.start + ((window.end - window.start) * i) / 100,
      );
      const forward = samples.map((y) =>
        cinematic.map((id) => chapterCopyPresentation(id, y, windows)),
      );
      const reverse = samples
        .toReversed()
        .map((y) =>
          cinematic.map((id) => chapterCopyPresentation(id, y, windows)),
        )
        .toReversed();
      assert.deepEqual(reverse, forward);
      assert.ok(
        forward.every(
          (frame) => frame.filter((layer) => layer.visible).length <= 1,
        ),
      );
      const fromIndex = cinematic.indexOf(window.from.id),
        toIndex = cinematic.indexOf(window.to.id);
      assert.equal(forward[0][fromIndex].opacity, 1);
      assert.equal(forward.at(-1)[toIndex].opacity, 1);
      for (let i = 1; i < forward.length; i++) {
        assert.ok(
          forward[i][fromIndex].opacity <=
            forward[i - 1][fromIndex].opacity + 1e-12,
        );
        assert.ok(
          forward[i][toIndex].opacity >=
            forward[i - 1][toIndex].opacity - 1e-12,
        );
      }
    }
  }
});

test("scroll poses reach the same frame regardless of frame rate or direction", () => {
  for (const dt of [0, 1 / 120, 1 / 60, 1 / 30, 0.05]) {
    for (const [previous, target] of [
      [0, 0.7],
      [0.95, 0.7],
      [0.2, 0.7],
    ]) {
      const weight = cinematicPoseDamping(dt, true);
      assert.equal(previous + (target - previous) * weight, target);
    }
    assert.equal(cinematicPoseDamping(dt, false, true), 1);
  }
  const controlWeight = cinematicPoseDamping(1 / 60, false);
  assert.ok(
    controlWeight > 0 && controlWeight < 1,
    "stationary interactive controls retain their smoothing",
  );
});

test("product copy has finished leaving before the transparent pricing phone starts", () => {
  for (const height of [740, 844, 900]) {
    const windows = layout(height);
    const entry = windows.find((w) => w.to.id === "open-weight");
    assert.equal(entry.end, entry.to.top);
    const copy = chapterCopyPresentation("product", entry.to.top, windows);
    assert.equal(copy.opacity, 0);
    assert.equal(copy.visible, false);
  }
});
