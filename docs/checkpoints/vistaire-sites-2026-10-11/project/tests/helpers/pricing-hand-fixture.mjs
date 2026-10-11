import fs from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createPricingHandScene } from "../../src/PricingHandScene.js";

// Exercise the real scene graph, geometry, textures and camera without a browser.
export async function pricingFixture({
  textureFails = false,
  emptyRender = false,
  shaderFails = false,
  background = false,
  grip = "original",
  delayPhone = false,
} = {}) {
  const bytes = fs.readFileSync(
    new URL("../../public/assets/phone/iphone_16_-_free.glb", import.meta.url),
  );
  const { scene: model } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  const bounds = new THREE.Box3().setFromObject(model),
    scale = 2.16 / bounds.getSize(new THREE.Vector3()).y;
  model.scale.multiplyScalar(scale);
  model.position
    .copy(bounds.getCenter(new THREE.Vector3()))
    .multiplyScalar(-scale);
  const phoneRoot = new THREE.Group();
  if (!delayPhone) phoneRoot.add(model);
  const previous = {
    fetch: globalThis.fetch,
    load: THREE.TextureLoader.prototype.load,
  };
  globalThis.fetch = async (url) => {
    const b = fs.readFileSync(new URL(`../../public${url}`, import.meta.url));
    return {
      ok: true,
      arrayBuffer: async () =>
        b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    };
  };
  THREE.TextureLoader.prototype.load = function (url, onLoad, _, onError) {
    const texture = new THREE.Texture();
    queueMicrotask(() =>
      textureFails ? onError(new Error("texture failed")) : onLoad(texture),
    );
    return texture;
  };
  const calls = [],
    captures = [];
  const renderer = {
    domElement: { width: 780, height: 1480 },
    capabilities: { getMaxAnisotropy: () => 8 },
    shadowMap: {},
    debug: { onShaderError: undefined },
    info: {
      render: { triangles: 0 },
      reset() {
        this.render.triangles = 0;
      },
    },
    setRenderTarget: (v) => calls.push(["target", v]),
    setScissorTest: (v) => calls.push(["scissor", v]),
    setViewport: (...v) => calls.push(["viewport", ...v]),
    clearDepth: () => calls.push(["clearDepth"]),
    render(scene, camera) {
      if (shaderFails) this.debug.onShaderError?.();
      scene.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      this.info.render.triangles = emptyRender ? 2 : 15422 + 167;
      captures.push({ scene, camera });
    },
  };
  let invalidations = 0;
  const pricing = createPricingHandScene({
    grip,
    renderer,
    phoneRoot,
    environment: null,
    invalidate: () => invalidations++,
    renderBackground: background
      ? (width, height) => calls.push(["background", width, height])
      : undefined,
  });
  const offer = {
    id: "acrylique",
    name: "Acrylique",
    amount: 2000,
    monthlyAmount: 200,
    pilotage: false,
    locale: "fr",
  };
  pricing.preload();
  await new Promise((resolve) => setImmediate(resolve));
  return {
    pricing,
    renderer,
    calls,
    captures,
    offer,
    providePhone() {
      phoneRoot.add(model);
    },
    get invalidations() {
      return invalidations;
    },
    close() {
      pricing.dispose();
      globalThis.fetch = previous.fetch;
      THREE.TextureLoader.prototype.load = previous.load;
    },
  };
}
