import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import postcss from 'postcss';
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

// Run App's actual measurement/update closure; only the browser geometry and
// React setters are fixtures, so frame-map allocation is observed end to end.
function appScrollFixture() {
  const app = readFileSync('components/immersive/App.jsx', 'utf8');
  const { opening, measurements } = geometry(844);
  const style = () => ({ setProperty(name, value) { this[name] = value; } });
  const scope = {
    ...director, scrollY: 0, innerWidth: 390, location: { hash: '' },
    clamp: value => Math.max(0, Math.min(1, value)),
    SOCIAL_TRANSITIONS: director.socialTiming().transitions,
    chapters: ids.map(id => [id]), sectionRefs: { current: {} },
    stateRef: { current: {} }, scrollTargets: { current: {} }, guideDismissed: { current: true },
    setGuideVisible() {}, setChapter() {}, setChapterBeats() {},
    getComputedStyle: () => ({ height: '844px' }),
  };
  const world = { clientHeight: 932, dataset: {}, style: style() };
  scope.document = { querySelector: () => world, documentElement: { dataset: {} } };
  scope.openingRef = { current: {
    firstElementChild: { style: style() },
    getBoundingClientRect: () => ({ top: -scope.scrollY, height: opening.height }),
  } };
  for (const m of measurements) {
    const focus = { left: 30, width: 300, height: 400 };
    const stage = { style: style(), getBoundingClientRect: () => ({ top: m.top - scope.scrollY, height: 844 }) };
    const attributes = new Map();
    scope.sectionRefs.current[m.id] = {
      firstElementChild: stage, dataset: {}, style: style(), offsetHeight: m.travel + 844, focus,
      getBoundingClientRect: () => ({ top: m.top - scope.scrollY, height: m.travel + 844 }),
      querySelector: () => ({ getBoundingClientRect: () => ({ ...focus, top: m.top - scope.scrollY + 100 }) }),
      getAttribute: name => attributes.get(name), setAttribute: (name, value) => attributes.set(name, value),
    };
  }
  const start = app.indexOf('    let ticking = false;');
  const end = app.indexOf('    const queue = () => {', start);
  assert.ok(start >= 0 && end > start, 'execute App measurement and scroll update functions');
  vm.runInNewContext(app.slice(start, end) + '\nthis.measure = measure; this.update = update;', scope);
  scope.measure();
  return { scope, world, opening, measurements, state: scope.stateRef.current };
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
      timing: director.CINEMATIC_TIMING,
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

test('App reuses sceneFrames between measurement batches and replaces them after geometry changes', () => {
  const f = appScrollFixture();
  f.scope.scrollY = f.measurements[3].top;
  f.scope.update();
  const first = f.state.sceneFrames;
  const originalX = first.features.x;
  f.scope.scrollY += 10;
  f.scope.update();
  assert.equal(f.state.sceneFrames, first, 'scroll alone must not allocate a new scene-frame map');
  f.scope.sectionRefs.current.features.focus.left += 20;
  f.scope.measure();
  f.scope.update();
  assert.notEqual(f.state.sceneFrames, first, 'a geometry remeasure publishes a fresh scene-frame map');
  assert.ok(Math.abs(f.state.sceneFrames.features.x - originalX - 20 / 390) < 1e-12);
  assert.equal(first.features.x, originalX, 'the previous measurement batch is not mutated');
});

test('identities surface follows copy visibility over the full world without changing its sticky stage', () => {
  const f = appScrollFixture();
  const chapter = f.measurements.find(m => m.id === 'testimonies');
  const windows = director.measureChapterTransitions(f.measurements, f.opening);
  const incoming = windows.find(w => w.to.id === chapter.id);
  const outgoing = windows.find(w => w.from.id === chapter.id);
  const el = f.scope.sectionRefs.current.testimonies;
  const positions = [incoming, outgoing].flatMap(w => [0, 0.25, 0.5, 0.75, 1].map(p => w.start + (w.end - w.start) * p));
  for (const y of [...positions, ...positions.toReversed()]) {
    f.scope.scrollY = y;
    f.scope.update();
    const alpha = director.cinematicCopyWeights((y - incoming.start) / (incoming.end - incoming.start)).incoming
      * director.cinematicCopyWeights((y - outgoing.start) / (outgoing.end - outgoing.start)).outgoing;
    assert.equal(el.style['--copy-opacity'], String(alpha), 'retain the existing chapter copy envelope');
    assert.equal(f.world.style['--identities-opacity'], el.style['--copy-opacity'], 'world surface must receive the actual copy alpha, including zero');
    assert.equal(el.firstElementChild.style.translate, `0 ${director.cinematicStageOffset(chapter, y, incoming.start, outgoing.end)}px`);
  }
  const css = postcss.parse(readFileSync('components/immersive/styles.css', 'utf8'));
  const declarations = selector => {
    const values = {};
    css.walkRules(rule => {
      if (rule.parent.type !== 'root' || !rule.selectors.includes(`:where([data-immersive-vistaire]) ${selector}`)) return;
      rule.walkDecls(decl => { values[decl.prop] = decl.value; });
    });
    return values;
  };
  const surface = declarations('.world::before');
  assert.equal(surface.content, '""');
  assert.equal(surface.position, 'absolute');
  assert.equal(surface.inset, '0', 'the surface fills the dynamic world, not the shorter frozen stage');
  assert.equal(surface['pointer-events'], 'none');
  assert.equal(surface['z-index'], '1');
  assert.equal(surface.background, '#11111066', 'retain the authored identities color and strength');
  assert.match(surface.opacity, /^var\(--identities-opacity,\s*0\)$/);
  assert.equal(declarations('.world')['z-index'], '0');
  assert.equal(declarations('main')['z-index'], '2');
  assert.equal(declarations('footer.chapter')['z-index'], '2');
  assert.equal(declarations('.site-header')['z-index'], '50');
  assert.ok([undefined, 'none', 'transparent'].includes(declarations('.identities .stage').background), 'the translated stage must not retain a second surface');
  const stage = declarations('.stage');
  assert.equal(stage.position, 'sticky');
  assert.equal(stage.height, 'calc(100 * var(--journey-vh))');
});

// The physical stage and natural pricing/footer stay fixed while paced chapter
// travel changes. This is one geometry fixture, not another viewport matrix.
function pacedGeometry(timing) {
  const stageHeight = 844;
  const opening = {
    top: 17.5, stageHeight, sceneHeight: 932,
    motionTravel: timing.openingMotionScreens * stageHeight,
    height: (1 + timing.openingMotionScreens + timing.phoneHoldScreens + timing.openingReleaseScreens) * stageHeight,
  };
  opening.travel = opening.height - stageHeight;
  let top = opening.top + opening.height;
  const measurements = ids.map((id, i) => {
    if (i < 3) return { id, top: opening.top + opening.motionTravel * i / 2, travel: 1 };
    const travel = stageHeight * (i < 10 ? timing.sceneScreens : i === 10 ? 2.5 : 0.1);
    const item = { id, top, travel };
    top += travel + stageHeight;
    return item;
  });
  return { opening, measurements, viewportHeight: 932 };
}
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-7, `${message}: ${actual} != ${expected}`);

