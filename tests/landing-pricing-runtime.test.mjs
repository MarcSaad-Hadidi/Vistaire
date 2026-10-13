import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import { pricingStageAtScroll, pricingExitOffset } from '../components/immersive/PricingPhonePresenter.js';

function fixture() {
  const path = 'components/immersive/PricingSceneAdapter.js';
  assert.ok(existsSync(path), 'the shared renderer needs a scoped offers adapter');
  const counts = { load: 0, hand: 0, room: 0, warm: 0, reset: 0, release: 0, dispose: 0, invalidate: 0 };
  const hand = { ready: true, unavailable: false, preload() { counts.load++; },
    render(...args) { counts.hand++; hand.last = args; return true; },
    screenProjection: () => ({ matrix: [1, 0, 0, 1, 10, 20] }),
    screenIsVisible: () => true, reset() { counts.reset++; }, dispose() { counts.dispose++; } };
  let theme;
  const state = { sceneOccluded: false, pageScrollY: 0, pricingSectionTop: 10000,
    pricingStage: { dataset: {} }, pricingViewport: { width: 390, height: 844, introHeight: 4200 },
    pricingOffer: { collection: 'acrylique' }, presentPricingScreen(...value) { state.presented = value; },
    syncPricingScroll() { state.fallback = true; } };
  const world = { dataset: {} };
  const canvas = { dataset: {}, width: 780, height: 1688 };
  const renderer = { domElement: canvas, info: { reset() {} } };
  const room = { draw() { counts.room++; }, warm() { counts.warm++; }, release() { counts.release++; }, dispose() { counts.dispose++; } };
  const timers = [];
  const scope = vm.createContext({
    createPricingHandScene: () => hand,
    createPricingRoomBackdrop: () => room,
    pricingStageAtScroll, pricingExitOffset,
    pricingHandProgress: (top, height, reduce) => reduce ? 1 : Math.max(0, Math.min(1, -top / (height * .9))),
    pricingLightTheme: () => false, subscribePricingTheme: callback => { theme = callback; return () => {}; },
    console, setTimeout: callback => timers.push(callback), clearTimeout: id => { timers[id - 1] = null; },
  });
  const source = readFileSync(path, 'utf8').replace(/import[^;]+;\n/g, '').replace('export function', 'function');
  vm.runInContext(source, scope);
  const adapter = scope.createPricingSceneAdapter({ renderer, phoneRoot: {}, scene: {}, camera: {}, environment: {},
    world, stateRef: { current: state }, invalidate: () => counts.invalidate++ });
  const size = { width: 390, height: 844 };
  return { adapter, state, counts, hand, room, world, canvas, size, theme: value => theme(value), flush: () => timers.splice(0).forEach(callback => callback?.()) };
}

