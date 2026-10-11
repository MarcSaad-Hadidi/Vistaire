// CPU/session mocks: these checks do not validate real-device placement or GPU rendering.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createARExperience } from "../src/ARExperience.js";
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
class Events {
  constructor() {
    this.listeners = new Map();
  }
  addEventListener(type, fn) {
    if (fn) {
      const entries = this.listeners.get(type) || new Set();
      entries.add(fn);
      this.listeners.set(type, entries);
    }
  }
  removeEventListener(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }
  emit(type, event = {}) {
    for (const fn of [...(this.listeners.get(type) || [])]) fn(event);
  }
  contains(element) {
    return element?.control === true;
  }
}
function fixture({
  request,
  hitFailure,
  setupGate,
  setupFailure,
  plateWidthMeters,
} = {}) {
  const overlay = new Events();
  const states = [];
  let suspends = 0,
    resumes = 0,
    requested = 0,
    disposeShared = 0;
  const source = new THREE.Group();
  source.position.set(1, 0.5, -2);
  source.scale.setScalar(0.5);
  const geometry = new THREE.BoxGeometry(4, 0.4, 3),
    material = new THREE.MeshStandardMaterial();
  geometry.addEventListener("dispose", () => disposeShared++);
  material.addEventListener("dispose", () => disposeShared++);
  source.add(new THREE.Mesh(geometry, material));
  const renderer = {
    shadowMap: { enabled: true, autoUpdate: false, needsUpdate: true },
    autoClear: false,
    autoClearColor: false,
    autoClearDepth: false,
    autoClearStencil: false,
    ratio: 3,
    size: new THREE.Vector2(390, 844),
    viewport: new THREE.Vector4(1, 2, 387, 841),
    scissor: new THREE.Vector4(3, 4, 380, 830),
    scissorTest: true,
    color: new THREE.Color("#1a2a3a"),
    alpha: 1,
    target: { name: "normal-target" },
    loop: null,
    renders: [],
    getClearColor(t) {
      return t.copy(this.color);
    },
    getClearAlpha() {
      return this.alpha;
    },
    getSize(t) {
      return t.copy(this.size);
    },
    getPixelRatio() {
      return this.ratio;
    },
    getViewport(t) {
      return t.copy(this.viewport);
    },
    getScissor(t) {
      return t.copy(this.scissor);
    },
    getScissorTest() {
      return this.scissorTest;
    },
    getRenderTarget() {
      return this.target;
    },
    setAnimationLoop(loop) {
      this.loop = loop;
    },
    setClearColor(c, a) {
      this.color.set(c);
      this.alpha = a;
    },
    setPixelRatio(r) {
      this.ratio = r;
    },
    setSize(x, y) {
      this.size.set(x, y);
    },
    setRenderTarget(t) {
      this.target = t;
    },
    setViewport(v) {
      this.viewport.copy(v);
    },
    setScissor(v) {
      this.scissor.copy(v);
    },
    setScissorTest(v) {
      this.scissorTest = v;
    },
    resetState() {},
    render(scene, camera) {
      scene.updateMatrixWorld(true);
      this.renders.push({ scene, camera });
    },
  };
  const xr = new Events();
  Object.assign(xr, {
    enabled: false,
    cameraAutoUpdate: false,
    isPresenting: false,
    session: null,
    controllers: [new THREE.Group(), new THREE.Group()],
    referenceType: "local-floor",
    getSession() {
      return this.session;
    },
    getController(i) {
      return this.controllers[i];
    },
    getReferenceSpace() {
      return this.referenceSpace;
    },
    setReferenceSpaceType(t) {
      this.referenceType = t;
    },
    async setSession(session) {
      this.session = session;
      session.addEventListener("end", () => {
        this.session = null;
        this.isPresenting = false;
        this.emit("sessionend");
      });
      renderer.ratio = 1;
      renderer.size.set(1920, 1080);
      if (setupGate) await setupGate.promise;
      if (setupFailure) throw setupFailure;
      this.isPresenting = true;
      this.referenceSpace = { type: "local" };
      this.emit("sessionstart");
    },
  });
  renderer.xr = xr;
  const session = new Events();
  Object.assign(session, {
    domOverlayState: { type: "screen" },
    ends: 0,
    hitCancels: 0,
    requestReferenceSpace: async () => ({ type: "viewer" }),
    requestHitTestSource: async () => {
      if (hitFailure) throw hitFailure;
      return {
        cancel: () => {
          session.hitCancels++;
        },
      };
    },
    async end() {
      this.ends++;
      this.emit("end");
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      xr: {
        requestSession(mode, options) {
          requested++;
          assert.equal(mode, "immersive-ar");
          assert.deepEqual(options.requiredFeatures, ["hit-test"]);
          assert.deepEqual(options.optionalFeatures, ["dom-overlay"]);
          assert.equal(options.domOverlay.root, overlay);
          return request ? request(session) : Promise.resolve(session);
        },
      },
    },
  });
  const api = createARExperience({
    renderer,
    environment: null,
    getModel: () => source,
    getPlateWidthMeters: () => plateWidthMeters,
    overlay,
    onStatus: (status, details) => states.push({ status, ...details }),
    onSuspend: () => suspends++,
    onResume: () => resumes++,
  });
  const saved = {
    color: renderer.color.clone(),
    ratio: renderer.ratio,
    size: renderer.size.clone(),
    viewport: renderer.viewport.clone(),
    scissor: renderer.scissor.clone(),
    target: renderer.target,
  };
  return {
    api,
    renderer,
    xr,
    source,
    session,
    overlay,
    states,
    saved,
    get requested() {
      return requested;
    },
    get suspends() {
      return suspends;
    },
    get resumes() {
      return resumes;
    },
    get disposeShared() {
      return disposeShared;
    },
    frame(matrix) {
      return {
        getHitTestResults: () =>
          matrix
            ? [{ getPose: () => ({ transform: { matrix: matrix.elements } }) }]
            : [],
      };
    },
  };
}
test("synchronous native request, hit-test placement, resource sharing, scale/rotation, reposition, restoration", async () => {
  const f = fixture();
  const sourceBounds = new THREE.Box3().setFromObject(f.source);
  const p = f.api.start();
  assert.equal(f.requested, 1);
  assert.equal(f.api.active, true);
  assert.equal(f.suspends, 1);
  assert.equal(f.states.at(-1).status, "requesting");
  await p;
  f.xr.controllers[0].dispatchEvent({ type: "select" });
  assert.equal(f.states.at(-1).status, "scanning");
  f.renderer.loop(0, f.frame(new THREE.Matrix4().makeRotationZ(Math.PI / 2)));
  assert.equal(f.states.at(-1).canPlace, false);
  const hit = new THREE.Matrix4().makeTranslation(0.5, 0.7, -1);
  f.renderer.loop(1, f.frame(hit));
  assert.equal(f.states.at(-1).canPlace, true);
  f.xr.controllers[0].dispatchEvent({ type: "select" });
  assert.equal(f.states.at(-1).status, "placed");
  const scene = f.renderer.renders.at(-1).scene;
  const anchor = scene.children.find(
    (x) => x.isGroup && x.matrixAutoUpdate === false,
  );
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(anchor);
  assert.ok(Math.abs(bounds.getSize(new THREE.Vector3()).x - 0.28) < 1e-6);
  assert.ok(Math.abs(bounds.min.y - 0.7) < 1e-6);
  let cloned;
  anchor.traverse((x) => {
    if (x.isMesh) cloned = x;
  });
  assert.equal(cloned.geometry, f.source.children[0].geometry);
  assert.equal(cloned.material, f.source.children[0].material);
  assert.equal(f.api.setScale(9), 2);
  assert.ok(Math.abs(f.api.rotate() - Math.PI / 6) < 1e-8);
  assert.equal(f.api.reposition(), true);
  assert.equal(f.states.at(-1).canPlace, false);
  assert.equal(anchor.visible, false);
  f.renderer.loop(2, f.frame());
  f.xr.controllers[0].dispatchEvent({ type: "select" });
  assert.equal(anchor.visible, false);
  await f.api.end();
  assert.equal(f.api.active, false);
  assert.equal(f.resumes, 1);
  assert.equal(f.session.hitCancels, 1);
  assert.equal(f.disposeShared, 0);
  assert.equal(f.renderer.loop, null);
  assert.equal(f.xr.enabled, false);
  assert.equal(f.xr.cameraAutoUpdate, false);
  assert.equal(f.xr.referenceType, "local-floor");
  assert.equal(f.renderer.shadowMap.enabled, true);
  assert.equal(f.renderer.autoClear, false);
  assert.equal(f.renderer.alpha, 1);
  assert.deepEqual(f.renderer.color, f.saved.color);
  assert.deepEqual(f.renderer.size, f.saved.size);
  assert.deepEqual(f.renderer.viewport, f.saved.viewport);
  assert.deepEqual(f.renderer.scissor, f.saved.scissor);
  assert.equal(f.renderer.target, f.saved.target);
  assert.equal(f.renderer.ratio, 3);
  assert.deepEqual(new THREE.Box3().setFromObject(f.source), sourceBounds);
  assert.equal(f.states.at(-1).status, "idle");
});
test("DOM overlay suppresses only interactive controls", async () => {
  const f = fixture();
  await f.api.start();
  let prevented = 0;
  f.overlay.emit("beforexrselect", {
    target: { closest: () => ({ control: true }) },
    preventDefault: () => prevented++,
  });
  assert.equal(prevented, 1);
  f.overlay.emit("beforexrselect", {
    target: { closest: () => null },
    preventDefault: () => prevented++,
  });
  assert.equal(prevented, 1);
  await f.api.dispose();
  assert.equal(f.overlay.listeners.get("beforexrselect").size, 0);
});
test("foreground-only dish layers remain visible to the independent AR camera", async () => {
  const f = fixture();
  f.source.traverse((object) => object.layers.set(1));
  await f.api.start();
  f.renderer.loop(0, f.frame(new THREE.Matrix4().makeTranslation(0, 0.7, -1)));
  f.xr.controllers[0].dispatchEvent({ type: "select" });
  const { scene, camera } = f.renderer.renders.at(-1);
  const anchor = scene.children.find(
    (object) => object.isGroup && object.matrixAutoUpdate === false,
  );
  let meshes = 0;
  anchor.traverse((object) => {
    assert.ok(camera.layers.test(object.layers));
    if (object.isMesh) {
      meshes++;
      assert.equal(object.geometry, f.source.children[0].geometry);
      assert.equal(object.material, f.source.children[0].material);
    }
  });
  assert.equal(meshes, 1);
  f.source.traverse((object) => assert.equal(object.layers.mask, 2));
  await f.api.dispose();
  assert.equal(f.disposeShared, 0);
});
test("permission denial resumes exactly once and allows a fresh attempt", async () => {
  const denied = new DOMException("denied", "NotAllowedError");
  let count = 0;
  const f = fixture({
    request: (s) =>
      ++count === 1 ? Promise.reject(denied) : Promise.resolve(s),
  });
  await assert.rejects(f.api.start(), denied);
  assert.equal(f.api.active, false);
  assert.equal(f.resumes, 1);
  assert.equal(f.disposeShared, 0);
  await f.api.start();
  await f.api.end();
  assert.equal(f.resumes, 2);
});
test("dispose during pending permission closes the eventual session without XR rendering", async () => {
  const pending = deferred();
  const f = fixture({ request: () => pending.promise });
  const start = f.api.start();
  const closed = f.api.dispose();
  pending.resolve(f.session);
  await assert.rejects(start, { name: "AbortError" });
  await closed;
  assert.equal(f.session.ends, 1);
  assert.equal(f.renderer.renders.length, 0);
  assert.equal(f.api.active, false);
  assert.equal(f.resumes, 1);
  await assert.rejects(f.api.start());
});
test("hit-test setup failure closes session and retains shared resources", async () => {
  const error = new DOMException("hit test unavailable", "NotSupportedError");
  const f = fixture({ hitFailure: error });
  await assert.rejects(f.api.start(), error);
  assert.equal(f.session.ends, 1);
  assert.equal(f.api.active, false);
  assert.equal(f.resumes, 1);
  assert.equal(f.disposeShared, 0);
});
test("close during asynchronous renderer setup waits and restores after initialization settles", async () => {
  const setupGate = deferred();
  const f = fixture({ setupGate });
  const started = f.api.start();
  while (!f.xr.getSession()) await Promise.resolve();
  const closed = f.api.end();
  assert.equal(f.session.ends, 0);
  setupGate.resolve();
  await assert.rejects(started, { name: "AbortError" });
  await closed;
  assert.equal(f.session.ends, 1);
  assert.equal(f.xr.isPresenting, false);
  assert.equal(f.api.active, false);
  assert.equal(f.renderer.ratio, 3);
  assert.equal(f.resumes, 1);
});
test("native end restores once and permits restarting", async () => {
  const f = fixture();
  await f.api.start();
  await f.session.end();
  await Promise.resolve();
  assert.equal(f.api.active, false);
  assert.equal(f.resumes, 1);
  await f.api.start();
  await f.api.end();
  assert.equal(f.resumes, 2);
  assert.equal(f.disposeShared, 0);
});
test("partial renderer initialization failure restores renderer state", async () => {
  const error = new Error("XR framebuffer unavailable");
  const f = fixture({ setupFailure: error });
  await assert.rejects(f.api.start(), error);
  assert.equal(f.xr.getSession(), null);
  assert.equal(f.renderer.ratio, 3);
  assert.deepEqual(f.renderer.size, f.saved.size);
  assert.equal(f.renderer.shadowMap.enabled, true);
  assert.equal(f.resumes, 1);
});