test('selected physical timing changes measured joins and anchors while preserving the opening phone hold', () => {
  // Explicit faster timing makes old helpers fail behaviorally by ignoring the
  // optional argument, independently of whether the new timing factory exists.
  const timing = {
    activeScreens: 8 / 3, edgeScreens: 11 / 15, sceneScreens: 62 / 15,
    detailScreens: 0.704 * 2 / 3, phoneHoldScreens: 1,
    transitionScreens: 37 / 15, openingMotionScreens: 74 / 15,
    openingReleaseScreens: 11 / 15, chapterHeightVh: (1 + 62 / 15) * 100,
  };
  const { opening, measurements } = pacedGeometry(timing);
  const windows = director.measureChapterTransitions(measurements, opening, timing);
  for (const [i, window] of windows.entries()) {
    if (window.to.id !== 'footer') near(window.end - window.start, timing.transitionScreens * opening.stageHeight, `${window.from.id} selected transition length`);
    if (i) assert.ok(windows[i - 1].end <= window.start, 'paced windows must not overlap');
    const target = director.chapterNavigationTarget(window.to, opening.stageHeight, timing);
    near(target, window.to.id === 'footer' || window.to.id === 'open-weight' ? window.to.top : window.end, `${window.to.id} navigation target`);
  }
  near(windows[0].start - opening.top - opening.motionTravel, timing.phoneHoldScreens * opening.stageHeight, 'phone hold is complete before first join');
  const fallback = director.measureChapterTransitions(measurements, opening);
  assert.notEqual(windows[0].start, fallback[0].start, 'selected timing must affect real measured boundaries');
  near(windows.at(-1).end, measurements.at(-1).top, 'natural footer boundary');
});

