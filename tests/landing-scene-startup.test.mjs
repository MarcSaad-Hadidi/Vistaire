import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("components/immersive/deferredScene.js", "utf8")
  .replace(/import[^;]+from "react";/, "")
  .replaceAll("export ", "");

function startupScope({ readyState = "complete", scrollY = 0, earlyInput } = {}) {
  const state = { listeners: new Map(), idle: new Map(), observers: new Set(), timers: new Map(), fetched: 0, started: false };
  let nextId = 0;
  state.scope = vm.createContext({
    document: { readyState }, scrollY, Element: class {}, __vistaireIntent: earlyInput,
    useState: () => [false, value => { state.started = value; }],
    useEffect: effect => { state.cleanup = effect(); },
    addEventListener: (name, callback, options) => state.listeners.set(name, { callback, options }),
    removeEventListener: name => state.listeners.delete(name),
    PerformanceObserver: Object.assign(class {
      constructor(callback) { this.callback = callback; }
      observe(options) { assert.deepEqual({ ...options }, { type: "paint", buffered: true }); state.observers.add(this); }
      disconnect() { state.observers.delete(this); }
    }, { supportedEntryTypes: ["paint"] }),
    requestIdleCallback: (callback, options) => { state.idle.set(++nextId, { callback, options }); return nextId; },
    cancelIdleCallback: id => state.idle.delete(id),
    setTimeout: (callback, delay) => { state.timers.set(++nextId, { callback, delay }); return nextId; },
    clearTimeout: id => state.timers.delete(id),
    prefetch: () => { state.fetched++; },
  });
  vm.runInContext(source + "\nuseDeferredScene(prefetch);", state.scope);
  return state;
}
const INPUTS = ["keydown", "pointerdown", "scroll", "touchstart", "wheel"];
const HELD = ["keydown", "touchmove", "wheel"];

test("models download after the first contentful paint; the scene sets up after a quiet spell", () => {
  for (const readyState of ["loading", "complete"]) {
    const s = startupScope({ readyState });
    for (const name of INPUTS) assert.equal(s.listeners.get(name).options.passive, true, `${name}: starting listeners never block (the hold does)`);
    if (readyState === "loading") {
      assert.equal(s.observers.size, 0, "the poster keeps network priority until load");
      s.listeners.get("load").callback();
    }
    assert.equal(s.fetched, 0, "no model download before the copy is presented");
    const [observer] = s.observers;
    observer.callback({ getEntries: () => [{ name: "first-paint" }] });
    assert.equal(s.fetched, 0, "a non-contentful paint is not enough");
    observer.callback({ getEntries: () => [{ name: "first-contentful-paint" }] });
    assert.equal(s.observers.size, 0);
    assert.equal(s.fetched, 1, "models download right after that paint (network only)");
    assert.equal(s.started, false, "the main-thread setup does not start yet");
    assert.equal(s.timers.size, 1);
    const [{ callback: quiet, delay }] = s.timers.values();
    assert.ok(delay >= 3000, "the setup stays out of the page's first seconds");
    s.timers.clear(); quiet();
    assert.equal(s.idle.size, 1, "then waits for an idle moment");
    const [{ callback: idle, options }] = s.idle.values();
    assert.equal(options.timeout, 2000);
    idle();
    assert.equal(s.started, true, "no pointer, wheel or key is needed");
    assert.equal(s.fetched, 1);
    assert.deepEqual([...s.listeners.keys()], [], "inputs and load listeners leave once started");
    s.cleanup();
  }
});

test("a visitor input or a restored scroll starts the scene at once; unmount cancels everything", () => {
  const input = startupScope({ readyState: "loading" });
  input.listeners.get("wheel").callback({ type: "wheel" });
  assert.equal(input.started, true);
  assert.equal(input.fetched, 1);
  assert.equal(input.listeners.size, 0);
  input.cleanup();

  const restored = startupScope({ scrollY: 400 });
  assert.equal(restored.started, true, "a restored or anchored scroll is already past the opening");
  assert.equal(restored.fetched, 1);

  const early = startupScope({ earlyInput: true });
  assert.equal(early.started, true, "an input before hydration (held inline) starts the scene at mount");
  assert.equal(early.fetched, 1);

  const pending = startupScope();
  const [observer] = pending.observers;
  observer.callback({ getEntries: () => [{ name: "first-contentful-paint" }] });
  pending.cleanup();
  assert.equal(pending.timers.size, 0, "unmount cancels the quiet-spell timer");
  assert.equal(pending.listeners.size, 0);
  assert.equal(pending.started, false);
  const waiting = startupScope();
  waiting.cleanup();
  assert.equal(waiting.observers.size, 0, "unmount stops waiting for the first paint");
});

