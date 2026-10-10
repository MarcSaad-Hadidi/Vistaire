import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';

const source = readFileSync(process.env.VISTAIRE_SCENE_SOURCE || 'components/immersive/Scene.jsx', 'utf8');
function between(start, end, text = source) {
  const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `production boundary: ${start} → ${end}`);
  return text.slice(a, b);
}
function productionFunction(name) {
  const code = source.match(new RegExp(`    function ${name}\\([^]*?\\n    }`))?.[0];
  assert.ok(code, `production ${name} function`);
  return code;
}

// Execute the real scheduler control flow, including the render/fit gate and
// readiness checks. Model/material updates and GPU submission are irrelevant to
// RAF ownership; existing camera-fit tests exercise the real fitting math.
function fixture() {
  const pending = new Map();
  let nextFrame = 0, time = 0, renders = 0, onFit;
  const state = { section: 'hero', progress: 0, scrollDistance: 0 };
  const pose = { look: [0, 0, 0], table: 1 };
  const roots = {};
  for (const name of ['support', 'phone', 'dish', 'laptop']) {
    roots[`${name}Root`] = new THREE.Group();
    pose[name] = [0, 0, 0];
    pose[`${name}Rotation`] = [0, 0, 0];
    pose[`${name}Scale`] = 1;
  }
  const scope = {
    THREE, ...roots, pose, stateRef: { current: state }, sceneState: state, initialState: state,
    document: { hidden: false }, canvas: { dataset: {} }, diagnosticsEnabled: false,
    requestAnimationFrame: callback => { pending.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: id => pending.delete(id),
    callbacks: { current: { onError: error => { throw error; } } },
    camera: new THREE.PerspectiveCamera(), cameraTarget: new THREE.Vector3(), lookAt: new THREE.Vector3(),
    objectTarget: new THREE.Vector3(), targetEuler: new THREE.Euler(), targetQuaternion: new THREE.Quaternion(),
    woodMaterial: { opacity: 1 }, laptopAsset: { settled: true }, roomSettling: false, projectionSettling: false,
    phoneVideo: { paused: true, requestVideoFrameCallback() {}, pause() { this.paused = true; } },
    videoPlaying: false, phonePlaybackWanted: false, canPlayPhoneVideo: () => false,
    pausePhoneVideo: () => scope.phoneVideo.pause(), resize() {}, phoneVideoEvents: [],
    particles: { visible: false }, shadowInvalidated: false, posterReady: false, videoReady: false,
    wasOccluded: false, renderSignature: '', previousShadowSignature: '', lastSceneChange: 16,
    frameSubjects: (_state, damping) => onFit?.(damping), submit: () => renders++,
    recordProcessedPose() {},
  };
  vm.createContext(scope);
  const run = code => vm.runInContext(code, scope);
  run(between('    let disposed = false;', '    const ownedTextures ='));
  run('renderer = { shadowMap: {} }; arExperience = { active: false }; ready = true;');
  if (source.includes('    function invalidateScene(')) {
    run(between('    function invalidateScene(', '    function fail('));
  }
  run(productionFunction('fail'));
  const draw = productionFunction('draw');
  run([
    between('    function draw(', '      // A genuine responsive-width change', draw),
    between('      const settled =', '          const layerKey =', draw),
    '          submit();\n        }',
    draw.slice(draw.indexOf('        if (\n          !ready &&')),
  ].join('\n'));
  run(productionFunction('visibilityChanged'));
  run(between('    Object.assign(stateRef.current, {', '    canvas.addEventListener("webglcontextlost", contextLost);'));
  const lifecycle = source.slice(source.indexOf('    document.addEventListener("visibilitychange", visibilityChanged);'));
  run(between('    document.addEventListener("visibilitychange", visibilityChanged);', '\n\n    return () =>', lifecycle).split('\n').slice(1).join('\n'));
  return {
    scope, state, run, pending,
    get renders() { return renders; },
    fit(callback) { onFit = callback; },
    wake() {
      assert.equal(typeof state.invalidateScene, 'function', 'Scene publishes its own invalidation callback');
      state.invalidateScene();
    },
    step(now = time + 16) {
      assert.equal(pending.size, 1, 'exactly one Scene RAF owns the update');
      time = now;
      const [id, callback] = pending.entries().next().value;
      pending.delete(id);
      callback(time);
    },
    dispose() { run(between('      disposed = true;', '      assetRequest?.abort();', lifecycle)); },
  };
}

test('Scene coalesces real wakes, finishes fresh fitting, and sleeps while waiting for assets', () => {
  const f = fixture();
  f.step();
  assert.equal(f.renders, 1, 'initial wake renders');
  assert.equal(f.pending.size, 0, 'a static scene must stop its complete callback loop');
  assert.equal(f.run('lastTime'), 0, 'sleep clears the damping clock');

  f.wake(); f.wake(); f.wake();
  f.step(60_000);
  assert.equal(f.renders, 2, 'dirty wake renders even when the geometry signature is unchanged');
  assert.equal(f.pending.size, 0);

  f.run('ready = false');
  f.state.sceneOccluded = true;
  f.wake(); f.step();
  assert.equal(f.pending.size, 0, '!ready alone must not poll for a download');
  f.scope.canvas.dataset.supportReady = 'true';
  f.scope.canvas.dataset.phoneReady = 'true';
  f.scope.canvas.dataset.restaurantReady = 'true';
  f.scope.posterReady = true;
  f.run('activeDish = {}; stoneReady = true');
  f.wake(); f.step();
  assert.equal(f.scope.canvas.dataset.ready, 'true', 'an asset completion wake finishes readiness');
  if (f.pending.size) f.step();
  assert.equal(f.scope.canvas.dataset.suspended, 'true', 'direct pricing entry suspends after its final essential asset');
  assert.equal(f.pending.size, 0);
  f.state.sceneOccluded = false;
  f.wake(); f.step();

  f.scope.roomSettling = true;
  f.wake(); f.step();
  assert.equal(f.pending.size, 1, 'unfinished authored changes keep the loop alive');
  f.scope.roomSettling = false;
  f.step();
  assert.equal(f.pending.size, 0);

  f.scope.particles.visible = true;
  f.wake(); f.step();
  assert.equal(f.pending.size, 1, 'eligible time-driven animation continues');
  f.state.reducedMotion = true;
  f.wake(); f.step();
  assert.equal(f.pending.size, 0, 'reduced motion ends animation-driven continuation');
  f.state.reducedMotion = false;
  f.scope.particles.visible = false;

  let fits = 0;
  f.fit(() => { f.scope.projectionSettling = ++fits === 1; });
  f.wake(); f.step();
  assert.equal(f.pending.size, 1, 'fresh frameSubjects convergence schedules its next update');
  f.step();
  assert.equal(fits, 2);
  assert.equal(f.scope.canvas.dataset.settled, 'true', 'settled marker uses the completed fit');
  assert.equal(f.pending.size, 0, 'the previous fit must not add an extra polling frame');

  const before = f.renders;
  f.fit(() => { f.fit(); f.wake(); f.wake(); });
  f.wake(); f.step();
  assert.equal(f.pending.size, 1, 'an invalidation during draw is retained and coalesced');
  f.step();
  assert.equal(f.renders, before + 2, 'the newer invalidation forces its own render');
  assert.equal(f.pending.size, 0);
});

test('Scene clears stale XR handles and guards hidden, opaque, failed, and disposed wakes', () => {
  const f = fixture();
  f.run('arExperience.active = true');
  f.step();
  assert.equal(f.run('frame'), 0, 'XR must clear the consumed Scene RAF before its early return');
  f.wake();
  assert.equal(f.pending.size, 0, 'an asset wake must not compete with XR');
  f.run('arExperience.active = false');
  f.wake(); f.step();
  assert.equal(f.pending.size, 0);

  f.wake();
  f.scope.document.hidden = true;
  f.scope.visibilityChanged();
  assert.equal(f.pending.size, 0, 'hide cancels the pending RAF');
  f.wake();
  assert.equal(f.pending.size, 0, 'completion callbacks stay asleep while hidden');
  assert.equal(f.run('lastTime'), 0);
  f.scope.document.hidden = false;
  let resumedDamping;
  f.fit(damping => { resumedDamping = damping; });
  f.scope.visibilityChanged(); f.step(60_000);
  assert.ok(Math.abs(resumedDamping - (1 - Math.exp(-10 / 60))) < 1e-12, 'resume starts with a normal frame of damping');
  assert.equal(f.pending.size, 0);

  f.state.sceneOccluded = true;
  const before = f.renders;
  f.wake(); f.step();
  assert.equal(f.renders, before, 'opaque pricing submits no graphics');
  f.wake(); f.wake();
  assert.equal(f.pending.size, 0, 'scrolling within default opaque pricing does not poll');
  f.state.sceneOccluded = false;
  f.wake(); f.step();
  assert.equal(resumedDamping, 1, 'reveal uses the latest pose immediately');
  assert.equal(f.pending.size, 0);

  f.wake();
  f.scope.callbacks.current.onError = () => {};
  f.scope.fail(new Error('context lost'));
  f.wake();
  assert.equal(f.pending.size, 0, 'failure cancels work and cannot be restarted');
  const disposed = fixture();
  const lateWake = disposed.state.invalidateScene;
  assert.equal(typeof lateWake, 'function');
  disposed.dispose(); lateWake();
  assert.equal(disposed.pending.size, 0, 'teardown cancels work and late callbacks cannot restart it');
});
