import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import * as THREE from 'three';
import * as director from '../components/immersive/SceneDirector.js';
import { sectionTransitionComposition } from '../components/immersive/SectionTransitionMotion.js';

const source = readFileSync('components/immersive/Scene.jsx', 'utf8');
const scope = { ...director, sectionTransitionComposition, THREE, HALF_PI: Math.PI / 2, clamp: (v, a, b) => Math.min(b, Math.max(a, v)) };
vm.runInNewContext(source.slice(source.indexOf('function baseComposition('), source.indexOf('\nfunction disposeTree(')), scope);
const names = ['dish', 'support', 'phone', 'laptop'];
const chapters = ['wearable', 'features', 'encryption', 'grip', 'sustainability', 'testimonies', 'social-content', 'product', 'open-weight', 'footer'];
const sceneFrames = Object.fromEntries(chapters.map(id => [id, director.DEFAULT_SCENE_FRAME]));
const joins = chapters.slice(0, -1).map((from, i) => ({ from, to: chapters[i + 1] }));
const controlled = [
  { from: 'features', to: 'encryption', flip: true },
  { from: 'encryption', to: 'grip', flip: true, drag: 0 },
  { from: 'grip', to: 'sustainability', drag: 1 },
  { from: 'social-content', to: 'product', supportAngle: 185 },
  { from: 'product', to: 'open-weight', supportAngle: 185 },
];
const stateAt = (join, progress) => ({ ...join, sceneFrames, section: progress < 0.5 ? join.from : join.to,
  transition: { from: join.from, to: join.to, fromOpening: join.from === 'wearable', fromProgress: 1, toProgress: 0, progress } });
const plain = value => JSON.parse(JSON.stringify(value));
const orientation = rotation => new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));

// The old composition rewinds the plate by 226 degrees toward the next
// chapter's zero-scale default. Test the actual renderer composition wrapper.
test('section reveals keep their visible orientation without changing the shared motion envelope', () => {
  for (const mobile of [false, true]) for (const join of [...joins, ...controlled]) {
    const from = director.continuousComposition(stateAt(join, 0), mobile, scope.baseComposition);
    const to = director.continuousComposition(stateAt(join, 1), mobile, scope.baseComposition);
    const samples = Array.from({ length: 17 }, (_, i) => i / 16);
    const sample = progress => scope.composition(stateAt(join, progress), mobile);
    const forward = samples.map(sample);
    assert.deepEqual(plain(samples.toReversed().map(sample).toReversed()), plain(forward), 'reverse and jump history must not affect any pose');
    for (const [i, pose] of forward.entries()) {
      const original = director.continuousComposition(stateAt(join, samples[i]), mobile, scope.baseComposition);
      const rotations = new Set();
      for (const name of names) {
        const key = `${name}Scale`;
        if (pose[key] > 0 && ((from[key] === 0) !== (to[key] === 0))) {
          const visible = from[key] === 0 ? to : from;
          rotations.add(`${name}Rotation`);
          assert.ok(orientation(pose[`${name}Rotation`]).angleTo(orientation(visible[`${name}Rotation`])) < 1e-7,
            `${join.from}:${join.to} ${name} at ${samples[i]} must not turn toward an invisible default`);
        }
      }
      for (const key of Object.keys(original)) if (!rotations.has(key))
        assert.deepEqual(plain(pose[key]), plain(original[key]), `${key}: retain authored translation, scale, camera, opacity and discrete values`);
      assert.deepEqual(plain(scope.composition({ ...stateAt(join, samples[i]), reducedMotion: true }, mobile)), plain(pose), 'reduced motion adds no time-dependent catch-up');
    }
    assert.deepEqual(plain(forward[0]), plain(from));
    assert.deepEqual(plain(forward.at(-1)), plain(to));
  }
  for (const mobile of [false, true]) for (const openingProgress of [0, 0.25, 0.5, 0.75, 1]) {
    const state = { section: 'hero', openingProgress };
    assert.deepEqual(plain(scope.composition(state, mobile)), plain(director.continuousComposition(state, mobile, scope.baseComposition)), 'opening choreography is unchanged');
  }
});

// Rotation may reset at zero scale, but its complete world transform must be
// continuous there. Actual hull vertices also catch position/scale shortcuts.
test('rendered subject geometry settles continuously at visible and zero-scale endpoints', () => {
  const hull = Object.values(JSON.parse(readFileSync('public/immersive-assets/dishes/framing-hulls.json', 'utf8')).byUrl).find(value => value.id === 'homard');
  const points = hull.vertices.map(point => new THREE.Vector3(...point));
  const h = 1e-5;
  const transformed = (join, mobile, progress, name) => {
    const pose = scope.composition(stateAt(join, progress), mobile);
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...pose[name]), orientation(pose[`${name}Rotation`]), new THREE.Vector3().setScalar(pose[`${name}Scale`]));
    return [...matrix.elements, ...points.flatMap(point => point.clone().applyMatrix4(matrix).toArray())];
  };
  for (const mobile of [false, true]) for (const join of [...joins, ...controlled]) for (const name of names) for (const seam of [0, 1]) {
    const [before, at, after] = [seam - h, seam, seam + h].map(progress => transformed(join, mobile, progress, name));
    for (let i = 0; i < at.length; i++) {
      assert.ok(Math.abs(after[i] - before[i]) < 1e-8, `${join.from}:${join.to}/${name}: world coordinate jumps at ${seam}`);
      assert.ok(Math.abs((after[i] - at[i]) / h - (at[i] - before[i]) / h) < 1e-5, `${join.from}:${join.to}/${name}: world velocity breaks at ${seam}`);
    }
  }
});

test('cropped or unmeasured endpoint frames retain the authored subject rotation', () => {
  // Hosted ab14f9c 844x390: this features frame ends 8.27% below the stage.
  // Sushi was already cropped there; stabilizing its rotation worsened that
  // existing overflow by up to 0.934px. Do not alter that subject's silhouette.
  const cropped = { x: 0.28647067535545023, y: 0.7336738782051282, width: 0.49296504739336494, height: 0.6981169871794872 };
  for (const frame of [cropped, undefined, { ...director.DEFAULT_SCENE_FRAME, height: NaN }, { ...director.DEFAULT_SCENE_FRAME, width: 0 }]) {
    for (const join of [{ from: 'wearable', to: 'features' }, { from: 'features', to: 'encryption', flip: true }]) {
      for (const progress of [0.0625, 0.5, 0.875]) {
        const state = { ...stateAt(join, progress), sceneFrames: { ...sceneFrames, features: frame } };
        const pose = scope.composition(state, false);
        const authored = director.continuousComposition(state, false, scope.baseComposition);
        for (const key of ['dish', 'dishRotation', 'dishScale', 'dishOpacity'])
          assert.deepEqual(plain(pose[key]), plain(authored[key]), `${key}: unsafe or unknown features framing keeps its exact authored pose`);
        if (join.to === 'encryption') assert.deepEqual(plain(pose.supportRotation), plain(scope.baseComposition({ section: 'encryption', flip: true }, false).supportRotation), 'the other fully onstage subject still receives the refinement');
      }
    }
  }
});
