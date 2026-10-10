import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import * as THREE from 'three';
import * as director from '../components/immersive/SceneDirector.js';

// Exercise the real authored object poses without requiring a WebGL context.
const source = readFileSync('components/immersive/Scene.jsx', 'utf8');
const context = { THREE, HALF_PI: Math.PI / 2, clamp: (v, a, b) => Math.min(b, Math.max(a, v)) };
vm.runInNewContext(source.slice(source.indexOf('function baseComposition('), source.indexOf('\nfunction composition(')) + ';this.base = baseComposition', context);
const ids = ['hero', 'ai', 'wearable', 'features', 'encryption', 'grip', 'sustainability', 'testimonies', 'social-content', 'product', 'open-weight', 'footer'];
function geometry(stage) {
  const opening = { top: 0, travel: stage * 6.3, motionTravel: stage * 4.8, height: stage * 7.3, stageHeight: stage, sceneHeight: stage };
  let top = opening.height;
  const measurements = ids.map((id, i) => {
    if (i < 3) return { id, top: stage * [0, 2.304, 4.512][i], travel: 1 };
    const travel = stage * [3, 2, 2, 2, 3, 4.4, 3.2, 4.6, 0.1][i - 3];
    const item = { id, top, travel };
    top += travel + stage;
    return item;
  });
  return { opening, measurements };
}
const numbers = (pose) => Object.values(pose).flat().filter(v => typeof v === 'number');
function assertC1(sample, seam, label) {
  const h = 0.02;
  const [a, b, c] = [seam - h, seam, seam + h].map(y => numbers(sample(y)));
  for (let i = 0; i < b.length; i++) {
    assert.ok(Math.abs(c[i] - a[i]) < 0.004, `${label}: coordinate ${i} jumps`);
    assert.ok(Math.abs((c[i] - b[i]) / h - (b[i] - a[i]) / h) < 0.00005, `${label}: coordinate ${i} velocity breaks`);
  }
}

test('measured chapter windows extend every exit without consuming the phone hold or adding page length', () => {
  assert.equal(typeof director.measureChapterTransitions, 'function', 'shared measured transition windows are required');
  for (const stage of [757, 800, 812, 844, 900, 932, 1080, 1440]) {
    const { measurements, opening } = geometry(stage);
    const transitions = director.measureChapterTransitions(measurements, opening);
    assert.equal(transitions.length, 9);
    assert.equal(transitions[0].start, opening.top + opening.travel);
    assert.equal(transitions.at(-1).end, measurements.at(-1).top);
    for (const [i, window] of transitions.entries()) {
      assert.ok(window.end - window.start >= stage * 1.4, `${window.from.id}: transition still compressed into one viewport`);
      assert.ok(window.end - window.start <= stage * 2.11);
      if (i) assert.ok(transitions[i - 1].end < window.start, 'exploration must remain between blends');
    }
  }
});

test('all object and atmosphere seams are C1, reversible and independent of jump history', () => {
  // This existing API test is red on the old raw chapter progress even before
  // the measured window API exists: the feature rotation stops abruptly at 1.
  const feature = p => director.continuousComposition({ section: 'features', progress: p }, false, context.base);
  const h = 0.000001;
  assert.ok(Math.abs((feature(1).dishRotation[1] - feature(1 - h).dishRotation[1]) / h) < 0.001, 'chapter endpoint rotation must settle before clamping');
  assert.equal(typeof director.transitionAtScroll, 'function');
  for (const mobile of [false, true]) {
    const { measurements, opening } = geometry(mobile ? 844 : 900);
    const windows = director.measureChapterTransitions(measurements, opening);
    const stateAt = y => {
      const current = measurements.filter(m => y >= m.top).at(-1) || measurements[0];
      return {
        section: current.id, progress: (y - current.top) / current.travel,
        openingProgress: y < opening.height ? Math.max(0, Math.min(1, y / opening.motionTravel)) : null,
        transition: director.transitionAtScroll(windows, y),
      };
    };
    const sample = y => ({ ...director.continuousComposition(stateAt(y), mobile, context.base), mood: director.journeyCoordinate(stateAt(y)) });
    for (const window of windows) {
      for (const seam of [window.start, window.from.top + window.from.travel, window.to.top, window.end]) {
        assertC1(sample, seam, `${mobile}/${window.from.id}:${window.to.id}@${seam}`);
      }
      const ys = [window.start - 1, window.start, (window.start + window.end) / 2, window.end, window.end + 1];
      const forward = ys.map(sample);
      assert.deepEqual(ys.toReversed().map(sample).toReversed(), forward);
    }
    for (const p of [0, 0.02, 0.3, 0.56, 0.8, 0.9, 1]) assertC1(sample, p * opening.motionTravel, `opening@${p}`);
  }
});