test("shader preparation yields until all current programs are ready", async () => {
  const timers = [];
  let linked = false, compiled = 0;
  const renderer = { compile() { compiled++; }, info: { programs: [{ isReady: () => linked }] } };
  const scope = vm.createContext({ renderer, stopped: () => false,
    setTimeout: callback => timers.push(callback) });
  const pending = vm.runInContext(source + "\nprepareSceneShaders(renderer, {}, {}, stopped);", scope);
  let done = false;
  pending.then(() => { done = true; });
  assert.equal(compiled, 1);
  assert.equal(done, false, "shader linking must not block or declare the scene ready");
  assert.equal(timers.length, 1);
  linked = true;
  timers.shift()();
  assert.equal(await pending, true);
});

test("shader preparation stops before touching programs after disposal", async () => {
  const timers = [];
  let disposed = false;
  const renderer = { compile() {}, info: { programs: [{ isReady() {
    assert.equal(disposed, false, "disposed programs must never be polled");
    return false;
  } }] } };
  const scope = vm.createContext({ renderer, stopped: () => disposed,
    setTimeout: callback => timers.push(callback) });
  const pending = vm.runInContext(source + "\nprepareSceneShaders(renderer, {}, {}, stopped);", scope);
  disposed = true;
  timers.shift()();
  assert.equal(await pending, false);
  assert.equal(timers.length, 0, "unmount leaves no polling loop");
});

test("PMREM shaders link off the main thread before the environment is filtered", async () => {
  const timers = [], compiled = [];
  let linked = false;
  const target = { disposed: false, dispose() { this.disposed = true; } };
  const blur = { name: "blur" }, ggx = { name: "ggx" }, filterMesh = { material: null };
  const renderer = {
    toneMapping: 4, renderTarget: null,
    setRenderTarget(value) { this.renderTarget = value; },
    compile(object) { compiled.push([object === filterMesh ? object.material.name : object.name, this.toneMapping, this.renderTarget]); },
    info: { programs: [{ isReady: () => linked }] },
  };
  const pmrem = {
    _setSize(size) { this.size = size; },
    _allocateTargets() { this._blurMaterial = blur; this._ggxMaterial = ggx; this._lodMeshes = [filterMesh, filterMesh]; return target; },
  };
  const scope = vm.createContext({ renderer, pmrem, environment: { name: "room" }, stopped: () => false,
    setTimeout: callback => timers.push(callback) });
  const pending = vm.runInContext(source + "\nprepareEnvironmentShaders(renderer, pmrem, environment, {}, stopped);", scope);
  assert.equal(pmrem.size, 256, "same cube size as fromScene");
  assert.deepEqual(compiled, [["room", 0, target], ["blur", 0, target], ["ggx", 0, target]],
    "fromScene's programs: untoned, into a half-float cubeUV target");
  assert.equal(renderer.toneMapping, 4);
  assert.equal(renderer.renderTarget, null);
  assert.equal(target.disposed, true);
  assert.equal(timers.length, 1, "waits for linking without blocking");
  linked = true;
  timers.shift()();
  assert.equal(await pending, true);
});