test('offers wake the shared renderer only near their measured stage and reverse from an idle FAQ', () => {
  const app = readFileSync('components/immersive/App.jsx', 'utf8');
  const footer = app.slice(app.indexOf('        as="footer"'), app.indexOf('      <AdaptiveScrollGuide'));
  assert.doesNotMatch(footer, /footer-main|footer-scene/, 'the source compact footer removes the former giant CTA and empty product stage');
  assert.match(footer, /id="footer-title" className="sr-only"/, 'retain the footer accessible name');
  const boundary = app.slice(app.indexOf('      const pricing = measurements.find'), app.indexOf('      stateRef.current.scrollDistance ='));
  const stateRef = { current: {} };
  vm.runInNewContext(boundary, { measurements: [{ id: 'open-weight', top: 10000, travel: 4200 }], y: 18000, stateRef });
  assert.equal(stateRef.current.sceneOccluded, true, 'the source footer keeps the completed lower room, not a skipped main-camera transition');
  const f = fixture();
  assert.equal(f.adapter.needsPreparation(), true, 'first entry must apply its canonical room pose');
  assert.equal(f.adapter.draw(f.state, f.size, true), false);
  assert.equal(f.counts.load, 0, 'hero must not request hand resources');
  assert.equal(f.counts.warm, 0, 'hero must not link offscreen room programs');
  f.state.pageScrollY = 9000;
  f.adapter.draw(f.state, f.size, true);
  assert.equal(f.counts.load, 0, 'approaching pricing never warms up inside a moving frame');
  f.flush();
  assert.equal(f.counts.load, 1, 'warm-up runs once frames rest near the offers');
  assert.ok(f.counts.warm > 0, 'capture-target room programs link before the first cached capture');
  f.state.pageScrollY = 10400; f.state.sceneOccluded = true;
  assert.equal(f.adapter.needsFrame(f.state), true, 'native scroll must wake a previously occluded renderer');
  assert.equal(f.adapter.draw(f.state, f.size, true), true);
  assert.equal(f.state.presented[2], true);
  assert.equal(f.state.pricingStage.dataset.handReady, 'true');
  assert.equal(f.adapter.needsPreparation(), false, 'reading reuses the prepared room');
  assert.ok(f.hand.last[1] > 0 && f.hand.last[1] < 1);
  f.state.pageScrollY = 14500;
  assert.equal(f.adapter.needsFrame(f.state), true, 'first exit must erase the hand');
  assert.equal(f.adapter.draw(f.state, f.size, true), false);
  assert.equal(f.state.presented[2], false);
  assert.equal(f.state.pricingStage.dataset.handReady, undefined, 'a hidden or exited hand cannot satisfy the next entry readiness wait');
  assert.equal(f.adapter.needsFrame(f.state), false, 'unchanged FAQ does not poll');
  const draws = f.counts.room;
  f.adapter.draw(f.state, f.size, true);
  assert.equal(f.counts.room, draws, 'unchanged FAQ does not redraw its room');
  f.state.pageScrollY = 11000;
  assert.equal(f.adapter.needsFrame(f.state), true);
  f.adapter.draw(f.state, f.size, true);
  assert.ok(f.counts.reset > 0, 'reverse entry invalidates the hand after a room-only frame');
  f.state.reducedMotion = true;
  f.adapter.draw(f.state, f.size, true);
  assert.equal(f.hand.last[1], 1);
  f.state.sceneOccluded = false; f.state.pageScrollY = 8500;
  f.adapter.draw(f.state, f.size, true);
  assert.equal(f.world.dataset.pricingActive, 'false');
  assert.equal(f.state.pricingStage.dataset.handReady, undefined, 'hero navigation clears prior projected-hand readiness');
  assert.ok(f.counts.release > 0);
  f.adapter.dispose();
  assert.equal(f.counts.dispose, 2);
  assert.equal(f.state.pricingScreenHit, undefined);
});

test('asset failure preserves semantic fallback and theme or resize wakes repaint once', () => {
  const f = fixture();
  f.state.pageScrollY = 10400; f.state.sceneOccluded = true;
  f.hand.unavailable = true; f.hand.ready = false;
  f.adapter.draw(f.state, f.size, true);
  assert.equal(f.state.pricingHandUnavailable, true);
  assert.equal(f.state.fallback, true, 'failed photo cannot leave invisible offers');
  f.state.pageScrollY = 14500;
  f.adapter.draw(f.state, f.size, true);
  const room = f.counts.room;
  f.theme(true);
  assert.equal(f.counts.invalidate, 1);
  assert.equal(f.adapter.needsFrame(f.state), true);
  f.adapter.draw(f.state, f.size, true);
  assert.equal(f.counts.room, room + 1);
  assert.equal(f.adapter.needsFrame(f.state), false);
  f.canvas.width = 1688; f.canvas.height = 780;
  assert.equal(f.adapter.needsFrame(f.state), true, 'rotating inside FAQ cannot leave an empty drawing buffer');
  f.adapter.draw(f.state, { width: 844, height: 390 }, true);
  assert.equal(f.counts.room, room + 2);
  for (const failure of ['render', 'projection', 'room']) {
    const broken = fixture();
    broken.state.pageScrollY = 10400; broken.state.sceneOccluded = true;
    broken.adapter.draw(broken.state, broken.size, true);
    if (failure === 'render') broken.hand.render = () => { throw new Error('hand draw failed'); };
    if (failure === 'projection') broken.hand.screenProjection = () => { throw new Error('screen missing'); };
    if (failure === 'room') {
      broken.hand.unavailable = true;
      broken.room.draw = () => { throw new Error('room draw failed'); };
    }
    assert.doesNotThrow(() => broken.adapter.draw(broken.state, broken.size, true), failure);
    assert.equal(broken.state.pricingHandUnavailable, true, failure);
    assert.equal(broken.state.fallback, true, `${failure} still exposes real offer links`);
    assert.equal(broken.state.pricingStage.dataset.handReady, undefined);
    if (failure !== 'room') assert.ok(broken.counts.room > 0, 'a stale GPU aperture must be cleared before the CSS phone appears');
  }
});

