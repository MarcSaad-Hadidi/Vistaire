import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const { createLaptopModel } = await import(pathToFileURL(resolve(process.env.VISTAIRE_LAPTOP_SOURCE || 'components/immersive/LaptopModel.js')));
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
function fixture({ section = 'hero', laptopFactory, laptopSignals = false } = {}) {
  const pending = new Map();
  let nextFrame = 0, time = 0, renders = 0, onFit;
  const state = { section, progress: 0, scrollDistance: 0 };
  const pose = { look: [0, 0, 0], table: 1 };
  const roots = {};
  for (const name of ['support', 'phone', 'dish', 'laptop']) {
    roots[`${name}Root`] = new THREE.Group();
    pose[name] = [0, 0, 0];
    pose[`${name}Rotation`] = [0, 0, 0];
    pose[`${name}Scale`] = 1;
  }
  const scope = {
    THREE, ...roots, pose, scene: new THREE.Scene(), disposeTree() {},
    createLaptopModel: laptopFactory || (() => ({ root: roots.laptopRoot, settled: true, load() {} })),
    stateRef: { current: state }, sceneState: state, initialState: state,
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
    viewportRevision: 0, cameraInteractive: false, pointer: { x: 0, y: 0 }, phoneFrame: 0,
    nativeTable: null, foregroundLayerKey: '',
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
  run(between('    const laptopAsset = createLaptopModel(', '    let posterReady ='));
  run(between('    const initialState = stateRef.current', '    const initial = composition('));
  const draw = productionFunction('draw');
  run([
    between('    function draw(', '      // A genuine responsive-width change', draw),
    laptopSignals ? between('      const geometrySignature =', '      const settled =', draw) : '',
    between('      const settled =', '          const layerKey =', draw),
    laptopSignals ? between('          const layerKey =', '          renderer.info.reset();', draw) : '',
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


test('active draw retains lifecycle and render counters without serializing default pose diagnostics', () => {
  for (const diagnosticsEnabled of [false, true]) {
    const roots = Object.fromEntries(['dish', 'support', 'phone', 'laptop'].map(name => [`${name}Root`, new THREE.Group()]));
    const scope = {
      ...roots, THREE, diagnosticsEnabled, canvas: { dataset: { model: 'homard' } },
      camera: new THREE.PerspectiveCamera(), lookAt: new THREE.Vector3(), authoredCamera: new THREE.Vector3(),
      pose: { dishOpacity: 1 }, state: { section: 'hero' }, contactShadow: new THREE.Group(),
      renderer: { info: { reset() {}, render: { calls: 2, triangles: 10, frame: 1 } }, shadowMap: { needsUpdate: false }, render() {}, setScissorTest() {} },
      scene: new THREE.Scene(), performance: { now: () => 1 },
    };
    vm.createContext(scope);
    vm.runInContext(between('      camera.lookAt(lookAt);', '      const roomSettling ='), scope);
    vm.runInContext(between('      contactShadow.scale.setScalar(', '      woodMaterial.opacity ='), scope);
    vm.runInContext(between('          renderer.info.reset();', '\n        }\n        if (\n          !ready'), scope);
    for (const key of ['cameraPosition', 'supportPosition', 'phoneQuaternion', 'dishScale', 'laptopPosition', 'dishOpacity', 'openingProgress', 'tableCameraPosition', 'roomCameraPosition'])
      assert.equal(key in scope.canvas.dataset, diagnosticsEnabled, `${key}: pose serialization requires diagnostics`);
    for (const key of ['renderCPUms', 'drawCalls', 'triangles', 'frames', 'renderedModel', 'shadowUpdated'])
      assert.ok(key in scope.canvas.dataset, `${key}: lightweight benchmark marker is retained`);
  }
  const f = fixture();
  f.step();
  for (const key of ['section', 'progress', 'settled', 'suspended'])
    assert.ok(key in f.scope.canvas.dataset, `${key}: lifecycle marker is retained`);
});

test('detached phone video loads and switches demos at normal playback speed', () => {
  let loads = 0, pauses = 0, resets = 0;
  const phoneVideo = { defaultPlaybackRate: 1, playbackRate: 1, readyState: 0, currentTime: 0,
    pause() { pauses++; }, load() { loads++; } };
  const scope = {
    phoneVideo, canvas: { dataset: {} }, videoReady: false, videoStarted: false,
    currentPhoneDemo: '', phonePlayIntent: 0, phonePlaybackWanted: false, videoPlaying: false,
    selectPoster() {}, cancelPhoneFrame() {}, requestPhoneFrame() {},
    phonePlayback: { reset() { resets++; }, play() {} },
  };
  vm.createContext(scope);
  vm.runInContext(productionFunction('updatePhoneVideo'), scope);
  scope.updatePhoneVideo(true, 'maison-elyse');
  assert.equal(phoneVideo.defaultPlaybackRate, 1, 'detached video has no DOM effect that can correct its default rate');
  assert.equal(phoneVideo.playbackRate, 1, 'decode workload must follow normal-speed playback');
  scope.updatePhoneVideo(true, 'maison-elyse');
  assert.equal(loads, 1, 'unchanged demo does not reload');
  scope.updatePhoneVideo(true, 'sauge-noire');
  assert.equal(phoneVideo.src, '/videos/demo/sauge-noire.mp4');
  assert.equal(phoneVideo.defaultPlaybackRate, 1);
  assert.equal(phoneVideo.playbackRate, 1);
  assert.equal(loads, 2);
  assert.equal(pauses, 2);
  assert.equal(resets, 2);
});


test('Scene requests the real laptop only on forward, direct or reverse chapter demand', async t => {
  const cases = [
    ['forward', 'hero', { section: 'grip' }],
    ['direct', 'sustainability', null],
    ['reverse', 'pricing', { section: 'testimonies' }],
    ['transition-in', 'hero', { section: 'features', transition: { from: 'features', to: 'sustainability', progress: 0.1 } }],
    ['transition-out', 'pricing', { section: 'pricing', transition: { from: 'sustainability', to: 'pricing', progress: 0.1 } }],
  ];
  for (const [name, section, next] of cases) await t.test(name, t => {
    const fetches = [], images = [];
    t.mock.method(globalThis, 'fetch', (url, options) => {
      fetches.push({ url, ...options });
      return new Promise(() => {});
    });
    t.mock.method(THREE.TextureLoader.prototype, 'load', url => { images.push(url); return new THREE.Texture(); });
    const f = fixture({ section, laptopFactory: createLaptopModel });
    const asset = f.run('laptopAsset');
    t.after(() => asset.dispose());
    assert.equal(fetches.length, next ? 0 : 1, 'initial chapter alone determines resource demand');
    assert.equal(images.length, next ? 0 : 1, 'dashboard image follows the same demand boundary');
    f.step();
    if (next) {
      Object.assign(f.state, next);
      f.wake(); f.step();
    }
    assert.equal(fetches.length, 1);
    assert.equal(images.length, 1);
    assert.match(fetches[0].url, /dashboard\/macbook\.glb$/);
    assert.equal(images[0], '/immersive-assets/dashboard/dashboard-black-gold.webp');
    f.wake(); f.step();
    assert.equal(fetches.length, 1, 'repeated chapter updates reuse the pending resource');
    asset.dispose();
    assert.equal(fetches[0].signal.aborted, true, 'teardown cancels the requested model');
  });
});


// Preserve the existing deferred-load cancellation proof alongside the Scene
// scheduler contract. Only network/decode completion is controlled by the test.
const settle = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function laptopFixture(t) {
  const fetches = [], images = [], parses = [], disposals = [], ready = [], errors = [];
  let decoderDisposals = 0;
  t.mock.method(globalThis, 'fetch', (_url, options) => {
    const result = deferred();
    fetches.push({ ...options, ...result });
    return result.promise;
  });
  t.mock.method(THREE.TextureLoader.prototype, 'load', (_url, onLoad) => {
    images.push(onLoad);
    return new THREE.Texture();
  });
  t.mock.method(GLTFLoader.prototype, 'parseAsync', () => {
    const result = deferred();
    parses.push(result);
    return result.promise;
  });
  t.mock.method(DRACOLoader.prototype, 'dispose', () => { decoderDisposals++; });
  const asset = createLaptopModel({
    canvas: { dataset: {} }, disposeTree: object => disposals.push(object),
    onReady: () => ready.push('ready'), onInvalidate: () => ready.push('invalidate'),
    onError: error => errors.push(error),
  });
  t.after(() => asset.dispose());
  return { asset, fetches, images, parses, disposals, ready, errors, get decoderDisposals() { return decoderDisposals; } };
}

test('disposing a demanded laptop cancels work and discards late model and texture completion', async t => {
  await t.test('dispose before demand starts nothing', t => {
    const h = laptopFixture(t);
    h.asset.dispose();
    h.asset.load();
    assert.equal(h.fetches.length, 0);
    assert.equal(h.images.length, 0);
  });
  await t.test('disposed fetch never starts a parser', async t => {
    const h = laptopFixture(t);
    const loading = h.asset.load();
    h.asset.dispose();
    assert.equal(h.fetches[0].signal.aborted, true);
    h.fetches[0].resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
    await loading;
    await settle();
    assert.equal(h.parses.length, 0);
    assert.equal(h.decoderDisposals, 1);
    assert.deepEqual(h.ready, []);
  });
  await t.test('decoder disposal waits for parse and late resources never attach', async t => {
    const h = laptopFixture(t);
    const loading = h.asset.load();
    h.fetches[0].resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
    await settle();
    assert.equal(h.parses.length, 1);
    h.asset.dispose();
    assert.equal(h.decoderDisposals, 0, 'an initializing parser can create a worker after premature disposal');
    const model = new THREE.Group();
    h.parses[0].resolve({ scene: model });
    const texture = new THREE.Texture({ width: 1024, height: 768 });
    let textureDisposals = 0;
    texture.addEventListener('dispose', () => textureDisposals++);
    h.images[0](texture);
    await loading;
    await settle();
    assert.equal(h.asset.root.children.length, 0);
    assert.ok(h.disposals.includes(model));
    assert.equal(textureDisposals, 1);
    assert.equal(h.decoderDisposals, 1);
    assert.deepEqual(h.ready, []);
    assert.deepEqual(h.errors, []);
  });
});


test('model-only laptop completion wakes Scene and refreshes geometry, foreground layers and shadows', async t => {
  const parsing = deferred();
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }));
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture()); // dashboard stays pending
  t.mock.method(GLTFLoader.prototype, 'parseAsync', () => parsing.promise);
  const f = fixture({ section: 'grip', laptopFactory: createLaptopModel, laptopSignals: true });
  const asset = f.run('laptopAsset');
  t.after(() => asset.dispose());
  // The neighboring dish chapter requests the laptop before it is visible.
  asset.root.visible = false;
  asset.root.scale.setScalar(0);
  f.scope.pose.laptopScale = 0;
  f.step();
  assert.equal(f.pending.size, 0, 'the waiting scene sleeps');
  const previousSignature = f.run('renderSignature');
  const model = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 2), new THREE.MeshBasicMaterial());
  const lid = new THREE.Group();
  lid.name = 'Bevels_2';
  const screen = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.02), new THREE.MeshBasicMaterial());
  screen.name = 'Object_7';
  screen.position.y = 1;
  lid.add(screen);
  model.add(base, lid);
  const values = [0, 0, Math.PI / 2, 2 * Math.PI / 3].flatMap(angle =>
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle).toArray());
  const track = new THREE.QuaternionKeyframeTrack('Bevels_2.quaternion', [0, 1, 2, 3], values);
  parsing.resolve({ scene: model, animations: [new THREE.AnimationClip('authored-hinge', 3, [track])] });
  await asset.load();
  const wakes = f.pending.size;
  // Still inspect the next real draw when a missing wake is the regression.
  if (!wakes) f.wake();
  f.step();
  const foreground = new THREE.Layers();
  foreground.set(1);
  const attached = [];
  asset.root.traverse(object => { if (object !== asset.root) attached.push(object); });
  assert.deepEqual({
    wakes,
    ready: f.scope.canvas.dataset.laptopReady,
    boundsAvailable: !asset.framingBounds.isEmpty(),
    geometryChanged: f.run('renderSignature') !== previousSignature,
    foregroundAssigned: attached.length > 0 && attached.every(object => object.layers.mask === foreground.mask),
    shadowsInvalidated: f.run('renderer.shadowMap.needsUpdate'),
  }, { wakes: 1, ready: 'false', boundsAvailable: true, geometryChanged: true, foregroundAssigned: true, shadowsInvalidated: true });
  assert.equal(f.pending.size, 0, 'a completed model update must not poll for the pending image');
});