function holdScope({ overflowY = "visible" } = {}) {
  const state = { listeners: new Map(), timers: new Map(), holding: undefined };
  let nextId = 0, cleanup, value = false;
  class Element { constructor(tag, parent) { this.tag = tag; this.parentElement = parent; this.scrollHeight = 900; this.clientHeight = 300; }
    closest(selector) { return selector.includes(this.tag) ? this : null; } }
  const body = new Element("body", null);
  state.scope = vm.createContext({
    Element, document: { body, documentElement: body },
    getComputedStyle: () => ({ overflowY }),
    useState: initial => [value ?? initial, next => { value = next; }],
    useEffect: effect => { cleanup?.(); cleanup = effect() ?? undefined; },
    addEventListener: (name, callback, options) => state.listeners.set(name, { callback, options }),
    removeEventListener: name => state.listeners.delete(name),
    setTimeout: (callback, delay) => { state.timers.set(++nextId, { callback, delay }); return nextId; },
    clearTimeout: id => state.timers.delete(id),
  });
  vm.runInContext(source, state.scope);
  state.render = active => { state.holding = vm.runInContext(`useScrollHold(${active})`, state.scope); };
  state.unmount = () => cleanup?.();
  state.element = tag => new Element(tag, body);
  state.timedOut = () => value;
  return state;
}
const event = (type, target, extra = {}) => ({ type, target, prevented: false, preventDefault() { this.prevented = true; }, ...extra });

test("while the scene loads, scrolling waits at the opening; controls and overlays keep theirs", () => {
  const s = holdScope();
  s.render(true);
  assert.equal(s.holding, true);
  for (const type of ["wheel", "touchmove", "keydown"]) assert.equal(s.listeners.get(type).options.passive, false);
  const page = s.element("main");
  for (const e of [event("wheel", page), event("touchmove", page), event("keydown", page, { key: "PageDown" }), event("keydown", page, { key: " " })]) {
    s.listeners.get(e.type).callback(e);
    assert.equal(e.prevented, true, `${e.type} ${e.key ?? ""} is held`);
  }
  const button = event("keydown", s.element("button"), { key: " " });
  s.listeners.get("keydown").callback(button);
  assert.equal(button.prevented, false, "a focused control keeps Space");
  const letter = event("keydown", page, { key: "a" });
  s.listeners.get("keydown").callback(letter);
  assert.equal(letter.prevented, false, "only scrolling keys are held");
  s.unmount();
  assert.equal(s.listeners.size, 0);

  const overlay = holdScope({ overflowY: "auto" });
  overlay.render(true);
  const menu = event("wheel", overlay.element("nav"));
  overlay.listeners.get("wheel").callback(menu);
  assert.equal(menu.prevented, false, "a self-scrolling menu or dialog keeps its scrolling");
});

test("the scroll hold releases after 20 s or when the scene is ready", () => {
  const s = holdScope();
  s.render(true);
  const [{ callback, delay }] = s.timers.values();
  assert.equal(delay, 20_000);
  callback();
  assert.equal(s.timedOut(), true);
  s.render(true);
  assert.equal(s.holding, false, "a load that never finishes does not trap the visitor");
  assert.equal(s.listeners.size, 0);

  const ready = holdScope();
  ready.render(false);
  assert.equal(ready.holding, false);
  assert.equal(ready.listeners.size, 0);
});

test("scrolling is held from the HTML parse, before hydration, by the same listener React later releases", () => {
  const s = holdScope();
  s.scope.window = s.scope;
  vm.runInContext(vm.runInContext("EARLY_SCROLL_HOLD", s.scope), s.scope);
  for (const name of HELD) assert.ok(s.listeners.has(name), name);
  const early = s.listeners.get("wheel").callback;
  assert.equal(s.listeners.get("wheel").options.passive, false);
  const wheel = event("wheel", s.element("main"));
  early(wheel);
  assert.equal(wheel.prevented, true, "a wheel before hydration does not scroll");
  const [{ delay }] = s.timers.values();
  assert.equal(delay, 20_000, "a page whose scripts never run is released");
  s.render(true);
  assert.equal(s.listeners.get("wheel").callback, early, "hydration keeps the very same hold");
  s.render(false);
  for (const name of HELD) assert.ok(!s.listeners.has(name), `the ready scene releases the early ${name} hold too`);
});

test("the inline hold remembers an input made before hydration", () => {
  const s = holdScope();
  s.scope.window = s.scope;
  vm.runInContext(vm.runInContext("EARLY_SCROLL_HOLD", s.scope), s.scope);
  assert.equal(s.scope.__vistaireIntent, undefined);
  for (const type of ["pointerdown", "touchstart"]) assert.equal(s.listeners.get(type).options.passive, true);
  s.listeners.get("touchstart").callback();
  assert.equal(s.scope.__vistaireIntent, true);
});