test('opening camera samples share derivatives without overshooting their calibrated frames', () => {
  assert.equal(typeof director.interpolatePoseTrack, 'function', 'camera calibration needs continuous slopes between its sampled poses');
  const stops = [0, 0.12, 0.28, 0.42, 0.56, 0.72, 0.86, 1];
  const poses = stops.map((p, i) => ({ camera: [Math.sin(p * Math.PI), i, i * i], shift: i % 3 }));
  const sample = p => director.interpolatePoseTrack(stops, poses, p);
  for (const p of stops) {
    const h = 1e-6;
    const [a, b, c] = [p - h, p, p + h].map(sample).map(numbers);
    b.forEach((v, i) => assert.ok(Math.abs((c[i] - v) / h - (v - a[i]) / h) < 0.01, `camera derivative at ${p}`));
  }
  for (let i = 0; i < stops.length - 1; i++) {
    for (let k = 0; k <= 20; k++) {
      const actual = numbers(sample(stops[i] + (stops[i + 1] - stops[i]) * k / 20));
      const [a, b] = [poses[i], poses[i + 1]].map(numbers);
      actual.forEach((v, j) => assert.ok(v >= Math.min(a[j], b[j]) - 1e-8 && v <= Math.max(a[j], b[j]) + 1e-8));
    }
  }
});

test('missing-focus chapters blend to the real camera fallback without view-offset seams', () => {
  assert.equal(typeof director.transitionSceneFrame, 'function', 'camera focus requires the actual fallback endpoint');
  const fallback = { x: 0.5, y: 0.56, width: 0.8, height: 0.55 };
  const frames = { sustainability: { x: 0.75, y: 0.6, width: 0.4, height: 0.5 }, testimonies: null, 'social-content': null, product: { x: 0.3, y: 0.6, width: 0.5, height: 0.6 } };
  for (const [from, to] of [['sustainability', 'testimonies'], ['testimonies', 'social-content'], ['social-content', 'product']]) {
    assert.deepEqual(director.transitionSceneFrame({ from, to, progress: 0 }, frames), frames[from] || fallback);
    assert.deepEqual(director.transitionSceneFrame({ from, to, progress: 1 }, frames), frames[to] || fallback);
    const sample = y => director.transitionSceneFrame({ from, to, progress: y / 1600 }, frames);
    assertC1(sample, 0, `${from}: focus entry`);
    assertC1(sample, 1600, `${to}: focus exit`);
  }
});

test('the outgoing phone keeps its selected restaurant after the features label boundary', () => {
  const start = source.indexOf('      updatePhoneVideo(');
  const call = source.slice(start, source.indexOf('\n      applyTransform(', start));
  for (const phoneDemo of ['trouvable', 'sauge-noire']) {
    const scope = {
      state: { section: 'features', phoneDemo, transition: { from: 'wearable', to: 'features', progress: 0.75 } },
      phoneRoot: { visible: true }, pose: { phoneScale: 0.2 },
      updatePhoneVideo: (_playing, demo) => { scope.actual = demo; },
    };
    vm.runInNewContext(call, scope);
    assert.equal(scope.actual, phoneDemo, 'a still-visible phone must not switch back to Maison Élyse');
  }
});

test('mobile toolbar room height does not change chapter transition scroll budgets', () => {
  const { measurements, opening } = geometry(700);
  const compact = director.measureChapterTransitions(measurements, { ...opening, stageHeight: 700, sceneHeight: 700 });
  const tallRoom = director.measureChapterTransitions(measurements, { ...opening, stageHeight: 700, sceneHeight: 900 });
  assert.deepEqual(tallRoom, compact, 'transition distance belongs to the frozen sticky stage, not the larger room canvas');
});

test('shorter video chapter removes excess holds without accelerating its card transitions', () => {
  const app = readFileSync('components/immersive/App.jsx', 'utf8');
  const transitions = JSON.parse(app.match(/const SOCIAL_TRANSITIONS = (\[[^;]+\]);/)[1]);
  const socialHeight = Number(app.match(/id="social-content"\s+height=\{(\d+)\}/)[1]);
  const useful = socialHeight / 100 - 1;
  assert.ok(useful >= 4.2 && useful <= 4.5);
  for (const [start, end] of transitions) assert.ok((end - start) * useful >= 0.42, 'horizontal menu changes must keep their prior ~0.43-screen movement budget');
  const centers = JSON.parse(app.match(/const SOCIAL_HOLD_CENTERS = (\[[^;]+\]);/)[1]);
  for (let i = 0; i < centers.length; i++) {
    assert.ok(centers[i] > (i ? transitions[i - 1][1] : 0));
    assert.ok(centers[i] < (i < 2 ? transitions[i][0] : 1));
  }
});