test('scaled timing preserves the exact default and normalized chapter and social pager phases', () => {
  assert.equal(typeof director.scaledCinematicTiming, 'function', 'the approved timing factory is required');
  const base = director.CINEMATIC_TIMING;
  assert.equal(director.scaledCinematicTiming(), base);
  assert.equal(director.scaledCinematicTiming(1), base);
  const social = director.socialTiming();
  for (const pace of [0.75, 1.5]) {
    const factor = 1 / pace;
    const timing = director.scaledCinematicTiming(factor);
    assert.deepEqual(Object.keys(timing).sort(), Object.keys(base).sort());
    for (const key of ['activeScreens', 'edgeScreens', 'sceneScreens', 'detailScreens', 'phoneHoldScreens']) near(timing[key], base[key] * factor, key);
    near(timing.transitionScreens, 1 + 2 * timing.edgeScreens, 'the one-stage native crossing is not scaled');
    near(timing.openingMotionScreens, 2 * timing.transitionScreens, 'opening shares both transition distances');
    near(timing.chapterHeightVh, (1 + timing.sceneScreens) * 100, 'chapter retains a full physical sticky stage');
    near(timing.openingReleaseScreens, timing.edgeScreens, 'opening release');
    for (const phase of [0, 0.4, 1]) {
      const raw = (timing.edgeScreens + phase * timing.activeScreens) / timing.sceneScreens;
      near(director.chapterPhase('features', raw), phase, 'normalized chapter motion stays unchanged');
    }
    const hold = (timing.activeScreens - 2 * timing.detailScreens) / 3;
    const expectedCenters = [hold / 2, timing.activeScreens / 2, timing.activeScreens - hold / 2].map(distance => (timing.edgeScreens + distance) / timing.sceneScreens);
    social.centers.forEach((center, i) => near(center, expectedCenters[i], `social pager ${i} remains in its authored hold`));
    social.transitions.forEach(([start, end]) => near((end - start) * timing.sceneScreens, timing.detailScreens, 'social move uses scaled physical detail distance'));
  }
});

test('pace changes remap semantic position reversibly and prioritize visible natural pricing and footer pixels', () => {
  assert.equal(typeof director.remapJourneyScroll, 'function', 'pace changes need a semantic scroll remap');
  assert.equal(typeof director.scaledCinematicTiming, 'function');
  const snapshot = factor => {
    const timing = director.scaledCinematicTiming(factor);
    const result = pacedGeometry(timing);
    result.transitions = director.measureChapterTransitions(result.measurements, result.opening, timing);
    return result;
  };
  const before = snapshot(1);
  for (const factor of [1 / 1.5, 1 / 0.75]) {
    const after = snapshot(factor);
    const point = (view, id, fraction) => {
      const chapter = view.measurements.find(m => m.id === id);
      return chapter.top + chapter.travel * fraction;
    };
    const hold = view => view.opening.top + view.opening.motionTravel + 0.6 * (view.transitions[0].start - view.opening.top - view.opening.motionTravel);
    const blend = view => view.transitions[2].start + (view.transitions[2].end - view.transitions[2].start) * 0.65;
    const pairs = [
      [before.opening.top + before.opening.motionTravel * 0.3, after.opening.top + after.opening.motionTravel * 0.3, 'opening motion'],
      [hold(before), hold(after), 'finished phone hold'],
      [blend(before), blend(after), 'shared transition fraction'],
      [point(before, 'features', 0.55), point(after, 'features', 0.55), 'ordinary chapter progress'],
    ];
    for (const id of ['open-weight', 'footer']) for (const offset of [-before.viewportHeight * 0.6, 123]) {
      const oldChapter = before.measurements.find(m => m.id === id);
      const newChapter = after.measurements.find(m => m.id === id);
      pairs.push([oldChapter.top + offset, newChapter.top + offset, `${id} visible pixel offset ${offset}`]);
    }
    // Keep the pre-visible pricing interval continuous with pixel preservation
    // at its visibility threshold, including changes that cross branch priority.
    const pricingEntry = view => ({
      start: view.transitions.find(w => w.to.id === 'open-weight').start,
      end: view.measurements.find(m => m.id === 'open-weight').top - view.viewportHeight,
    });
    const oldEntry = pricingEntry(before), newEntry = pricingEntry(after);
    for (const offset of [-68, -0.25, 0, 0.25]) {
      const y = oldEntry.end + offset;
      const target = offset < 0
        ? newEntry.start + (y - oldEntry.start) / (oldEntry.end - oldEntry.start) * (newEntry.end - newEntry.start)
        : newEntry.end + offset;
      pairs.push([y, target, `pricing visibility boundary ${offset}`]);
    }
    for (const [y, target, label] of pairs) {
      near(director.remapJourneyScroll(y, before, before), y, `${label} identity remap`);
      const mapped = director.remapJourneyScroll(y, before, after);
      near(mapped, target, label);
      near(director.remapJourneyScroll(mapped, after, before), y, `${label} roundtrip`);
    }
  }
});
