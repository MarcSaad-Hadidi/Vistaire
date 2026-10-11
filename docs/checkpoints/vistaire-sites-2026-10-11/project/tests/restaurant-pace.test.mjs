import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createRestaurantJourney } from "../src/RestaurantWorld.js";

function fixture() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog(new THREE.Color(), 1, 100);
  const root = new THREE.Group();
  const journey = createRestaurantJourney(scene, root);
  return (state) => {
    journey.update(state, 1, { dataset: {} });
    return { position: root.position.toArray(), yaw: root.rotation.y };
  };
}

test("chapter and transition changes do not change room position at the same page distance", () => {
  const pose = fixture();
  const reference = pose({
    section: "features",
    progress: 1,
    scrollDistance: 8,
  });
  for (const state of [
    { section: "encryption", progress: 0 },
    {
      section: "features",
      transition: { from: "features", to: "encryption", progress: 0.5 },
    },
    { section: "footer", progress: 0.2 },
  ])
    assert.deepEqual(pose({ ...state, scrollDistance: 8 }), reference);
});

test("equal page distances give equal forward and angular travel throughout the site", () => {
  const pose = fixture();
  const deltas = [0, 8, 20, 35].map((scrollDistance) => {
    const a = pose({ section: "grip", scrollDistance });
    const b = pose({ section: "grip", scrollDistance: scrollDistance + 0.5 });
    return [b.position[2] - a.position[2], b.yaw - a.yaw];
  });
  for (const delta of deltas)
    delta.forEach((value, i) => assert(Math.abs(value - deltas[0][i]) < 1e-12));
});

test("reversing repeatedly returns to the identical room pose", () => {
  const pose = fixture();
  const state = {
    section: "sustainability",
    progress: 0.4,
    scrollDistance: 12,
  };
  const reference = pose(state);
  for (const scrollDistance of [13, 11, 14, 10, 12])
    pose({ ...state, scrollDistance });
  assert.deepEqual(pose(state), reference);
});