// WebGL submission is the boundary: exercise the real target/cache owner with
// actual Three objects, preserving renderer state even on incomplete targets.
test('room cache checks target support, reuses allocation, and restores borrowed renderer state on failure', async () => {
  const THREE = await import('three');
  const { createPricingRoomBackdrop } = await import('../components/immersive/PricingRoomBackdrop.js');
  for (const floatSupported of [true, false]) {
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
    camera.layers.set(1);
    const originalTarget = { name: 'previous' }, view = new THREE.Vector4(2, 3, 400, 800), scissor = new THREE.Vector4(4, 5, 100, 200);
    const originalShaderError = () => {};
    let currentTarget = originalTarget, scissorTest = true, status = 1, cacheTarget, captures = 0, releases = 0;
    const renderer = {
      domElement: { width: 800, height: 1600 }, autoClear: false, shadowMap: { needsUpdate: true },
      extensions: { has: () => floatSupported }, debug: { onShaderError: originalShaderError },
      getContext: () => ({ FRAMEBUFFER: 0, FRAMEBUFFER_COMPLETE: 1, checkFramebufferStatus: () => status }),
      getRenderTarget: () => currentTarget, setRenderTarget: value => { currentTarget = value; },
      getViewport: out => out.copy(view), setViewport: (...args) => args[0]?.isVector4 ? view.copy(args[0]) : view.set(...args),
      getScissor: out => out.copy(scissor), setScissor: value => scissor.copy(value),
      getScissorTest: () => scissorTest, setScissorTest: value => { scissorTest = value; },
      render(rendered) {
        if (rendered === scene) {
          captures++;
          if (!cacheTarget) { cacheTarget = currentTarget; cacheTarget.addEventListener('dispose', () => releases++); }
        }
      },
    };
    const room = createPricingRoomBackdrop({ renderer, scene, camera });
    const restored = () => {
      assert.equal(currentTarget, originalTarget);
      assert.deepEqual(view.toArray(), [2, 3, 400, 800]);
      assert.deepEqual(scissor.toArray(), [4, 5, 100, 200]);
      assert.equal(scissorTest, true); assert.equal(renderer.autoClear, false);
      assert.equal(renderer.shadowMap.needsUpdate, true); assert.equal(camera.layers.mask, 2);
      assert.equal(renderer.debug.onShaderError, originalShaderError);
    };
    if (!floatSupported) {
      assert.throws(() => room.draw(400, 800), /float/i, 'unsupported HDR selects semantic fallback, never clipped RGBA8');
      restored(); room.dispose(); continue;
    }
    room.draw(400, 800); restored();
    assert.equal(cacheTarget.texture.type, THREE.HalfFloatType);
    room.draw(400, 800); restored();
    assert.equal(captures, 1, 'unchanged output reuses the restaurant capture');
    renderer.domElement.width = 1600; renderer.domElement.height = 800;
    room.draw(800, 400); restored();
    assert.equal(captures, 2);
    room.release(); assert.equal(cacheTarget.width, 1); assert.equal(cacheTarget.height, 1);
    status = 0;
    assert.throws(() => room.draw(800, 400), /framebuffer/i, 'an incomplete target must select semantic fallback rather than a black rendered success');
    restored();
    status = 1;
    room.draw(800, 400); restored();
    assert.equal(captures, 3, 'a later valid entry can capture again');
    room.dispose(); assert.ok(releases >= 3);
  }
});

test('shader warm-up never leaves a compileAsync polling timer that can outlive disposal', () => {
  // three 0.183 compileAsync polls properties.get(material).currentProgram.isReady()
  // from setTimeout; after material/renderer disposal that throws uncaught.
  for (const path of ['components/immersive/Scene.jsx', 'components/immersive/PricingRoomBackdrop.js', 'components/immersive/PricingHandScene.js'])
    assert.doesNotMatch(readFileSync(path, 'utf8'), /\.compileAsync\b/, path);
});