// Scroll copy and the fitted scene must consume the same browser frame. This
// catches the former App RAF -> Scene RAF delay, including reverse callback order.
test('scroll publishes and renders in one frame without losing idle, gestures or lifecycle guards', () => {
  const f = fixture();
  f.step();
  assert.equal(typeof f.state.renderSceneFrame, 'function', 'App can finish its frame without queuing a second RAF');
  const seen = [];
  f.fit(damping => seen.push({ progress: f.state.progress, damping }));
  let prepared = 0;
  f.state.beforeSceneFrame = () => {
    if (prepared++) return;
    f.state.progress = 0.4;
    f.state.scrollDistance = 4;
  };
  f.wake();
  const renders = f.renders;
  f.state.renderSceneFrame(32);
  assert.equal(f.renders, renders + 1);
  assert.equal(f.pending.size, 0, 'the older pending Scene callback is cancelled');
  assert.deepEqual(seen.at(-1), { progress: 0.4, damping: 1 }, 'authored scroll pose has no second temporal lag behind copy');

  f.state.drag = 0.75;
  f.wake(); f.step(48);
  assert.ok(seen.at(-1).damping > 0 && seen.at(-1).damping < 1, 'direct manipulation retains time-based damping');
  f.state.beforeSceneFrame = () => { f.state.progress = 0.6; f.state.scrollDistance = 6; };
  f.wake(); f.step(64);
  assert.deepEqual(seen.at(-1), { progress: 0.6, damping: 1 }, 'an asset/video RAF also flushes newer queued copy before drawing');

  const beforeHidden = f.renders;
  f.scope.document.hidden = true;
  f.state.renderSceneFrame(80);
  assert.equal(f.renders, beforeHidden);
  f.scope.document.hidden = false;
  f.state.sceneOccluded = true;
  f.state.renderSceneFrame(96);
  assert.equal(f.renders, beforeHidden, 'natural opaque pricing remains suspended');
  assert.equal(f.pending.size, 0);
  const lateRender = f.state.renderSceneFrame;
  f.dispose(); lateRender(112);
  assert.equal(f.renders, beforeHidden, 'stale callbacks cannot render after unmount');
  assert.equal(f.state.renderSceneFrame, undefined, 'owned same-frame handle is removed');
});