test("provided physical width matches the initial model size and scale control", async () => {
  const f = fixture({ plateWidthMeters: 0.1549 });
  await f.api.start();
  assert.equal(f.states.at(-1).plateWidthMeters, 0.1549);
  f.renderer.loop(0, f.frame(new THREE.Matrix4().makeTranslation(0, 0.7, -1)));
  f.xr.controllers[0].dispatchEvent({ type: "select" });
  const scene = f.renderer.renders.at(-1).scene;
  const anchor = scene.children.find(
    (child) => child.isGroup && child.matrixAutoUpdate === false,
  );
  scene.updateMatrixWorld(true);
  const width = new THREE.Box3()
    .setFromObject(anchor)
    .getSize(new THREE.Vector3()).x;
  assert.ok(Math.abs(width - 0.1549) < 0.000001);
  f.api.setScale(1.5);
  assert.equal(f.states.at(-1).plateWidthMeters, 0.1549 * 1.5);
  await f.api.end();
});

test("invalid physical width falls back to the 28 cm default", async () => {
  for (const plateWidthMeters of [NaN, 0.001, 2, "0.26"]) {
    const f = fixture({ plateWidthMeters });
    await f.api.start();
    assert.equal(f.states.at(-1).plateWidthMeters, 0.28);
    await f.api.end();
  }
});
