import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import * as THREE from 'three';
import * as director from '../components/immersive/SceneDirector.js';

// Exercise the real authored object poses without requiring a WebGL context.
const source = readFileSync('components/immersive/Scene.jsx', 'utf8');
const context = { ...director, THREE, HALF_PI: Math.PI / 2, clamp: (v, a, b) => Math.min(b, Math.max(a, v)) };
vm.runInNewContext(source.slice(source.indexOf('function baseComposition('), source.indexOf('\nfunction composition(')) + ';this.base = baseComposition', context);
const ids = ['hero', 'ai', 'wearable', 'features', 'encryption', 'grip', 'sustainability', 'testimonies', 'social-content', 'product', 'open-weight', 'footer'];
function geometry(stage) {
  const opening = { top: 0, travel: stage * 9, motionTravel: stage * 6.4, height: stage * 10, stageHeight: stage, sceneHeight: stage };
  let top = opening.height;
  const measurements = ids.map((id, i) => {
    if (i < 3) return { id, top: stage * [0, 3.2, 6.4][i], travel: 1 };
    const travel = stage * [6.2, 6.2, 6.2, 6.2, 6.2, 6.2, 6.2, 4.6, 0.1][i - 3];
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

test('all measured cinematic joins use 3.2 stages and preserve the full phone hold', () => {
  assert.equal(typeof director.measureChapterTransitions, 'function', 'shared measured transition windows are required');
  for (const stage of [757, 800, 812, 844, 900, 932, 1080, 1440]) {
    const { measurements, opening } = geometry(stage);
    const transitions = director.measureChapterTransitions(measurements, opening);
    assert.equal(transitions.length, 9);
    assert.ok(Math.abs(transitions[0].start - opening.top - opening.motionTravel - stage * 1.5) < 1e-8);
    assert.equal(transitions.at(-1).end, measurements.at(-1).top);
    for (const [i, window] of transitions.entries()) {
      assert.ok(Math.abs(window.end - window.start - stage * 3.2) < 1e-8, `${window.from.id}: transition distance differs`);
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
    for (const p of [0, 0.25, 0.5, 0.75, 1]) assertC1(sample, p * opening.motionTravel, `opening@${p}`);
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

test('opening measurements use untransformed layout height without rounding fractions', () => {
  const app = readFileSync('components/immersive/App.jsx', 'utf8');
  const start = app.indexOf('    const measure = () => {');
  const end = app.indexOf('      measurements = chapters', start);
  assert.ok(start >= 0 && end > start, 'execute the actual opening measurement before chapter traversal');
  const reader = app.slice(start, end) + '\n      return opening;\n    }; measure();';
  for (const height of [844, 844.25]) {
    const stage = { getBoundingClientRect: () => ({ height: height + 0.001953125 }) };
    const opening = vm.runInNewContext(reader, {
      openingRef: { current: { firstElementChild: stage, getBoundingClientRect: () => ({ top: -42284, height: 8440 }) } },
      scrollY: 42284,
      world: { clientHeight: 844 },
      getComputedStyle: element => {
        assert.equal(element, stage);
        return { height: `${height}px` };
      },
      CINEMATIC_TIMING: director.CINEMATIC_TIMING,
    });
    assert.equal(opening.stageHeight, height, 'translated rect precision must not enter the cached stage height');
    assert.equal(opening.motionTravel, height * director.CINEMATIC_TIMING.openingMotionScreens);
    assert.equal(42284 / opening.stageHeight, 42284 / height, 'late remeasure preserves normalized distance');
  }
});

test('the shared curve and actual authored transition poses have bounded relative speed', () => {
  assert.equal(typeof director.cinematicEase, 'function');
  const N = 256;
  const weights = Array.from({ length: N + 1 }, (_, i) => director.cinematicEase(i / N));
  assert.equal(weights[0], 0);
  assert.equal(weights.at(-1), 1);
  const speeds = weights.slice(1).map((v, i) => (v - weights[i]) * N);
  assert.ok(speeds.every(v => v >= 0));
  assert.ok(Math.max(...speeds) <= 1.334, 'a transition must not regain the old 1.5× middle speed');
  for (const mobile of [false, true]) {
    const { measurements, opening } = geometry(900);
    for (const window of director.measureChapterTransitions(measurements, opening)) {
      const poses = Array.from({ length: N + 1 }, (_, i) => numbers(director.continuousComposition({
        transition: director.transitionAtScroll([window], window.start + (window.end - window.start) * i / N),
      }, mobile, context.base)));
      for (let field = 0; field < poses[0].length; field++) {
        const steps = poses.slice(1).map((pose, i) => Math.abs(pose[field] - poses[i][field]));
        const mean = steps.reduce((a, b) => a + b, 0) / N;
        if (mean < 1e-8) continue;
        assert.ok(Math.max(...steps) / mean <= 1.335, `${window.from.id}:${window.to.id} field ${field} has competing pose/transition velocity`);
      }
    }
  }
});

test('all seven chapters use the central budget and the three video holds remain ordered', () => {
  const app = readFileSync('components/immersive/App.jsx', 'utf8');
  assert.equal(director.CINEMATIC_TIMING.sceneScreens, 6.2);
  for (const id of ids.slice(3, 10)) {
    assert.match(app, new RegExp(`id="${id}"\\s+height=\\{CINEMATIC_TIMING.chapterHeightVh\\}`));
  }
  const { transitions, centers } = director.socialTiming();
  for (const [start, end] of transitions) assert.ok(Math.abs((end - start) * 6.2 - 0.704) < 1e-8);
  for (let i = 0; i < centers.length; i++) {
    assert.ok(centers[i] > (i ? transitions[i - 1][1] : 0));
    assert.ok(centers[i] < (i < 2 ? transitions[i][0] : 1));
  }
});

test('the laptop hinge consumes the shared presentation phase instead of a second short local window', () => {
  const laptop = readFileSync('components/immersive/LaptopModel.js', 'utf8');
  const expression = laptop.match(/const openingProgress = desiredReduced\s*\? 1\s*: ([^;]+);/)[1];
  const sample = progress => vm.runInNewContext(expression, { desiredProgress: progress, cinematicEase: director.cinematicEase, clamp: n => Math.max(0, Math.min(1, n)) });
  assert.equal(sample(0), 0);
  assert.equal(sample(1), 1);
  assert.ok(sample(0.9) < 1, 'the lid must not finish at 64% then create a long dead hold');
  const h = 1e-6;
  assert.ok((sample(h) - sample(0)) / h < 1e-3);
  assert.ok((sample(1) - sample(1 - h)) / h < 1e-3);
});

test('feature text swaps only at zero opacity and reverses without a flash', () => {
  assert.equal(typeof director.featureTextOpacity, 'function');
  for (const seam of [(1.1 + 4 / 3) / 6.2, (1.1 + 8 / 3) / 6.2]) {
    assert.ok(director.featureTextOpacity(seam) < 1e-12);
    assertC1(p => ({ opacity: director.featureTextOpacity(p / 3150) }), seam * 3150, 'feature copy');
    assert.ok(director.featureTextOpacity(seam - 0.02) > 0);
    assert.ok(director.featureTextOpacity(seam + 0.02) > 0);
  }
});

test('copy remains in its measured frame through native sticky pin and release', () => {
  assert.equal(typeof director.cinematicStageOffset, 'function');
  const chapter = { top: 9000, travel: 3150 };
  const start = chapter.top - 1350, end = chapter.top + chapter.travel + 1350;
  const nativeTop = y => y < chapter.top ? chapter.top - y : y <= chapter.top + chapter.travel ? 0 : chapter.top + chapter.travel - y;
  const sample = y => ({ top: nativeTop(y) + director.cinematicStageOffset(chapter, y, start, end) });
  for (const y of [chapter.top, chapter.top + chapter.travel]) assertC1(sample, y, 'text stage');
  for (const y of [start, chapter.top, chapter.top + chapter.travel, end]) assert.equal(sample(y).top, 0);
});

test('the common text envelope never overlays two headings and has smooth opacity handoffs', () => {
  assert.equal(typeof director.cinematicCopyWeights, 'function');
  for (let i = 0; i <= 100; i++) {
    const weights = director.cinematicCopyWeights(i / 100);
    assert.equal(weights.incoming * weights.outgoing, 0, 'headings must not ghost over each other');
  }
  for (const seam of [0, 900, 1800]) assertC1(y => director.cinematicCopyWeights(y / 1800), seam, 'copy envelope');
});


test('short natural pricing caps only its outgoing raccord without overlapping two poses', () => {
  const { measurements, opening } = geometry(900);
  const pricing = measurements.find(m => m.id === 'open-weight');
  const footer = measurements.at(-1);
  // Actual afbc desktop DOM height, not an artificially generous fixture.
  pricing.travel = 3643.703125 - 900;
  footer.top = pricing.top + 3643.703125;
  const windows = director.measureChapterTransitions(measurements, opening);
  assert.ok(windows.at(-1).start >= windows.at(-2).end);
  assert.equal(windows.at(-1).end, footer.top);
  assert.ok(Math.abs((windows.at(-1).end - windows.at(-1).start) / 900 - (3643.703125 / 900 - 1.1)) < 1e-8);
});

test('direct cinematic anchors land after the incoming fade with interactive content', () => {
  assert.equal(typeof director.chapterNavigationTarget, 'function');
  const { measurements, opening } = geometry(900);
  const windows = director.measureChapterTransitions(measurements, opening);
  for (const chapter of measurements.slice(3, 10)) {
    const y = director.chapterNavigationTarget(chapter, opening.stageHeight);
    const window = windows.find(w => w.to.id === chapter.id);
    assert.equal(director.cinematicCopyWeights((y - window.start) / (window.end - window.start)).incoming, 1);
    assert.ok(Math.abs(y - window.end) < 1e-8);
  }
  for (const chapter of measurements.slice(10)) assert.equal(director.chapterNavigationTarget(chapter, opening.stageHeight), chapter.top);
});
