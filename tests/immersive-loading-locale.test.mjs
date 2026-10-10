import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import test from "node:test";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
const sourcePath = (file) => process.env.VISTAIRE_IMMERSIVE_SOURCE_DIR
  ? pathToFileURL(resolve(process.env.VISTAIRE_IMMERSIVE_SOURCE_DIR, file))
  : new URL(`../components/immersive/${file}`, import.meta.url);
const { createSupportModels, supportModels } = await import(sourcePath("SupportModels.js"));
const { createPhoneModel } = await import(sourcePath("PhoneModel.js"));

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("stands load only on selection and retain a visible model until a switch is ready", async (t) => {
  const pending = [];
  const wakes = [];
  t.mock.method(globalThis, "fetch", (url, { signal }) => new Promise((resolve) => pending.push({ url, signal, resolve })));
  t.mock.method(GLTFLoader.prototype, "parseAsync", async () => ({ scene: new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()) }));
  const canvas = { dataset: {} };
  const assets = createSupportModels({ canvas, renderer: { capabilities: { getMaxAnisotropy: () => 1 } }, disposeTree() {}, onError: assert.fail,
    onInvalidate: () => wakes.push({ ready: canvas.dataset.supportReady, support: canvas.dataset.support, visible: assets.active?.visible }) });
  t.after(() => assets.dispose());
  assert.equal(pending.length, 1, "opening must not download unselected collections");
  assert.ok(pending[0].url.endsWith(supportModels.acrylique));
  pending[0].resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
  await settle();
  assert.equal(canvas.dataset.supportReady, "true");
  assert.deepEqual(wakes, [{ ready: "true", support: "acrylique", visible: true }], "wake observes completed attachment and datasets");
  const initial = assets.active;
  assets.select("signature");
  assets.select("signature");
  assert.equal(pending.length, 2, "repeat selection must share its pending request");
  assert.equal(assets.active, initial, "keep the loaded stand visible while fetching");
  assert.equal(initial.visible, true);
  pending[1].resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
  await settle();
  assert.notEqual(assets.active, initial);
  assert.equal(initial.visible, false);
  assert.deepEqual(wakes.at(-1), { ready: "true", support: "signature", visible: true });
  assets.select("acrylique");
  assert.equal(assets.active, initial);
  assert.equal(pending.length, 2, "loaded stands are reused");
  assets.select("acrylique");
  assert.equal(wakes.length, 2, "cached and no-op selection already belongs to an invalidated draw");
  assets.select("sculpte");
  assets.select("acrylique");
  pending[2].resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
  await settle();
  assert.equal(wakes.length, 2, "inactive completion must not wake the scene");
  assets.select("sculpte");
  assert.equal(assets.active.visible, true);
  assert.equal(wakes.length, 2, "cached selection must not self-wake a draw");
});

test("disposing stands aborts pending requests and disposes late decoded models", async (t) => {
  let finishParse;
  let signal;
  const model = new THREE.Group();
  const disposed = [];
  let wakes = 0;
  t.mock.method(globalThis, "fetch", async (_url, options) => { signal = options.signal; return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) }; });
  t.mock.method(GLTFLoader.prototype, "parseAsync", () => new Promise((resolve) => { finishParse = resolve; }));
  const assets = createSupportModels({ canvas: { dataset: {} }, renderer: {}, disposeTree: (tree) => disposed.push(tree), onError: assert.fail, onInvalidate: () => wakes++ });
  await settle();
  assets.dispose();
  assert.equal(signal.aborted, true);
  finishParse({ scene: model });
  await settle();
  assert.deepEqual(disposed, [model]);
  assert.equal(assets.root.children.length, 0);
  assert.equal(wakes, 0, "disposed completion must not restart the scene");
});

test("phone attachment wakes after final datasets and disposed late parses do not wake", async (t) => {
  const parses = [], wakes = [], discarded = [];
  t.mock.method(globalThis, "fetch", async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }));
  t.mock.method(GLTFLoader.prototype, "parseAsync", () => new Promise((resolve) => parses.push(resolve)));
  const canvas = { dataset: {} };
  const phone = createPhoneModel({ canvas, screenMaterial: new THREE.MeshBasicMaterial(), disposeTree: (tree) => discarded.push(tree), onError: assert.fail,
    onInvalidate: () => wakes.push({ ready: canvas.dataset.phoneReady, phone: canvas.dataset.phone, attached: phone.root.children.length }) });
  t.after(() => phone.dispose());
  await settle();
  const model = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  model.name = "Object_18";
  parses[0]({ scene: model });
  await settle();
  assert.deepEqual(wakes, [{ ready: "true", phone: "iphone-16", attached: 1 }]);
  const late = createPhoneModel({ canvas: { dataset: {} }, screenMaterial: new THREE.MeshBasicMaterial(), disposeTree: (tree) => discarded.push(tree), onError: assert.fail,
    onInvalidate: () => wakes.push("late") });
  await settle();
  late.dispose();
  const lateModel = new THREE.Group();
  parses[1]({ scene: lateModel });
  await settle();
  assert.deepEqual(discarded, [lateModel]);
  assert.equal(wakes.length, 1);
});

