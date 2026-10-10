import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createSupportModels, supportModels } from "../components/immersive/SupportModels.js";

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("stands load only on selection and retain a visible model until a switch is ready", async (t) => {
  const pending = [];
  t.mock.method(globalThis, "fetch", (url, { signal }) => new Promise((resolve) => pending.push({ url, signal, resolve })));
  t.mock.method(GLTFLoader.prototype, "parseAsync", async () => ({ scene: new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()) }));
  const canvas = { dataset: {} };
  const assets = createSupportModels({ canvas, renderer: { capabilities: { getMaxAnisotropy: () => 1 } }, disposeTree() {}, onError: assert.fail });
  t.after(() => assets.dispose());
  assert.equal(pending.length, 1, "opening must not download unselected collections");
  assert.ok(pending[0].url.endsWith(supportModels.acrylique));
  pending[0].resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
  await settle();
  assert.equal(canvas.dataset.supportReady, "true");
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
  assets.select("acrylique");
  assert.equal(assets.active, initial);
  assert.equal(pending.length, 2, "loaded stands are reused");
});

test("disposing stands aborts pending requests and disposes late decoded models", async (t) => {
  let finishParse;
  let signal;
  const model = new THREE.Group();
  const disposed = [];
  t.mock.method(globalThis, "fetch", async (_url, options) => { signal = options.signal; return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) }; });
  t.mock.method(GLTFLoader.prototype, "parseAsync", () => new Promise((resolve) => { finishParse = resolve; }));
  const assets = createSupportModels({ canvas: { dataset: {} }, renderer: {}, disposeTree: (tree) => disposed.push(tree), onError: assert.fail });
  await settle();
  assets.dispose();
  assert.equal(signal.aborted, true);
  finishParse({ scene: model });
  await settle();
  assert.deepEqual(disposed, [model]);
  assert.equal(assets.root.children.length, 0);
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
