import assert from "node:assert/strict";
import test from "node:test";
import {
  continuousComposition,
  interpolatePose,
  journeyCoordinate,
} from "../src/SceneDirector.js";

const chapters = [
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

// Distinct endpoints catch section/progress resets and accidental forwarding
// of transition state into the base choreography. No DOM or WebGL is involved.
function baseComposition(state, mobile) {
  assert.equal(state.transition ?? null, null);
  const index = chapters.indexOf(state.section);
  const p = state.progress ?? 0;
  const opening = state.openingProgress != null;
  return {
    camera: [index * 2 + p, mobile ? 5 : 3, opening ? 9 : 6],
    look: [index, p, opening ? 4 : 0],
    dishScale: opening ? 1.6 : 0.4 + p,
    supportScale: 0.7 + index * 0.1,
    dishOpacity: opening ? 0 : 1,
    particles: index === chapters.length - 1,
  };
}

function closePose(actual, expected, tolerance) {
  for (const key of ["camera", "look"]) {
    actual[key].forEach((value, i) => {
      assert.ok(
        Math.abs(value - expected[key][i]) <= tolerance,
        `${key}[${i}] discontinuity: ${value} vs ${expected[key][i]}`,
      );
    });
  }
  for (const key of ["dishScale", "supportScale", "dishOpacity"]) {
    assert.ok(Math.abs(actual[key] - expected[key]) <= tolerance, key);
  }
}

test("numeric interpolation keeps inputs intact and supplies default opacity", () => {
  const from = { camera: [0, 2, 8], scale: 2, particles: false, label: "from" };
  const to = { camera: [4, 6, 0], scale: 0, particles: true, label: "to" };
  const snapshot = structuredClone([from, to]);
  assert.deepEqual(interpolatePose(from, to, 0.25), {
    camera: [1, 3, 6],
    scale: 1.5,
    particles: false,
    label: "from",
    dishOpacity: 1,
  });
  assert.deepEqual(interpolatePose(from, to, -1), { ...from, dishOpacity: 1 });
  assert.deepEqual(interpolatePose(from, to, 2), { ...to, dishOpacity: 1 });
  assert.deepEqual([from, to], snapshot);
  assert.notEqual(interpolatePose(from, to, 0).camera, from.camera);
  assert.equal(interpolatePose({}, { dishOpacity: 0 }, 0.25).dishOpacity, 0.75);
});

for (const mobile of [false, true]) {
  for (let index = 0; index < chapters.length - 1; index++) {
    const from = chapters[index];
    const to = chapters[index + 1];
    test(`${mobile ? "mobile" : "desktop"}: ${from} → ${to} has continuous numeric endpoints`, () => {
      const transition = { from, to, fromProgress: 1, toProgress: 0 };
      const at = (progress) =>
        continuousComposition(
          {
            section: from,
            progress: 1,
            transition: { ...transition, progress },
          },
          mobile,
          baseComposition,
        );
      const left = continuousComposition(
        { section: from, progress: 1 },
        mobile,
        baseComposition,
      );
      const right = continuousComposition(
        { section: to, progress: 0 },
        mobile,
        baseComposition,
      );
      assert.deepEqual(at(0), left);
      assert.deepEqual(at(1), right);
      closePose(at(0.0001), left, 0.000001);
      closePose(at(0.9999), right, 0.000001);
      assert.equal(at(0.9999).particles, left.particles);
    });
  }
}

test("opening passes through unchanged and is not choreographed a second time", () => {
  const state = { section: "ai", progress: 0.5, openingProgress: 0.5 };
  const expected = { camera: [0, 2, 8], dishOpacity: 0.3 };
  let calls = 0;
  const actual = continuousComposition(state, true, (received, mobile) => {
    assert.equal(received, state);
    assert.equal(mobile, true);
    calls++;
    return expected;
  });
  assert.equal(actual, expected);
  assert.equal(calls, 1);
});

test("opening exit retains the terminal opening pose and room coordinate", () => {
  const at = (progress) => ({
    section: "wearable",
    progress: 1,
    openingProgress: 1,
    transition: {
      from: "wearable",
      to: "features",
      fromOpening: true,
      progress,
    },
  });
  const left = baseComposition(
    { section: "wearable", progress: 1, openingProgress: 1 },
    true,
  );
  const right = baseComposition({ section: "features", progress: 0 }, true);
  assert.deepEqual(continuousComposition(at(0), true, baseComposition), left);
  assert.deepEqual(continuousComposition(at(1), true, baseComposition), right);
  closePose(
    continuousComposition(at(0.0001), true, baseComposition),
    left,
    1e-6,
  );
  assert.equal(journeyCoordinate(at(0)), 2);
  assert.equal(journeyCoordinate(at(1)), 3);
});

test("scroll reversal reuses identical poses and never mutates state", () => {
  const state = {
    section: "grip",
    progress: 1,
    dish: "burger",
    flip: true,
    transition: { from: "grip", to: "sustainability", progress: 0 },
  };
  const snapshot = structuredClone(state);
  const at = (progress) =>
    continuousComposition(
      { ...state, transition: { ...state.transition, progress } },
      true,
      (endpoint, mobile) => {
        assert.equal(endpoint.dish, "burger");
        assert.equal(endpoint.flip, true);
        return baseComposition(endpoint, mobile);
      },
    );
  const samples = [0, 0.2, 0.5, 0.8, 1];
  const forward = samples.map(at);
  const backward = samples.toReversed().map(at).toReversed();
  assert.deepEqual(backward, forward);
  assert.deepEqual(state, snapshot);
});

test("room coordinate matches every transition endpoint and stays inside moods", () => {
  for (let index = 0; index < chapters.length - 1; index++) {
    const from = chapters[index];
    const to = chapters[index + 1];
    const at = (progress) =>
      journeyCoordinate({ transition: { from, to, progress } });
    assert.equal(at(0), journeyCoordinate({ section: from, progress: 1 }));
    assert.equal(at(1), journeyCoordinate({ section: to, progress: 0 }));
    assert.ok(Math.abs(at(0.0001) - at(0)) < 0.000001);
    assert.ok(Math.abs(at(0.9999) - at(1)) < 0.000001);
    assert.equal(at(0.5), index + 0.625);
  }
  assert.equal(journeyCoordinate({ openingProgress: 0 }), 0);
  assert.equal(journeyCoordinate({ openingProgress: 0.5 }), 1);
  assert.equal(journeyCoordinate({ openingProgress: 1 }), 2);
  assert.equal(journeyCoordinate({ section: "footer", progress: 1 }), 11);
  assert.equal(journeyCoordinate({ section: "footer", progress: 100 }), 11);
  assert.equal(journeyCoordinate({ section: "unknown", progress: NaN }), 0);
});