test("App publishes each complete scroll and control batch before one scene wake", async () => {
  const source = await readFile(sourcePath("App.jsx"), "utf8");
  const wakes = [];
  const stateRef = { current: { invalidateScene: () => wakes.push({ ...stateRef.current }) } };
  const measurements = ["open-weight", "features", "social-content", "sustainability"].map((id, index) => ({ id, top: 100 + index * 20, travel: 20, sceneFrame: { x: index } }));
  const scrollStart = source.indexOf("      stateRef.current.section = current.id;");
  const scrollEnd = source.indexOf("    };\n    const queue =", scrollStart);
  assert.ok(scrollStart > 0 && scrollEnd > scrollStart, "execute the production scroll publication block");
  vm.runInNewContext(source.slice(scrollStart, scrollEnd), {
    stateRef, measurements, sceneFrames: Object.fromEntries(measurements.map(m => [m.id, m.sceneFrame])), current: { id: "sustainability" }, y: 170,
    opening: { top: 0, stageHeight: 100 }, progress: 0.5, openingProgress: null,
    sceneFrame: { x: 0.5 }, transition: null, clamp: (value) => Math.max(0, Math.min(1, value)),
    SOCIAL_TRANSITIONS: [], cinematicEase: (value) => value, writeVisualProperty() {},
    sectionRefs: { current: { "social-content": {}, features: {} } },
    readingPresentation: () => ({ position: 0, index: 0, opacity: 1 }), lastSection: "", lastChapterBeats: {},
    setChapter() {}, setChapterBeats() {}, document: { documentElement: { dataset: {} } },
  });
  assert.equal(wakes.length, 1);
  assert.equal(wakes[0].section, "sustainability");
  assert.equal(wakes[0].progress, 0.5);
  assert.equal(wakes[0].scrollDistance, 1.7);
  assert.equal(wakes[0].sceneFrames.sustainability.x, 3);
  assert.equal(wakes[0].chapterProgress.sustainability, 0.5);
  const controlStart = source.indexOf("    Object.assign(stateRef.current, {");
  const controlEnd = source.indexOf("  }, [", controlStart);
  assert.ok(controlStart > 0 && controlEnd > controlStart, "execute the production control publication block");
  vm.runInNewContext(source.slice(controlStart, controlEnd), {
    stateRef, collection: "signature", phoneDemo: "trouvable", supportAngle: 90, flip: true,
    drag: 0.8, dishZoom: 2, dish: "sushi", reduce: true, modal: {}, menu: true, retryModel: 2,
  });
  assert.equal(wakes.length, 2);
  assert.equal(wakes[1].collection, "signature");
  assert.equal(wakes[1].dishZoom, 2);
  assert.equal("dishPitch" in wakes[1], false, "dish controls publish yaw and zoom, never tilt");
  assert.equal(wakes[1].reducedMotion, true);
  assert.equal(wakes[1].modalOpen, true);
  assert.equal(wakes[1].retryModel, 2);
});

async function hrefFor(locale) {
  const source = await readFile("components/immersive/locale.jsx", "utf8");
  const hook = source.slice(source.indexOf("export function useLandingLocale"));
  const context = { URL, Intl, useContext: () => locale, LocaleContext: {}, EN: {}, getLocalizedPath: (path) => path.split(/[?#]/)[0] };
  vm.runInNewContext(hook.replace("export ", "") + "; globalThis.href = useLandingLocale().href;", context);
  return context.href;
}

test("landing menu links use the active language on relative and canonical absolute destinations", async () => {
  const english = await hrefFor("en");
  const french = await hrefFor("fr");
  for (const prefix of ["", "https://www.vistaire.ca"]) {
    const path = `${prefix}/menu/maison-elyse/dishes/homard?table=12&lang=fr-CA#details`;
    assert.equal(english(path), path.replace("lang=fr-CA", "lang=en-CA"));
    assert.equal(french(path), path);
  }
  const external = "https://other.example/menu/demo?lang=fr-CA";
  assert.equal(english(external), external);
  const lookalike = "https://www.vistaire.ca.other.example/menu/demo?lang=fr-CA";
  assert.equal(english(lookalike), lookalike);
  assert.equal(english("https://www.vistaire.ca/contact?lang=fr-CA"), "https://www.vistaire.ca/contact?lang=fr-CA");
});

test("a deselected failed stand can be retried on the next selection", async (t) => {
  const pending = [];
  const errors = [];
  t.mock.method(globalThis, "fetch", (url) => new Promise((resolve) => pending.push({ url, resolve })));
  t.mock.method(GLTFLoader.prototype, "parseAsync", async () => ({ scene: new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()) }));
  const canvas = { dataset: {} };
  const assets = createSupportModels({ canvas, renderer: { capabilities: { getMaxAnisotropy: () => 1 } }, disposeTree() {}, onError: (error) => errors.push(error) });
  t.after(() => assets.dispose());
  pending[0].resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
  await settle();
  const initial = assets.active;
  assets.select("signature");
  assets.select("acrylique");
  pending[1].resolve({ ok: false, status: 503 });
  await settle();
  assert.deepEqual(errors, [], "an inactive variant must not fail the scene");
  assets.select("signature");
  assert.equal(pending.length, 3, "failed requests must not remain cached");
  assert.equal(assets.active, initial);
  assets.select("signature");
  assert.equal(pending.length, 3, "the retry still deduplicates selection");
  pending[2].resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
  await settle();
  assert.equal(canvas.dataset.support, "signature");
  assert.equal(canvas.dataset.supportReady, "true");
  assert.notEqual(assets.active, initial);
});