test('drawing resolution bounds high-density GPU work without repeated buffer clears', () => {
  for (const [width, height, dpr] of [[390, 844, 3], [430, 932, 3], [1440, 900, 1], [3840, 2160, 2]]) {
    let resizes = 0, wakes = 0;
    const canvas = { clientWidth: width, clientHeight: height, width: 0, height: 0, dataset: {} };
    const scope = {
      canvas, drawingSize: undefined, viewportRevision: 0, disposed: false, arExperience: null,
      window: { devicePixelRatio: dpr }, camera: new THREE.PerspectiveCamera(),
      renderer: { setDrawingBufferSize(w, h, ratio) { resizes++; canvas.width = Math.floor(w * ratio); canvas.height = Math.floor(h * ratio); } },
      invalidateScene() { wakes++; },
    };
    vm.createContext(scope);
    vm.runInContext(productionFunction('resize'), scope);
    scope.resize();
    assert.ok(scope.drawingSize.pixelRatio <= 1.5, 'Retina must not multiply the scene workload by nine');
    assert.ok(canvas.width * canvas.height <= 2560 * 1440, 'large screens respect the pixel budget');
    if (dpr === 1) assert.equal(scope.drawingSize.pixelRatio, 1, 'ordinary desktop resolution stays native');
    scope.resize();
    assert.equal(resizes, 1, 'unchanged viewport never clears the drawing buffer');
    assert.equal(wakes, 1);
  }
});
